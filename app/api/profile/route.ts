import { z } from "zod";
import { cleanupStale, getDatabase, getSessionRoom, json, STALE_AFTER_MS, verifySession } from "@/lib/server/presence";

const profileSchema = z.object({
  sessionId: z.string().uuid(),
  token: z.string().min(24).max(128),
  displayName: z.string().trim().min(2).max(10).regex(/^[가-힣A-Za-z0-9 ]+$/),
});

export async function PUT(request: Request) {
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ code: "INVALID_NAME" }, { status: 400 });
  const input = parsed.data;
  if (!await verifySession(input.sessionId, input.token)) return json({ code: "INVALID_SESSION" }, { status: 401 });
  const roomId = await getSessionRoom(input.sessionId);
  if (!roomId) return json({ code: "INVALID_SESSION" }, { status: 401 });
  const now = Date.now();
  await cleanupStale(now);
  const duplicate = await getDatabase().prepare(
    "SELECT id FROM rabbit_sessions WHERE room_id = ? AND display_name = ? AND id <> ? AND updated_at >= ?",
  ).bind(roomId, input.displayName, input.sessionId, now - STALE_AFTER_MS).first();
  if (duplicate) return json({ code: "NAME_TAKEN" }, { status: 409 });
  await getDatabase().prepare("UPDATE rabbit_sessions SET display_name = ?, updated_at = ? WHERE id = ?")
    .bind(input.displayName, now, input.sessionId).run();
  return json({ displayName: input.displayName });
}
