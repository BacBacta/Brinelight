/**
 * The island's coast follows the hex grid (week 8): its land stops just short of the rooms of the rafts moored on ring 3,
 * so they float clear of it on a strip of water, and it still carries the plots of rings 0 to 2. The island's model is
 * round; `shapeCoast` moves its rim in or out, direction by direction, onto that line. Display only.
 */
import * as THREE from "three";
import { RAFT_SLOTS } from "@brinelight/shared";
import { hexX, hexZ } from "./island.js";

/** The room of a raft (city/rafts.ts): the hexagon of its slot shrunk to this share. */
export const RAFT_FILL = 0.82;
/** Water kept between the coast and a raft's room. */
export const COAST_GAP = 0.1;
/** The water's rest level: land is what stands above it (shore.ts). */
const WATER_Y = -0.42;

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
 * but never closer in than PLOT_LAND past the plots' rooms. Where the two meet, the plots win: a raft's corner may then
 * touch the beach, until the island's model is made to the grid (docs/raft-models.md).
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

const BINS = 360;
const binOf = (angle: number) => Math.round((((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / ((2 * Math.PI) / BINS)) % BINS;

/**
 * Moves the island's rim onto the coast: in each direction, its shore (the farthest point of it above the water) goes to
 * `coastAt`, what lies beyond goes with it, and the meadow inside is moved less and less toward the middle, where nothing
 * moves. `island` is the island as fitIsland placed it; its geometry is changed in place.
 */
export function shapeCoast(island: THREE.Object3D): void {
  island.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  island.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh));
  // Three times: each pass corrects what the one before moved only in part (where a triangle spans several directions).
  for (let pass = 0; pass < 3; pass++) moveRim(meshes, shoreOf(meshes));
}

/**
 * The shore of the model, direction by direction: the farthest point where its surface leaves the water, on its vertices
 * above the water and where its edges cross the water's level.
 */
function shoreOf(meshes: readonly THREE.Mesh[]): Float32Array {
  const shore = new Float32Array(BINS);
  const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const mark = (x: number, z: number) => {
    const bin = binOf(Math.atan2(z, x));
    shore[bin] = Math.max(shore[bin]!, Math.hypot(x, z));
  };
  for (const m of meshes) {
    const pos = m.geometry.getAttribute("position");
    const index = m.geometry.index;
    const count = index ? index.count : pos.count;
    for (let t = 0; t < count; t += 3) {
      const tri = [a, b, c].map((v, k) => v.fromBufferAttribute(pos, index ? index.getX(t + k) : t + k).applyMatrix4(m.matrixWorld));
      for (let k = 0; k < 3; k++) {
        const p = tri[k]!;
        const q = tri[(k + 1) % 3]!;
        if (p.y >= WATER_Y) mark(p.x, p.z);
        if ((p.y - WATER_Y) * (q.y - WATER_Y) < 0) {
          const f = (WATER_Y - p.y) / (q.y - p.y);
          mark(p.x + (q.x - p.x) * f, p.z + (q.z - p.z) * f);
        }
      }
    }
  }
  // A bin without a point takes its neighbors' shore.
  for (let bin = 0; bin < BINS; bin++) if (!shore[bin]) shore[bin] = Math.max(shore[(bin + BINS - 1) % BINS]!, shore[(bin + 1) % BINS]!);
  return shore;
}

/** Moves every vertex out or in from the center so that the shore `shore` falls on the coast. */
function moveRim(meshes: readonly THREE.Mesh[], shore: Float32Array): void {
  const v = new THREE.Vector3();
  const target = Array.from({ length: BINS }, (_, b) => coastAt((b / BINS) * 2 * Math.PI));
  const inverse = new THREE.Matrix4();
  for (const m of meshes) {
    const pos = m.geometry.getAttribute("position");
    const out = new Float32Array(pos.count * 3);
    inverse.copy(m.matrixWorld).invert();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const r = Math.hypot(v.x, v.z);
      const b = binOf(Math.atan2(v.z, v.x));
      const s = shore[b]!;
      // Untouched up to 60 % of the shore's distance, fully moved from the shore outward.
      const w = THREE.MathUtils.smoothstep(r, s * 0.6, s);
      const k = 1 + (target[b]! / s - 1) * w;
      v.set(v.x * k, v.y, v.z * k).applyMatrix4(inverse);
      out.set([v.x, v.y, v.z], i * 3);
    }
    m.geometry.setAttribute("position", new THREE.BufferAttribute(out, 3));
    m.geometry.computeBoundingBox();
    m.geometry.computeBoundingSphere();
  }
}
