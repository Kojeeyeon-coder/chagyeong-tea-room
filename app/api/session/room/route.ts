import { z } from "zod";
import { ROOM_IDS } from "@/lib/chagyeong-types";
import { chooseName, cleanupStale, getDatabase, getSessionRoom, json, ROOM_CAPACITY, STALE_AFTER_MS, verifySession } from "@/lib/server/presence";

const roomSchema = z.object({
  sessionId: z.string().uuid(),
  token: z.string().min(24).max(128),
  roomId: z.enum(ROOM_IDS),
});

export async function PUT(request: Request) {
  const parsed = roomSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ code: "INVALID_ROOM" }, { status: 400 });
  const input = parsed.data;
  if (!await verifySession(input.sessionId, input.token)) return json({ code: "INVALID_SESSION" }, { status: 401 });
  const currentRoom = await getSessionRoom(input.sessionId);
  if (!currentRoom) return json({ code: "INVALID_SESSION" }, { status: 401 });
  if (currentRoom === input.roomId) return json({ code: "SAME_ROOM" }, { status: 409 });

  const db = getDatabase();
  const now = Date.now();
  await cleanupStale(now);
  const targetPeople = await db.prepare(
    "SELECT display_name FROM rabbit_sessions WHERE room_id = ? AND updated_at >= ?",
  ).bind(input.roomId, now - STALE_AFTER_MS).all<{ display_name: string }>();
  if (targetPeople.results.length >= ROOM_CAPACITY) return json({ code: "ROOM_FULL" }, { status: 409 });
  const current = await db.prepare("SELECT display_name FROM rabbit_sessions WHERE id = ?")
    .bind(input.sessionId).first<{ display_name: string }>();
  const usedNames = new Set(targetPeople.results.map((row) => row.display_name));
  const displayName = current && !usedNames.has(current.display_name) ? current.display_name : chooseName(usedNames);
  const spawnX = -4 + Math.random() * 8;
  const spawnZ = 6.2 + Math.random() * 0.6;
  const result = await db.prepare(
    "UPDATE rabbit_sessions SET room_id = ?, display_name = ?, x = ?, z = ?, rotation = ?, state = 'walking', seat_id = NULL, ritual = 'idle', action_started_at = NULL, updated_at = ? WHERE id = ? AND (SELECT COUNT(*) FROM rabbit_sessions WHERE room_id = ? AND updated_at >= ?) < ?",
  ).bind(input.roomId, displayName, spawnX, spawnZ, Math.PI, now, input.sessionId, input.roomId, now - STALE_AFTER_MS, ROOM_CAPACITY).run();
  if (!result.meta.changes) return json({ code: "ROOM_FULL" }, { status: 409 });
  await db.prepare("DELETE FROM room_seats WHERE session_id = ?").bind(input.sessionId).run();
  return json({ roomId: input.roomId, displayName, spawn: { x: spawnX, z: spawnZ } });
}
