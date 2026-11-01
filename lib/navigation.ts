import type { Vec2 } from "./chagyeong-types";

const CELL = 0.5;
const BOUNDS = { minX: -13.2, maxX: 13.2, minZ: -7.4, maxZ: 14.8 };
export type TablePosition = { x: number; z: number; kind: "shared" | "solo" };
export type SeatPosition = { id: string; table: number; kind: "shared" | "solo"; x: number; z: number; rotation: number };

export const TABLE_POSITIONS: readonly TablePosition[] = [
  { x: -7.5, z: -1.4, kind: "shared" as const },
  { x: 0, z: -1.4, kind: "shared" as const },
  { x: 7.5, z: -1.4, kind: "shared" as const },
  { x: 0, z: 4.4, kind: "shared" as const },
  { x: -12.1, z: -3.7, kind: "solo" as const },
  { x: -12.1, z: 2.4, kind: "solo" as const },
  { x: 12.1, z: -3.7, kind: "solo" as const },
  { x: 12.1, z: 2.4, kind: "solo" as const },
] as const;

export const SEAT_POSITIONS: SeatPosition[] = TABLE_POSITIONS.flatMap<SeatPosition>((tablePosition, table): SeatPosition[] => {
  const { x, z, kind } = tablePosition;
  if (kind === "solo") {
    const leftWall = x < 0;
    return [{ id: `seat-${17 + (table - 4)}`, table, kind, x: x + (leftWall ? 1.25 : -1.25), z, rotation: leftWall ? -Math.PI / 2 : Math.PI / 2 }];
  }
  return [
    { id: `seat-${table * 4 + 1}`, table, kind, x, z: z - 1.7, rotation: 0 },
    { id: `seat-${table * 4 + 2}`, table, kind, x: x + 1.7, z, rotation: -Math.PI / 2 },
    { id: `seat-${table * 4 + 3}`, table, kind, x, z: z + 1.7, rotation: Math.PI },
    { id: `seat-${table * 4 + 4}`, table, kind, x: x - 1.7, z, rotation: Math.PI / 2 },
  ];
});

function key(x: number, z: number) { return `${x},${z}`; }
function toGrid(v: number) { return Math.round(v / CELL); }
function toWorld(v: number) { return v * CELL; }

export function isWalkable(point: Vec2) {
  if (point.x < BOUNDS.minX || point.x > BOUNDS.maxX || point.z < BOUNDS.minZ || point.z > BOUNDS.maxZ) return false;
  const hitsTable = TABLE_POSITIONS.some((table) => Math.abs(point.x - table.x) < (table.kind === "solo" ? 0.6 : 1.45) && Math.abs(point.z - table.z) < (table.kind === "solo" ? 0.9 : 1.45));
  const hitsPond = point.z > 8.2 && point.x > 1.7 && point.x < 7.8;
  return !hitsTable && !hitsPond;
}

export function clampToRoom(point: Vec2): Vec2 {
  return {
    x: Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, point.x)),
    z: Math.max(BOUNDS.minZ, Math.min(BOUNDS.maxZ, point.z)),
  };
}

export function findPath(start: Vec2, target: Vec2): Vec2[] {
  const goal = clampToRoom(target);
  if (!isWalkable(goal)) return [];
  const sx = toGrid(start.x), sz = toGrid(start.z), gx = toGrid(goal.x), gz = toGrid(goal.z);
  const open = [{ x: sx, z: sz, score: 0 }];
  const came = new Map<string, string>();
  const cost = new Map<string, number>([[key(sx, sz), 0]]);
  const nodes = new Map<string, { x: number; z: number }>([[key(sx, sz), { x: sx, z: sz }]]);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

  while (open.length) {
    open.sort((a, b) => a.score - b.score);
    const current = open.shift()!;
    if (current.x === gx && current.z === gz) {
      const result: Vec2[] = [{ x: toWorld(gx), z: toWorld(gz) }];
      let cursor = key(gx, gz);
      while (came.has(cursor)) {
        cursor = came.get(cursor)!;
        const node = nodes.get(cursor)!;
        result.push({ x: toWorld(node.x), z: toWorld(node.z) });
      }
      return result.reverse().slice(1);
    }
    for (const [dx, dz] of directions) {
      const nx = current.x + dx, nz = current.z + dz;
      const world = { x: toWorld(nx), z: toWorld(nz) };
      if (!isWalkable(world)) continue;
      const nextKey = key(nx, nz);
      const nextCost = (cost.get(key(current.x, current.z)) ?? 0) + (dx && dz ? Math.SQRT2 : 1);
      if (nextCost >= (cost.get(nextKey) ?? Infinity)) continue;
      cost.set(nextKey, nextCost);
      came.set(nextKey, key(current.x, current.z));
      nodes.set(nextKey, { x: nx, z: nz });
      open.push({ x: nx, z: nz, score: nextCost + Math.abs(gx - nx) + Math.abs(gz - nz) });
    }
  }
  return [];
}
