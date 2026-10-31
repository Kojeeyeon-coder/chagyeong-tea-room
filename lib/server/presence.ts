import { env } from "cloudflare:workers";
import type { PresenceSnapshot, RabbitVariant, RoomSnapshot } from "@/lib/chagyeong-types";
import { RABBIT_VARIANTS } from "@/lib/chagyeong-types";
import { choosePoeticName } from "@/lib/name-generator";

export const ROOM_ID = "main" as const;
export const ROOM_CAPACITY = 20;
export const STALE_AFTER_MS = 10_000;

export function getDatabase(): D1Database {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...init?.headers },
  });
}

export async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function chooseName(used: Set<string>) {
  return choosePoeticName(used);
}

export function chooseVariant(): RabbitVariant {
  return RABBIT_VARIANTS[Math.floor(Math.random() * RABBIT_VARIANTS.length)];
}

export async function cleanupStale(now = Date.now()) {
  const db = getDatabase();
  const cutoff = now - STALE_AFTER_MS;
  await db.batch([
    db.prepare("DELETE FROM room_seats WHERE updated_at < ?").bind(cutoff),
    db.prepare("DELETE FROM rabbit_sessions WHERE updated_at < ?").bind(cutoff),
  ]);
}

export async function verifySession(sessionId: string, token: string) {
  const row = await getDatabase().prepare("SELECT token_hash FROM rabbit_sessions WHERE id = ?").bind(sessionId).first<{ token_hash: string }>();
  if (!row) return false;
  return row.token_hash === await hashToken(token);
}

type SessionRow = {
  id: string;
  display_name: string;
  variant: RabbitVariant;
  room_id: "main";
  x: number;
  z: number;
  rotation: number;
  state: PresenceSnapshot["state"];
  seat_id: string | null;
  tea: PresenceSnapshot["tea"];
  teaware: PresenceSnapshot["teaware"];
  ritual: PresenceSnapshot["ritual"];
  action_started_at: number | null;
  updated_at: number;
};

export async function getRoomSnapshot(): Promise<RoomSnapshot> {
  const db = getDatabase();
  const now = Date.now();
  await cleanupStale(now);
  const peopleResult = await db.prepare(
    "SELECT id, display_name, variant, room_id, x, z, rotation, state, seat_id, tea, teaware, ritual, action_started_at, updated_at FROM rabbit_sessions WHERE room_id = ? AND updated_at >= ? ORDER BY updated_at DESC",
  ).bind(ROOM_ID, now - STALE_AFTER_MS).all<SessionRow>();
  const seatsResult = await db.prepare(
    "SELECT seat_id, session_id FROM room_seats WHERE room_id = ? AND updated_at >= ?",
  ).bind(ROOM_ID, now - STALE_AFTER_MS).all<{ seat_id: string; session_id: string }>();

  return {
    people: peopleResult.results.map((row) => ({
      sessionId: row.id,
      displayName: row.display_name,
      variant: row.variant,
      roomId: row.room_id,
      position: { x: row.x, z: row.z },
      rotation: row.rotation,
      state: row.state,
      seatId: row.seat_id,
      tea: row.tea,
      teaware: row.teaware,
      ritual: row.ritual,
      actionStartedAt: row.action_started_at,
      updatedAt: row.updated_at,
    })),
    occupiedSeats: Object.fromEntries(seatsResult.results.map((seat) => [seat.seat_id, seat.session_id])),
    serverTime: now,
  };
}
