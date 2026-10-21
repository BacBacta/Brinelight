/**
 * The island's coast follows the hex grid (week 8): its land stops just short of the rooms of the rafts moored on ring 3,
 * so they float clear of it on a strip of water, and it still carries the plots of rings 0 to 2. The walkways of the
 * rafts of ring 3 reach it. Display only.
 */
import { RAFT_SLOTS } from "@brinelight/shared";
import { hexX, hexZ } from "./island.js";

/** The room of a raft (city/rafts.ts): the hexagon of its slot shrunk to this share. */
export const RAFT_FILL = 0.82;
/** Water kept between the coast and a raft's room. */
export const COAST_GAP = 0.1;

const RING3 = RAFT_SLOTS.filter((s) => s.ring === 3).map((s) => ({ x: hexX(s.q, s.r), z: hexZ(s.r) }));
// The pier's slot of ring 3 is kept clear too: the pier starts there.
RING3.push({ x: hexX(1, -3), z: hexZ(-3) });

/** Hex distance with the slots' orientation: a slot's sides are 1 from its center. */
const hexReach = (x: number, z: number) => Math.max(Math.abs(x), Math.abs(x / 2 + z * 0.866), Math.abs(-x / 2 + z * 0.866));

/** How far from the center the first raft room of ring 3 begins, in the direction `angle` (radians, from +x toward +z). */
export function raftsEdge(angle: number): number {
  const [dx, dz] = [Math.cos(angle), Math.sin(angle)];
  const inside = (d: number) => RING3.some((c) => hexReach(dx * d - c.x, dz * d - c.z) <= RAFT_FILL);
  let d = 3.5;
  while (d < 7 && !inside(d)) d += 0.02;
  let [lo, hi] = [d - 0.02, d];
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (inside(mid)) hi = mid;
    else lo = mid;
  }
  return lo;
}

const PLOTS: { x: number; z: number }[] = [];
for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2) PLOTS.push({ x: hexX(q, r), z: hexZ(r) });
/** Where a building may stand on its plot (PLOT_ROOM in buildings.ts): the land must reach past it. */
const PLOT_ROOM = 0.95;
/** Land kept past the plots' rooms, so a building on the rim stands on the meadow, not on its slope. */
export const PLOT_LAND = 0.35;

/** How far from the center the rooms of the plots of rings 0 to 2 reach, in the direction `angle`. */
export function plotsEdge(angle: number): number {
  const [dx, dz] = [Math.cos(angle), Math.sin(angle)];
  const inside = (d: number) => PLOTS.some((c) => hexReach(dx * d - c.x, dz * d - c.z) <= PLOT_ROOM);
  let d = 6;
  while (d > 3 && !inside(d)) d -= 0.02;
  return d;
}

const STEPS = 720;
/**
 * The coast, every half degree: COAST_GAP short of the rafts' rooms (the gaps between two rafts are not followed into),
 * but never closer in than PLOT_LAND past the plots' rooms. Where the two meet, the plots win.
 */
const COAST: number[] = (() => {
  const around = (list: number[], pick: (...v: number[]) => number) => list.map((_, i) => pick(...Array.from({ length: 17 }, (_, k) => list[(i + k - 8 + STEPS) % STEPS]!)));
  const angles = Array.from({ length: STEPS }, (_, i) => (i / STEPS) * 2 * Math.PI);
  const rafts = around(angles.map((a) => raftsEdge(a) - COAST_GAP), Math.min);
  const plots = around(angles.map((a) => plotsEdge(a) + PLOT_LAND), Math.max);
  return rafts.map((r, i) => Math.max(r, plots[i]!));
})();

/** Where the coast falls in the direction `angle`. */
export const coastAt = (angle: number): number => COAST[Math.round((((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / ((2 * Math.PI) / STEPS)) % STEPS]!;
