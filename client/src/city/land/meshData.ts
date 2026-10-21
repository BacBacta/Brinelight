/**
 * The land's one mesh (owner, step 2 of the land won on the sea): the island and every slot won, built again in the
 * game whenever the slots change, from field.ts. A lattice of 0.25 where a coast may run, coarse (0.5)
 * on the meadow and far out at sea, the fine vertices on a coarse cell's side set on its straight line (no crack). Each
 * vertex carries what colors its ground (its depth from the coast, whose coast it is, cliff, mud, fresh earth): the
 * shader paints the shore from it over the one texture of the whole land. The coast itself comes out as segments
 * (marching squares on the fine cells), where the dike stands. Plain arrays, no three.js: the land's worker builds it
 * (land.worker.ts), mesh.ts makes it a geometry.
 */
import { SEA, breach, ground, hexReach, islandAt, landDepth, type IslandAt, type LandSlots } from "./field.js";

/** The land and its skirt under the sea fit in -SPAN..SPAN on x and z (ring 4's slots reach 9.2 from the center). */
export const SPAN = 10.5;
/** The fine lattice's step, and how many of them a coarse cell spans (0.5). */
export const STEP = 0.25;
const FINE = 2;
const N = Math.round((2 * SPAN) / STEP) + 1;
const CELLS = (N - 1) / FINE;
/** A cell whose corners lie this close to a coast (|depth|) is drawn fine: no coast crosses a coarse one. */
const NEAR = 0.6;
/** Below this, the sea floor is never seen: its cells are left out. */
const DEEP = -1.05;

/** The island's field at each lattice point, computed once, when first needed. */
const islandCache: (IslandAt | undefined)[] = new Array(N * N);
const islandOf = (i: number, j: number): IslandAt => (islandCache[j * N + i] ??= islandAt(-SPAN + i * STEP, -SPAN + j * STEP));

/**
 * A piece of coast between two points, and whether it is the land won's (where the dike stands); for the land won's,
 * the side out to sea (`nx`, `nz`: where the land's field falls).
 */
export type CoastSegment = { ax: number; az: number; bx: number; bz: number; won: boolean; nx: number; nz: number };

/** The land's mesh as arrays (normals included), its coast and its triangles. */
export type LandData = {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  shore: Float32Array;
  marks: Float32Array;
  index: Uint32Array;
  coast: CoastSegment[];
  triangles: number;
};

/** The normals of an indexed mesh, each vertex's the sum of its faces' (weighted by their area), as three.js computes them. */
function normalsOf(pos: Float32Array, index: Uint32Array): Float32Array {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t]! * 3;
    const b = index[t + 1]! * 3;
    const c = index[t + 2]! * 3;
    const cbx = pos[c]! - pos[b]!, cby = pos[c + 1]! - pos[b + 1]!, cbz = pos[c + 2]! - pos[b + 2]!;
    const abx = pos[a]! - pos[b]!, aby = pos[a + 1]! - pos[b + 1]!, abz = pos[a + 2]! - pos[b + 2]!;
    const x = cby * abz - cbz * aby;
    const y = cbz * abx - cbx * abz;
    const z = cbx * aby - cby * abx;
    for (const v of [a, b, c]) {
      n[v] = n[v]! + x;
      n[v + 1] = n[v + 1]! + y;
      n[v + 2] = n[v + 2]! + z;
    }
  }
  for (let v = 0; v < n.length; v += 3) {
    const l = Math.hypot(n[v]!, n[v + 1]!, n[v + 2]!) || 1;
    n[v] = n[v]! / l;
    n[v + 1] = n[v + 1]! / l;
    n[v + 2] = n[v + 2]! / l;
  }
  return n;
}

