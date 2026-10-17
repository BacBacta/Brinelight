/**
 * The shore of the city's water (week 6, task 4): how far each point of the water lies from the island and from the
 * rafts moored around it, on a grid the water's shader reads to draw its foam. Built on the CPU from the island's
 * triangles (no extra render pass, no texture file), and built again only when the moored rafts change.
 */
import * as THREE from "three";

export const SHORE = {
  /** Cells on each side of the grid. */
  size: 256,
  /** The grid covers -extent to +extent on x and z: the island and the rafts of ring 4 (8 from the center), with room. */
  extent: 10.24,
  /** Distances are kept up to this many meters; farther is "open water". */
  reach: 2,
  /** The water's rest level: land is what stands above it. */
  waterY: -0.42,
} as const;

/** A round thing in the water the foam goes around: a raft, the shipyard at work. */
export type Disc = { x: number; z: number; r: number };

const cell = (2 * SHORE.extent) / SHORE.size;

/**
 * The cells of the grid where the island stands above the water: 1, else 0. A cell is land when some triangle of the
 * island, seen from above, covers its center at or above the water's level.
 */
export function landOf(island: THREE.Object3D): Uint8Array {
  const n = SHORE.size;
  const land = new Uint8Array(n * n);
  island.updateMatrixWorld(true);
  const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  island.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    const index = mesh.geometry.index;
    const count = index ? index.count : pos.count;
    for (let t = 0; t < count; t += 3) {
      [a, b, c].forEach((v, k) => v.fromBufferAttribute(pos, index ? index.getX(t + k) : t + k).applyMatrix4(mesh.matrixWorld));
      if (Math.max(a.y, b.y, c.y) < SHORE.waterY) continue;
      const area = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
      if (Math.abs(area) < 1e-12) continue;
      const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) + SHORE.extent) / cell));
      const i1 = Math.min(n - 1, Math.floor((Math.max(a.x, b.x, c.x) + SHORE.extent) / cell));
      const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z, c.z) + SHORE.extent) / cell));
      const j1 = Math.min(n - 1, Math.floor((Math.max(a.z, b.z, c.z) + SHORE.extent) / cell));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          if (land[j * n + i]) continue;
          const x = -SHORE.extent + (i + 0.5) * cell;
          const z = -SHORE.extent + (j + 0.5) * cell;
          // Barycentric weights of (x, z) in the triangle seen from above.
          const wb = ((x - a.x) * (c.z - a.z) - (c.x - a.x) * (z - a.z)) / area;
          const wc = ((b.x - a.x) * (z - a.z) - (x - a.x) * (b.z - a.z)) / area;
          const wa = 1 - wb - wc;
          if (wa < 0 || wb < 0 || wc < 0) continue;
          if (wa * a.y + wb * b.y + wc * c.y >= SHORE.waterY) land[j * n + i] = 1;
        }
    }
  });
  return land;
}

/**
 * The distance of each cell to the land and the discs, in meters, coded 0 to 255 for 0 to SHORE.reach (a chamfer
 * distance in two passes: within 8 % of the true distance).
 */
export function shoreDistances(land: Uint8Array, discs: readonly Disc[]): Uint8Array {
  const n = SHORE.size;
  const d = new Float32Array(n * n);
  const far = 1e9;
  for (let k = 0; k < n * n; k++) d[k] = land[k] ? 0 : far;
  for (const s of discs) {
    const i0 = Math.max(0, Math.floor((s.x - s.r + SHORE.extent) / cell));
    const i1 = Math.min(n - 1, Math.floor((s.x + s.r + SHORE.extent) / cell));
    const j0 = Math.max(0, Math.floor((s.z - s.r + SHORE.extent) / cell));
    const j1 = Math.min(n - 1, Math.floor((s.z + s.r + SHORE.extent) / cell));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++)
        if (Math.hypot(-SHORE.extent + (i + 0.5) * cell - s.x, -SHORE.extent + (j + 0.5) * cell - s.z) <= s.r) d[j * n + i] = 0;
  }
  const s2 = Math.SQRT2;
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= n || j >= n ? far : d[j * n + i]!);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      d[k] = Math.min(d[k]!, at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + s2, at(i + 1, j - 1) + s2);
    }
  for (let j = n - 1; j >= 0; j--)
    for (let i = n - 1; i >= 0; i--) {
      const k = j * n + i;
      d[k] = Math.min(d[k]!, at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + s2, at(i - 1, j + 1) + s2);
    }
  const out = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) out[k] = Math.round((Math.min(d[k]! * cell, SHORE.reach) / SHORE.reach) * 255);
  return out;
}

/** The shore of an island: its land once, then its distances again whenever the discs around it change. */
export function createShore(island: THREE.Object3D) {
  const land = landOf(island);
  let key: string | null = null;
  let last = new Uint8Array(0);
  let built = 0;
  return {
    /** The distances with these discs; the same array as before when they did not change. */
    distances(discs: readonly Disc[]): Uint8Array {
      const next = discs.map((s) => `${s.x.toFixed(2)},${s.z.toFixed(2)},${s.r}`).join(";");
      if (next !== key) {
        key = next;
        last = shoreDistances(land, discs);
        built++;
      }
      return last;
    },
    /** How many times the distances were built (tests). */
    get built() {
      return built;
    },
  };
}
