// ALG-09: simulated road network and the distance matrix by Floyd–Warshall (SDD 5.9.9).
import type { Rng } from './prng';

export interface Point {
  id: string;
  lat: number;
  lon: number;
}

export interface Road {
  a: string;
  b: string;
  km: number;
  minutes: number;
}

/** Straight-line distance in km (haversine). */
export function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Equation (39): 50 km/h for roads up to 12 km, 70 km/h for longer roads. */
export function roadSpeedKmh(km: number): number {
  return km <= 12 ? 50 : 70;
}

/** Driving time of one road in minutes, Equation (39). */
export function roadMinutes(km: number): number {
  return (60 * km) / roadSpeedKmh(km);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Simulated roads: each point is linked to its 3 nearest neighbours; a road is longer than the
 * straight line by a seeded winding factor (1.15–1.40). Extra roads join any separate parts.
 */
export function buildRoads(points: Point[], rng: Rng, neighbours = 3): Road[] {
  const pairs = new Map<string, Road>();
  const addRoad = (a: Point, b: Point) => {
    const [x, y] = a.id < b.id ? [a, b] : [b, a];
    const key = `${x.id}|${y.id}`;
    if (pairs.has(key)) return;
    const km = round2(haversineKm(x, y) * rng.uniform(1.15, 1.4));
    pairs.set(key, { a: x.id, b: y.id, km, minutes: roadMinutes(km) });
  };

  const sorted = [...points].sort((p, q) => p.id.localeCompare(q.id));
  for (const p of sorted) {
    const nearest = sorted
      .filter((q) => q.id !== p.id)
      .sort((q1, q2) => haversineKm(p, q1) - haversineKm(p, q2) || q1.id.localeCompare(q2.id))
      .slice(0, neighbours);
    for (const q of nearest) addRoad(p, q);
  }

  // Join separate parts of the network with their closest pair of points.
  for (;;) {
    const parts = components(sorted, [...pairs.values()]);
    if (parts.length <= 1) break;
    const [first, ...others] = parts;
    let best: [Point, Point, number] | null = null;
    for (const p of first ?? [])
      for (const part of others)
        for (const q of part) {
          const d = haversineKm(p, q);
          if (!best || d < best[2]) best = [p, q, d];
        }
    if (!best) break;
    addRoad(best[0], best[1]);
  }

  return [...pairs.values()].sort((r, s) => (r.a + r.b).localeCompare(s.a + s.b));
}

function components(points: Point[], roads: Road[]): Point[][] {
  const parent = new Map(points.map((p) => [p.id, p.id]));
  const find = (id: string): string => {
    const up = parent.get(id) ?? id;
    if (up === id) return id;
    const root = find(up);
    parent.set(id, root);
    return root;
  };
  for (const r of roads) parent.set(find(r.a), find(r.b));
  const groups = new Map<string, Point[]>();
  for (const p of points) {
    const root = find(p.id);
    groups.set(root, [...(groups.get(root) ?? []), p]);
  }
  return [...groups.values()];
}

export interface DistanceMatrix {
  ids: string[];
  km: number[][];
  minutes: number[][];
  next: (number | null)[][];
}

/** Floyd–Warshall over all points (Equations 40–42): shortest road km and its driving time. */
export function floydWarshall(ids: string[], roads: Road[]): DistanceMatrix {
  const n = ids.length;
  const index = new Map(ids.map((id, i) => [id, i]));
  const km = ids.map((_, i) => ids.map((__, j) => (i === j ? 0 : Infinity)));
  const minutes = ids.map((_, i) => ids.map((__, j) => (i === j ? 0 : Infinity)));
  const next: (number | null)[][] = ids.map((_, i) => ids.map((__, j) => (i === j ? j : null)));

  for (const r of roads) {
    const i = index.get(r.a);
    const j = index.get(r.b);
    if (i === undefined || j === undefined) continue;
    for (const [x, y] of [
      [i, j],
      [j, i],
    ] as const) {
      km[x]![y] = r.km;
      minutes[x]![y] = r.minutes;
      next[x]![y] = y;
    }
  }

  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const via = km[i]![k]! + km[k]![j]!;
        if (via < km[i]![j]!) {
          km[i]![j] = via;
          minutes[i]![j] = minutes[i]![k]! + minutes[k]![j]!;
          next[i]![j] = next[i]![k]!;
        }
      }

  return { ids, km, minutes, next };
}

/** km (2 decimals) and whole minutes between two points. */
export function distance(
  m: DistanceMatrix,
  from: string,
  to: string,
): { km: number; minutes: number } {
  const i = m.ids.indexOf(from);
  const j = m.ids.indexOf(to);
  if (i < 0 || j < 0) throw new Error(`Unknown point ${from} or ${to}`);
  const km = m.km[i]![j]!;
  if (!Number.isFinite(km)) throw new Error(`No road between ${from} and ${to} (ERR-DATA-02)`);
  return { km: round2(km), minutes: Math.round(m.minutes[i]![j]!) };
}

/** The points of the shortest road from one point to another, both included. */
export function shortestPath(m: DistanceMatrix, from: string, to: string): string[] {
  let i = m.ids.indexOf(from);
  const j = m.ids.indexOf(to);
  if (m.next[i]?.[j] === null) return [];
  const path = [from];
  while (i !== j) {
    i = m.next[i]![j]!;
    path.push(m.ids[i]!);
  }
  return path;
}
