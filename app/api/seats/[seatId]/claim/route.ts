import { z } from "zod";
import { cleanupStale, getDatabase, json, STALE_AFTER_MS, verifySession } from "@/lib/server/presence";

const authSchema = z.object({ sessionId: z.string().uuid(), token: z.string().min(24).max(128) });

async function readInput(request: Request, seatId: string) {
  if (!/^seat-(?:[1-9]|1[0-2])$/.test(seatId)) return { response: json({ code: "INVALID_SEAT" }, { status: 400 }) };
  const parsed = authSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return { response: json({ code: "INVALID_SESSION" }, { status: 400 }) };
  if (!await verifySession(parsed.data.sessionId, parsed.data.token)) return { response: json({ code: "INVALID_SESSION" }, { status: 401 }) };
  return { auth: parsed.data };
}

export async function POST(request: Request, { params }: { params: Promise<{ seatId: string }> }) {
  const db = getDatabase();
  const { seatId } = await params;
  const checked = await readInput(request, seatId);
  if (checked.response) return checked.response;
  const { sessionId } = checked.auth!;
  const now = Date.now();
  await cleanupStale(now);
  const result = await db.prepare(
    "INSERT INTO room_seats (seat_id, room_id, session_id, updated_at) VALUES (?, 'main', ?, ?) ON CONFLICT(seat_id) DO UPDATE SET session_id = excluded.session_id, updated_at = excluded.updated_at WHERE room_seats.updated_at < ? OR room_seats.session_id = excluded.session_id",
  ).bind(seatId, sessionId, now, now - STALE_AFTER_MS).run();
  if ((result.meta.changes ?? 0) < 1) return json({ code: "SEAT_TAKEN", message: "다른 토끼가 먼저 앉았어요." }, { status: 409 });

  await db.batch([
    db.prepare("DELETE FROM room_seats WHERE session_id = ? AND seat_id <> ?").bind(sessionId, seatId),
    db.prepare("UPDATE rabbit_sessions SET seat_id = ?, state = 'sitting', updated_at = ? WHERE id = ?").bind(seatId, now, sessionId),
  ]);
  return json({ ok: true, seatId });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ seatId: string }> }) {
  const db = getDatabase();
  const { seatId } = await params;
  const checked = await readInput(request, seatId);
  if (checked.response) return checked.response;
  const { sessionId } = checked.auth!;
  const now = Date.now();
  await db.batch([
    db.prepare("DELETE FROM room_seats WHERE seat_id = ? AND session_id = ?").bind(seatId, sessionId),
    db.prepare("UPDATE rabbit_sessions SET seat_id = NULL, state = 'walking', ritual = 'idle', updated_at = ? WHERE id = ?").bind(now, sessionId),
  ]);
  return json({ ok: true });
}
