import { z } from "zod";
import { RABBIT_STATES, RITUAL_STATES, TEA_KINDS, TEAWARE_KINDS } from "@/lib/chagyeong-types";
import { getDatabase, getRoomSnapshot, json, verifySession } from "@/lib/server/presence";

const presenceSchema = z.object({
  sessionId: z.string().uuid(),
  token: z.string().min(24).max(128),
  position: z.object({ x: z.number().min(-9.2).max(9.2), z: z.number().min(-6.2).max(13.2) }),
  rotation: z.number().finite().min(-Math.PI * 4).max(Math.PI * 4),
  state: z.enum(RABBIT_STATES),
  seatId: z.string().regex(/^seat-(?:[1-9]|1[0-9]|20)$/).nullable(),
  tea: z.enum(TEA_KINDS).nullable(),
  teaware: z.enum(TEAWARE_KINDS).nullable(),
  ritual: z.enum(RITUAL_STATES),
  actionStartedAt: z.number().int().positive().nullable(),
});

export async function GET() {
  return json(await getRoomSnapshot());
}

export async function PUT(request: Request) {
  const db = getDatabase();
  const parsed = presenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ code: "INVALID_PRESENCE", issues: parsed.error.issues }, { status: 400 });
  const input = parsed.data;
  if (!await verifySession(input.sessionId, input.token)) {
    return json({ code: "INVALID_SESSION" }, { status: 401 });
  }

  if (input.seatId) {
    const seat = await db.prepare("SELECT session_id FROM room_seats WHERE seat_id = ?").bind(input.seatId).first<{ session_id: string }>();
    if (seat?.session_id !== input.sessionId) return json({ code: "SEAT_NOT_OWNED" }, { status: 409 });
  }

  const now = Date.now();
  const statements = [
    db.prepare(
      "UPDATE rabbit_sessions SET x = ?, z = ?, rotation = ?, state = ?, seat_id = ?, tea = ?, teaware = ?, ritual = ?, action_started_at = ?, updated_at = ? WHERE id = ?",
    ).bind(input.position.x, input.position.z, input.rotation, input.state, input.seatId, input.tea, input.teaware, input.ritual, input.actionStartedAt, now, input.sessionId),
  ];
  if (input.seatId) {
    statements.push(db.prepare("UPDATE room_seats SET updated_at = ? WHERE seat_id = ? AND session_id = ?").bind(now, input.seatId, input.sessionId));
  }
  await db.batch(statements);
  return json({ ok: true, updatedAt: now });
}
