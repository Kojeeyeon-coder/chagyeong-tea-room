import type { Vec2 } from "./chagyeong-types";

const CELL = 0.5;
const BOUNDS = { minX: -9, maxX: 9, minZ: -6, maxZ: 13 };
const TABLES = [
  [-5, -2.6], [0, -2.6], [5, -2.6],
  [-5, 3], [0, 3], [5, 3],
] as const;

export const TABLE_POSITIONS = TABLES.map(([x, z]) => ({ x, z }));
export const SEAT_POSITIONS = TABLES.flatMap(([x, z], table) => [
  { id: `seat-${table * 2 + 1}`, table, x, z: z - 1.25, rotation: 0 },
  { id: `seat-${table * 2 + 2}`, table, x, z: z + 1.25, rotation: Math.PI },
]);

function key(x: number, z: number) { return `${x},${z}`; }
function toGrid(v: number) { return Math.round(v / CELL); }
function toWorld(v: number) { return v * CELL; }

export function isWalkable(point: Vec2) {
  if (point.x < BOUNDS.minX || point.x > BOUNDS.maxX || point.z < BOUNDS.minZ || point.z > BOUNDS.maxZ) return false;
  const hitsTable = TABLES.some(([x, z]) => Math.abs(point.x - x) < 1.35 && Math.abs(point.z - z) < 0.95);
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
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

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
      const nextCost = (cost.get(key(current.x, current.z)) ?? 0) + 1;
      if (nextCost >= (cost.get(nextKey) ?? Infinity)) continue;
      cost.set(nextKey, nextCost);
      came.set(nextKey, key(current.x, current.z));
      nodes.set(nextKey, { x: nx, z: nz });
      open.push({ x: nx, z: nz, score: nextCost + Math.abs(gx - nx) + Math.abs(gz - nz) });
    }
  }
  return [];
}
