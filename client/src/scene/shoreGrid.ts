/**
 * The shore of the city's water (week 6, task 4): how far each point of the water lies from the island and from the
 * rafts moored around it, on a grid the water's shader reads to draw its foam. Built on the CPU from the island's
 * triangles (no extra render pass, no texture file), and built again only when the moored rafts change. Plain arrays, no
 * three.js: the land's worker computes it (city/land/land.worker.ts); shore.ts reads a scene's island into it.
 */

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

/**
 * A round thing in the water the foam goes around: a raft, the shipyard at work. `still`: still water instead (a flooded
 * plot of the land won, city/land): shallow, without foam, its rim only lapping.
 */
export type Disc = { x: number; z: number; r: number; still?: boolean };

/** How far from the shore still water counts (no foam there, the shallows' color). */
export const STILL = 0.5;

export const cell = (2 * SHORE.extent) / SHORE.size;

/**
 * Marks the cells where these triangles (world positions, x y z each, indexed or not) stand above the water: a cell is
 * land when some triangle, seen from above, covers its center at or above the water's level.
 */
export function markLand(land: Uint8Array, pos: ArrayLike<number>, index: ArrayLike<number> | null, waterY: number): Uint8Array {
  const n = SHORE.size;
  const count = index ? index.length : pos.length / 3;
  const p = (t: number) => (index ? index[t]! : t) * 3;
  for (let t = 0; t < count; t += 3) {
    const a = p(t), b = p(t + 1), c = p(t + 2);
    const ax = pos[a]!, ay = pos[a + 1]!, az = pos[a + 2]!;
    const bx = pos[b]!, by = pos[b + 1]!, bz = pos[b + 2]!;
    const cx = pos[c]!, cy = pos[c + 1]!, cz = pos[c + 2]!;
    if (Math.max(ay, by, cy) < waterY) continue;
    const area = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
    if (Math.abs(area) < 1e-12) continue;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) + SHORE.extent) / cell));
    const i1 = Math.min(n - 1, Math.floor((Math.max(ax, bx, cx) + SHORE.extent) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) + SHORE.extent) / cell));
    const j1 = Math.min(n - 1, Math.floor((Math.max(az, bz, cz) + SHORE.extent) / cell));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        if (land[j * n + i]) continue;
        const x = -SHORE.extent + (i + 0.5) * cell;
        const z = -SHORE.extent + (j + 0.5) * cell;
        // Barycentric weights of (x, z) in the triangle seen from above.
        const wb = ((x - ax) * (cz - az) - (cx - ax) * (z - az)) / area;
        const wc = ((bx - ax) * (z - az) - (x - ax) * (bz - az)) / area;
        const wa = 1 - wb - wc;
        if (wa < 0 || wb < 0 || wc < 0) continue;
        if (wa * ay + wb * by + wc * cy >= waterY) land[j * n + i] = 1;
      }
  }
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
    if (s.still) continue;
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
  const still = Math.round((STILL / SHORE.reach) * 255);
  for (const s of discs) {
    if (!s.still) continue;
    const i0 = Math.max(0, Math.floor((s.x - s.r + SHORE.extent) / cell));
    const i1 = Math.min(n - 1, Math.floor((s.x + s.r + SHORE.extent) / cell));
    const j0 = Math.max(0, Math.floor((s.z - s.r + SHORE.extent) / cell));
    const j1 = Math.min(n - 1, Math.floor((s.z + s.r + SHORE.extent) / cell));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++)
        if (Math.hypot(-SHORE.extent + (i + 0.5) * cell - s.x, -SHORE.extent + (j + 0.5) * cell - s.z) <= s.r) out[j * n + i] = Math.max(out[j * n + i]!, still);
  }
  return out;
}

