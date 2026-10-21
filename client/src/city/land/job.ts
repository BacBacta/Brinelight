/**
 * What the land asks of its worker (land.worker.ts), or of this thread when there is none: plain numbers in and out, no
 * three.js. A land: its mesh's arrays and coast, the ground under the points asked for (its plants and props), where
 * the landfill's stakes stand, and the shore's grid. A shore: the distances of the water to the land and the discs (the
 * foam), from the last grid it was given.
 */
import { SHORE, markLand, shoreDistances, type Disc } from "../../scene/shoreGrid.js";
import { ground, landDepth, type LandSlots } from "./field.js";
import { landData, type LandData } from "./meshData.js";

export type LandJob = {
  kind: "land";
  id: number;
  L: LandSlots;
  /** Build the mesh (false: only the ground under the points). */
  mesh: boolean;
  /** x, z of each point whose ground is asked for. */
  points: Float32Array;
  /** The water's rest level, for the shore's grid. */
  waterY: number;
};
export type ShoreJob = { kind: "shore"; id: number; grid: Uint8Array | null; discs: Disc[] };
export type Job = LandJob | ShoreJob;

export type LandDone = {
  kind: "land";
  id: number;
  data: LandData | null;
  /** y, depth of each point asked for. */
  heights: Float32Array;
  /** x, z of each stake around the landfill, on the water's side. */
  fillStakes: Float32Array;
  grid: Uint8Array | null;
  /** How long it took, in ms. */
  ms: number;
};
export type ShoreDone = { kind: "shore"; id: number; distances: Uint8Array; ms: number };
export type Done = LandDone | ShoreDone;

/** The grid the distances are measured from (the worker keeps it between jobs). */
let grid: Uint8Array | null = null;

/** The landfill's stakes: all around its slot, where the land without it is water. */
function fillStakes(L: LandSlots): Float32Array {
  const f = L.filling;
  if (!f) return new Float32Array(0);
  const without = { ...L, filling: null, won: L.won.filter((w) => w.x !== f.x || w.z !== f.z) };
  const out: number[] = [];
  for (let j = 0; j < 30; j++) {
    const a = (j / 30) * Math.PI * 2;
    const x = f.x + Math.cos(a) * 1.08;
    const z = f.z + Math.sin(a) * 1.08;
    if (landDepth(x, z, without).depth <= 0.1) out.push(x, z);
  }
  return new Float32Array(out);
}

export function runJob(job: Job): Done {
  const t = performance.now();
  if (job.kind === "shore") {
    if (job.grid) grid = job.grid;
    const distances = grid ? shoreDistances(grid, job.discs) : new Uint8Array(SHORE.size * SHORE.size).fill(255);
    return { kind: "shore", id: job.id, distances, ms: performance.now() - t };
  }
  const data = job.mesh ? landData(job.L) : null;
  const heights = new Float32Array(job.points.length);
  for (let k = 0; k < job.points.length; k += 2) {
    const g = ground(job.points[k]!, job.points[k + 1]!, job.L);
    heights[k] = g.y;
    heights[k + 1] = g.depth;
  }
  const land = data ? markLand(new Uint8Array(SHORE.size * SHORE.size), data.position, data.index, job.waterY) : null;
  return { kind: "land", id: job.id, data, heights, fillStakes: fillStakes(job.L), grid: land, ms: performance.now() - t };
}

/** What a job's answer hands over without a copy. */
export function transfers(done: Done): Transferable[] {
  if (done.kind === "shore") return [done.distances.buffer];
  const out: Transferable[] = [done.heights.buffer, done.fillStakes.buffer];
  if (done.grid) out.push(done.grid.buffer);
  if (done.data) for (const a of [done.data.position, done.data.normal, done.data.uv, done.data.shore, done.data.marks, done.data.index]) out.push(a.buffer);
  return out;
}
