import { chooseName, chooseVariant, cleanupStale, getDatabase, hashToken, json, randomToken, ROOM_CAPACITY, ROOM_IDS_LIST, STALE_AFTER_MS } from "@/lib/server/presence";

export async function POST() {
  const db = getDatabase();
  const now = Date.now();
  await cleanupStale(now);
  const allActive = await db.prepare(
    "SELECT display_name, room_id FROM rabbit_sessions WHERE updated_at >= ?",
  ).bind(now - STALE_AFTER_MS).all<{ display_name: string; room_id: string }>();
  const roomId = ROOM_IDS_LIST.find((candidate) => allActive.results.filter((row) => row.room_id === candidate).length < ROOM_CAPACITY) ?? ROOM_IDS_LIST[ROOM_IDS_LIST.length - 1];
  const active = allActive.results.filter((row) => row.room_id === roomId);

  if (active.length >= ROOM_CAPACITY) {
    return json({ code: "ROOM_FULL", message: "다실이 잠시 가득 찼어요." }, { status: 409 });
  }

  const sessionId = crypto.randomUUID();
  const token = randomToken();
  const tokenHash = await hashToken(token);
  const displayName = chooseName(new Set(active.map((row) => row.display_name)));
  const variant = chooseVariant();
  const spawnX = -4 + Math.random() * 8;
  const spawnZ = 6.2 + Math.random() * 0.6;

  await db.prepare(
    "INSERT INTO rabbit_sessions (id, token_hash, display_name, variant, room_id, x, z, rotation, state, ritual, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'walking', 'idle', ?)",
  ).bind(sessionId, tokenHash, displayName, variant, roomId, spawnX, spawnZ, Math.PI, now).run();

  return json({ sessionId, token, displayName, variant, roomId, spawn: { x: spawnX, z: spawnZ } }, { status: 201 });
}