/** The land of these slots: its mesh's arrays, its coast, its triangles. */
export function landData(L: LandSlots): LandData {
  const depth = new Float32Array(N * N).fill(NaN);
  const g: (ReturnType<typeof ground> | undefined)[] = new Array(N * N);
  const at = (i: number, j: number) => {
    const k = j * N + i;
    let v = g[k];
    if (!v) {
      v = g[k] = ground(-SPAN + i * STEP, -SPAN + j * STEP, L, islandOf(i, j));
      depth[k] = v.depth;
    }
    return v;
  };
  // Which coarse cells are fine (a coast near), which are drawn at all (not deep under the sea).
  const fine = new Uint8Array(CELLS * CELLS);
  const drawn = new Uint8Array(CELLS * CELLS);
  for (let cj = 0; cj < CELLS; cj++)
    for (let ci = 0; ci < CELLS; ci++) {
      const corners = [at(ci * FINE, cj * FINE), at((ci + 1) * FINE, cj * FINE), at(ci * FINE, (cj + 1) * FINE), at((ci + 1) * FINE, (cj + 1) * FINE)];
      const c = cj * CELLS + ci;
      fine[c] = corners.some((v) => Math.abs(v.depth) < NEAR) || corners.some((v) => v.depth > 0) !== corners.every((v) => v.depth > 0) ? 1 : 0;
      drawn[c] = fine[c] || corners.some((v) => v.y > DEEP) ? 1 : 0;
    }
  // A fine cell's inner points are needed too: their deep test is the cell's.
  const ids = new Int32Array(N * N).fill(-1);
  const pos: number[] = [];
  const uv: number[] = [];
  const shore: number[] = [];
  const marks: number[] = [];
  const vertex = (i: number, j: number, y?: number) => {
    const k = j * N + i;
    if (ids[k]! >= 0) return ids[k]!;
    const v = at(i, j);
    const x = -SPAN + i * STEP;
    const z = -SPAN + j * STEP;
    ids[k] = pos.length / 3;
    pos.push(x, y ?? v.y, z);
    uv.push((x + SPAN) / (2 * SPAN), (z + SPAN) / (2 * SPAN));
    shore.push(v.depth, v.mine, v.cliff, v.plot > 1.0 ? 1 : 0);
    marks.push(v.mud, v.fresh);
    return ids[k]!;
  };
  const isCoarse = (ci: number, cj: number) => ci >= 0 && cj >= 0 && ci < CELLS && cj < CELLS && drawn[cj * CELLS + ci] === 1 && fine[cj * CELLS + ci] === 0;
  // The height a fine cell's side point takes when the cell beside it is coarse: on that cell's straight side.
  const snapped = (ci: number, cj: number, a: number, b: number, side: "w" | "e" | "n" | "s"): number | undefined => {
    const [ni, nj] = side === "w" ? [ci - 1, cj] : side === "e" ? [ci + 1, cj] : side === "n" ? [ci, cj - 1] : [ci, cj + 1];
    if (!isCoarse(ni, nj)) return undefined;
    const i0 = ci * FINE;
    const j0 = cj * FINE;
    if (side === "w" || side === "e") {
      const i = side === "w" ? i0 : i0 + FINE;
      const t = (b - j0) / FINE;
      return at(i, j0).y * (1 - t) + at(i, j0 + FINE).y * t;
    }
    const j = side === "n" ? j0 : j0 + FINE;
    const t = (a - i0) / FINE;
    return at(i0, j).y * (1 - t) + at(i0 + FINE, j).y * t;
  };
  const index: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => index.push(a, c, b, b, c, d);
  for (let cj = 0; cj < CELLS; cj++)
    for (let ci = 0; ci < CELLS; ci++) {
      const c = cj * CELLS + ci;
      if (!drawn[c]) continue;
      const i0 = ci * FINE;
      const j0 = cj * FINE;
      if (!fine[c]) {
        quad(vertex(i0, j0), vertex(i0 + FINE, j0), vertex(i0, j0 + FINE), vertex(i0 + FINE, j0 + FINE));
        continue;
      }
      for (let b = 0; b < FINE; b++)
        for (let a = 0; a < FINE; a++) {
          const v = (da: number, db: number) => {
            const i = i0 + a + da;
            const j = j0 + b + db;
            // Not on a corner of the coarse lattice, but on its side: snapped onto a coarse neighbor's line.
            let y: number | undefined;
            if ((i - i0) % FINE !== 0 || (j - j0) % FINE !== 0) {
              if (i === i0) y = snapped(ci, cj, i, j, "w");
              else if (i === i0 + FINE) y = snapped(ci, cj, i, j, "e");
              else if (j === j0) y = snapped(ci, cj, i, j, "n");
              else if (j === j0 + FINE) y = snapped(ci, cj, i, j, "s");
            }
            return vertex(i, j, y);
          };
          quad(v(0, 0), v(1, 0), v(0, 1), v(1, 1));
        }
    }
  const position = new Float32Array(pos);
  const indices = new Uint32Array(index);
  return {
    position,
    normal: normalsOf(position, indices),
    uv: new Float32Array(uv),
    shore: new Float32Array(shore),
    marks: new Float32Array(marks),
    index: indices,
    coast: coastOf(L, fine, at, depth),
    triangles: index.length / 3,
  };
}

