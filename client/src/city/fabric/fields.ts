/**
 * The fields of the plots won (owner, 21 October): gardens of real rows of vegetables, in two beds with a path between
 * them, and kelp laid out in rows on the sand, each plot of its own irregular shape. The ground's shader paints them
 * (paint.ts) and the fabric's mesh raises their rows a little (models.ts): both read the same shapes from here, so the
 * rows stand on their painted stripes. Pure; the same plot always gets the same field (hashes of its place). A plot's
 * shape is three bytes (fieldBytes), which the shader reads from a texture: the same numbers on both sides.
 */
import type { FieldKind } from "./plan.js";

/** A number from a plot (q, r) and a key, never randomness. */
export const fieldHash = (q: number, r: number, k: number): number => {
  const s = Math.sin(q * 12.9898 + r * 78.233 + k * 37.719) * 43758.5453;
  return s - Math.floor(s);
};

/** A field's size (its outline's mean reach from the plot's middle), its rows' spacing and its path's half width. */
export const FIELD_REACH = 0.7;
export const ROW_SPACING: Readonly<Record<"garden" | "kelp", number>> = { garden: 0.15, kelp: 0.12 };
export const PATH_HALF = 0.035;

/** The vegetables of the gardens' rows (sRGB): lettuce, cabbage, beet, carrot tops, squash; and the kelp. */
export const VEG = ["#7FA83A", "#5E8F6E", "#6B4048", "#5C8A2A", "#3F6B25"] as const;
export const KELP = "#3B3416";

/** A plot's field as three bytes: its path's direction, its path's offset, and its outline's turn (and rows' seed). */
export const fieldBytes = (q: number, r: number): [number, number, number] => [1, 2, 3].map((k) => Math.floor(fieldHash(q, r, k) * 256) % 256) as [number, number, number];

/** A plot's field frame, from its bytes as the shader reads them (paint.ts): its path's direction (n, across it) and offset, its outline's turn. */
export function fieldFrame(q: number, r: number) {
  const [g, b, a] = fieldBytes(q, r);
  const angle = (g / 255) * Math.PI;
  return {
    n: [Math.cos(angle), Math.sin(angle)] as const,
    offset: (b / 255 - 0.5) * 0.3,
    turn: (a / 255) * Math.PI,
    seed: a,
  };
}
type Frame = ReturnType<typeof fieldFrame>;

/**
 * A field's outline: six straight sides, each turned and set back a little from a hexagon's (the plot's own shape), so
 * no two fields have the same. Side k faces the direction `side(k)` and stands `reach(k)` from the middle.
 */
export const FIELD_SIDES = 6;
const sideTurn = (f: Frame, k: number): number => f.turn + (k * Math.PI) / 3 + ((((f.seed / 255) * (k + 1) * 0.618) % 1) - 0.5) * 0.5;
const sideReach = (f: Frame, k: number): number => FIELD_REACH - 0.12 + 0.2 * (((f.seed / 255) * (k + 1) * 1.37) % 1);

/** How far (dx, dz) from the plot's middle is outside the field's outline (negative inside). */
export function outsideField(f: Frame, dx: number, dz: number): number {
  let out = -Infinity;
  for (let k = 0; k < FIELD_SIDES; k++) {
    const a = sideTurn(f, k);
    out = Math.max(out, dx * Math.cos(a) + dz * Math.sin(a) - sideReach(f, k));
  }
  return out;
}

/** Whether (dx, dz) from the plot's middle is in the field, `margin` inside its outline. */
export const inField = (f: Frame, dx: number, dz: number, margin = 0): boolean => outsideField(f, dx, dz) < -margin;

/** The variety of a garden's row, from the plot's seed, its bed (0 or 1) and its index across the bed (as the shader). */
export const rowVariety = (seed: number, bed: number, row: number): number => (((seed + row * 3 + bed * 2) % VEG.length) + VEG.length) % VEG.length;

/** A raised row of a field: its points (x, z) along it, and its color (sRGB). */
export type FieldRow = { points: [number, number][]; color: string; kind: "garden" | "kelp" };

/** Where along a row the points of its ridge stand, from samples every SAMPLE. */
const RIDGE_STEP = 0.25;
const SAMPLE = 0.05;

/**
 * The raised rows of a field on plot (q, r) whose middle is (x, z). A garden: two beds on either side of a path, the
 * first with its rows along the path, the second across it. Kelp: one bed of rows. Orchards and parks have none.
 */
export function fieldRows(kind: FieldKind, q: number, r: number, x: number, z: number): FieldRow[] {
  if (kind !== "garden" && kind !== "kelp") return [];
  const f = fieldFrame(q, r);
  const [nx, nz] = f.n;
  const [mx, mz] = [-nz, nx];
  const sp = ROW_SPACING[kind];
  const out: FieldRow[] = [];
  const beds = kind === "garden" ? [0, 1] : [0];
  for (const bed of beds) {
    // Bed 0: rows along the path (m), one after the other across it (n); bed 1: rows across the path.
    const [ux, uz, vx, vz] = bed === 0 ? [mx, mz, nx, nz] : [nx, nz, mx, mz];
    for (let k = -8; k < 8; k++) {
      const t = (k + 0.5) * sp;
      // Along the row, the stretches inside the field, on the bed's side of the path.
      let run: [number, number][] = [];
      const flush = () => {
        // Its ridge's points: every RIDGE_STEP along the stretch, and its end.
        const every = Math.round(RIDGE_STEP / SAMPLE);
        const points = run.filter((_, i) => i % every === 0 || i === run.length - 1);
        if (points.length >= 2) out.push({ points, color: kind === "kelp" ? KELP : VEG[rowVariety(f.seed, bed, k)]!, kind });
        run = [];
      };
      for (let s = -1; s <= 1.0001; s += SAMPLE) {
        const [dx, dz] = [ux * s + vx * t, uz * s + vz * t];
        const side = dx * nx + dz * nz - f.offset;
        const inside = inField(f, dx, dz, 0.06) && (kind === "kelp" || (bed === 0 ? side > PATH_HALF + 0.03 : side < -PATH_HALF - 0.03));
        if (inside) run.push([x + dx, z + dz]);
        else flush();
      }
      flush();
    }
  }
  return out;
}
