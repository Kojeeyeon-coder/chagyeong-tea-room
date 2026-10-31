import { chooseName, chooseVariant, cleanupStale, getDatabase, hashToken, json, randomToken, ROOM_CAPACITY, ROOM_ID, STALE_AFTER_MS } from "@/lib/server/presence";

export async function POST() {
  const db = getDatabase();
  const now = Date.now();
  await cleanupStale(now);
  const active = await db.prepare(
    "SELECT display_name FROM rabbit_sessions WHERE room_id = ? AND updated_at >= ?",
  ).bind(ROOM_ID, now - STALE_AFTER_MS).all<{ display_name: string }>();

  if (active.results.length >= ROOM_CAPACITY) {
    return json({ code: "ROOM_FULL", message: "다실이 잠시 가득 찼어요." }, { status: 409 });
  }

  const sessionId = crypto.randomUUID();
  const token = randomToken();
  const tokenHash = await hashToken(token);
  const displayName = chooseName(new Set(active.results.map((row) => row.display_name)));
  const variant = chooseVariant();
  const spawnX = -6.5 + Math.random() * 2;
  const spawnZ = 10.4 + Math.random() * 1.5;

  await db.prepare(
    "INSERT INTO rabbit_sessions (id, token_hash, display_name, variant, room_id, x, z, rotation, state, ritual, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'walking', 'idle', ?)",
  ).bind(sessionId, tokenHash, displayName, variant, ROOM_ID, spawnX, spawnZ, Math.PI, now).run();

  return json({ sessionId, token, displayName, variant, roomId: ROOM_ID, spawn: { x: spawnX, z: spawnZ } }, { status: 201 });
}