/**
 * The coast: where the depth crosses 0 on the fine cells' squares (marching squares), each piece flagged when it is the
 * land won's and outside a flooded slot's breach and the landfill (the dike stands there).
 */
function coastOf(L: LandSlots, fine: Uint8Array, at: (i: number, j: number) => { depth: number; mine: number }, depth: Float32Array): CoastSegment[] {
  const out: CoastSegment[] = [];
  const d = (i: number, j: number) => {
    const k = j * N + i;
    return Number.isNaN(depth[k]!) ? at(i, j).depth : depth[k]!;
  };
  const cross = (i0: number, j0: number, i1: number, j1: number): [number, number] => {
    const a = d(i0, j0);
    const b = d(i1, j1);
    const t = a / (a - b);
    return [-SPAN + (i0 + (i1 - i0) * t) * STEP, -SPAN + (j0 + (j1 - j0) * t) * STEP];
  };
  for (let cj = 0; cj < CELLS; cj++)
    for (let ci = 0; ci < CELLS; ci++) {
      if (!fine[cj * CELLS + ci]) continue;
      for (let b = 0; b < FINE; b++)
        for (let a = 0; a < FINE; a++) {
          const i = ci * FINE + a;
          const j = cj * FINE + b;
          // Corners: 0 (i, j), 1 (i+1, j), 2 (i+1, j+1), 3 (i, j+1); edges between them, in order.
          const c = [d(i, j) > 0, d(i + 1, j) > 0, d(i + 1, j + 1) > 0, d(i, j + 1) > 0];
          const edges: [number, number, number, number][] = [
            [i, j, i + 1, j],
            [i + 1, j, i + 1, j + 1],
            [i + 1, j + 1, i, j + 1],
            [i, j + 1, i, j],
          ];
          const hits = edges.filter((_, e) => c[e] !== c[(e + 1) % 4]).map((e) => cross(...e));
          const pairs: [[number, number], [number, number]][] = [];
          if (hits.length === 2) pairs.push([hits[0]!, hits[1]!]);
          else if (hits.length === 4) {
            // A saddle: joined by the center's side, so that every piece of coast stays one closed line.
            const center = (d(i, j) + d(i + 1, j) + d(i + 1, j + 1) + d(i, j + 1)) / 4 > 0;
            if (center === c[0]) pairs.push([hits[0]!, hits[1]!], [hits[2]!, hits[3]!]);
            else pairs.push([hits[3]!, hits[0]!], [hits[1]!, hits[2]!]);
          }
          for (const [[ax, az], [bx, bz]] of pairs) {
            const mx = (ax + bx) / 2;
            const mz = (az + bz) / 2;
            const won = landDepth(mx, mz, L).mine > 0.5 && breach(mx, mz, L.flooded) < 0.3 && !(L.filling && hexReach(mx - L.filling.x, mz - L.filling.z) < 1.15);
            let nx = 0;
            let nz = 0;
            const len = Math.hypot(bx - ax, bz - az);
            if (won && len > 1e-4) {
              nx = (bz - az) / len;
              nz = -(bx - ax) / len;
              if (landDepth(mx + nx * 0.05, mz + nz * 0.05, L).depth > landDepth(mx - nx * 0.05, mz - nz * 0.05, L).depth) (nx = -nx), (nz = -nz);
            }
            out.push({ ax, az, bx, bz, won, nx, nz });
          }
        }
    }
  return out;
}

/** The coast's pieces chained into lines; `closed`: every line comes back to its start (no loose end anywhere). */
export function coastLines(coast: readonly CoastSegment[]): { lines: number; closed: boolean } {
  const key = (x: number, z: number) => `${Math.round(x * 1e4)},${Math.round(z * 1e4)}`;
  const ends = new Map<string, number>();
  for (const s of coast) for (const k of [key(s.ax, s.az), key(s.bx, s.bz)]) ends.set(k, (ends.get(k) ?? 0) + 1);
  const closed = [...ends.values()].every((n) => n % 2 === 0);
  // Lines: the pieces joined at their shared ends (union of ends).
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r) ?? r;
    parent.set(k, r);
    return r;
  };
  for (const k of ends.keys()) parent.set(k, k);
  for (const s of coast) {
    const a = find(key(s.ax, s.az));
    const b = find(key(s.bx, s.bz));
    if (a !== b) parent.set(a, b);
  }
  const roots = new Set([...ends.keys()].map(find));
  return { lines: roots.size, closed };
}

/** Whether a point stands above the sea on this land (its depth and its ground), for tests. */
export const aboveSea = (x: number, z: number, L: LandSlots): boolean => ground(x, z, L).y > SEA;
