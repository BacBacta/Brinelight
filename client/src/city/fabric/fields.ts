/**
 * The fields of the plots won (owner, 21 October): gardens of real rows of vegetables and kelp laid out in rows on the
 * sand. Each field has its own rounded, irregular outline inside its plot (never the plot's hexagon), cut into beds of
 * irregular shapes with a border of grass between them and around them, each bed's rows in its own direction. The
 * ground's shader paints them (paint.ts) and the fabric's mesh raises their rows a little (models.ts): both read the
 * same shapes from here, so the rows stand on their painted stripes. Pure; the same plot always gets the same field
 * (hashes of its place). A plot's shape is three bytes (fieldBytes), which the shader reads from a texture: the same
 * numbers on both sides.
 */
import type { FieldKind } from "./plan.js";

/** A number from a plot (q, r) and a key, never randomness. */
export const fieldHash = (q: number, r: number, k: number): number => {
  const s = Math.sin(q * 12.9898 + r * 78.233 + k * 37.719) * 43758.5453;
  return s - Math.floor(s);
};

/** A field's size (its outline's mean reach from the plot's middle) and its rows' spacing. */
export const FIELD_REACH = 0.7;
export const ROW_SPACING: Readonly<Record<"garden" | "kelp", number>> = { garden: 0.13, kelp: 0.12 };
/** The grass around a field's beds (inside its outline), and between two beds (half on each side). */
export const FIELD_BORDER = 0.07;
export const BED_GAP = 0.09;
/** A field's beds: a garden's three, the kelp's two. */
export const BEDS: Readonly<Record<"garden" | "kelp", number>> = { garden: 3, kelp: 2 };

/** The vegetables of the gardens' rows (sRGB), mostly greens: lettuce, cabbage, leeks, potatoes, young squash, chard, beets. */
export const VEG = ["#8DB83F", "#6E9E7A", "#5E9A46", "#4E7F2E", "#9DB552", "#3F7A3A", "#7A4A4F"] as const;
export const KELP = "#5A6A2E";
/** The grass around the gardens' beds and between them (sRGB), a little fresher than the island's. */
export const GRASS = "#7DAA48";

/** A plot's field as three bytes: its beds' turn, its outline's and its rows' turns, and its seed. */
export const fieldBytes = (q: number, r: number): [number, number, number] => [1, 2, 3].map((k) => Math.floor(fieldHash(q, r, k) * 256) % 256) as [number, number, number];

/** A plot's field frame, from its bytes as the shader reads them (paint.ts). */
export function fieldFrame(q: number, r: number) {
  const [g, b, a] = fieldBytes(q, r);
  return { turn: (g / 255) * Math.PI * 2, wave: b / 255, seed: a };
}
export type FieldFrame = ReturnType<typeof fieldFrame>;

const fract = (v: number) => v - Math.floor(v);

/**
 * How far (dx, dz) from the plot's middle is outside the field's outline (negative inside): a rounded outline that
 * swells and narrows twice and three times around, turned by the field's bytes.
 */
export function outsideField(f: FieldFrame, dx: number, dz: number): number {
  const th = Math.atan2(dz, dx);
  const reach = FIELD_REACH * (1 + 0.13 * Math.cos(2 * th + f.wave * Math.PI * 2) + 0.07 * Math.cos(3 * th + (f.seed / 255) * Math.PI * 2));
  return Math.hypot(dx, dz) - reach;
}

/** Whether (dx, dz) from the plot's middle is in the field, `margin` inside its outline. */
export const inField = (f: FieldFrame, dx: number, dz: number, margin = 0): boolean => outsideField(f, dx, dz) < -margin;

/** Bed k of n: its middle (from the plot's middle) and its rows' direction (along them). */
export function bedOf(f: FieldFrame, k: number, n: number): { at: [number, number]; along: [number, number] } {
  const s = f.seed / 255;
  const th = f.turn + (k * Math.PI * 2) / n + (fract(s * (k + 1) * 0.618) - 0.5) * 0.9;
  const rho = 0.22 + 0.16 * fract(s * (k + 1) * 1.37);
  // Rows run out from the middle on one bed, around it on the next, each a little turned.
  const dir = th + (k % 2) * Math.PI * 0.5 + (fract(f.wave * (k + 1) * 0.41) - 0.5) * 0.6;
  return { at: [rho * Math.cos(th), rho * Math.sin(th)], along: [Math.cos(dir), Math.sin(dir)] };
}

/**
 * The bed under (dx, dz), the nearest bed's middle, and how deep inside it the point is (negative: in the grass between
 * the beds or around them, or outside the field).
 */
export function bedAt(f: FieldFrame, n: number, dx: number, dz: number): { bed: number; depth: number } {
  const beds = Array.from({ length: n }, (_, k) => bedOf(f, k, n).at);
  const dist = beds.map(([x, z]) => Math.hypot(dx - x, dz - z));
  const bed = dist.indexOf(Math.min(...dist));
  const [ax, az] = beds[bed]!;
  // How far to the line halfway to each other bed.
  let edge = Infinity;
  beds.forEach(([bx, bz], j) => {
    if (j === bed) return;
    const len = Math.hypot(bx - ax, bz - az);
    edge = Math.min(edge, (((ax + bx) / 2 - dx) * (bx - ax) + ((az + bz) / 2 - dz) * (bz - az)) / len);
  });
  return { bed, depth: Math.min(-outsideField(f, dx, dz) - FIELD_BORDER, edge - BED_GAP / 2) };
}

/** The variety of a garden's row, from the plot's seed, its bed and its index across the bed (as the shader). */
export const rowVariety = (seed: number, bed: number, row: number): number => (((seed + row * 3 + bed * 2) % VEG.length) + VEG.length) % VEG.length;

/** A raised row of a field: its points (x, z) along it, and its color (sRGB). */
export type FieldRow = { points: [number, number][]; color: string; kind: "garden" | "kelp" };

/** Where along a row the points of its ridge stand, from samples every SAMPLE; how far inside its bed it stops. */
const RIDGE_STEP = 0.25;
const SAMPLE = 0.05;
const ROW_MARGIN = 0.04;

/** The raised rows of a field on plot (q, r) whose middle is (x, z): each bed's rows. Orchards and parks have none. */
export function fieldRows(kind: FieldKind, q: number, r: number, x: number, z: number): FieldRow[] {
  if (kind !== "garden" && kind !== "kelp") return [];
  const f = fieldFrame(q, r);
  const n = BEDS[kind];
  const sp = ROW_SPACING[kind];
  const out: FieldRow[] = [];
  for (let bed = 0; bed < n; bed++) {
    const { at, along } = bedOf(f, bed, n);
    const [ux, uz] = along;
    const [vx, vz] = [-uz, ux];
    for (let k = -8; k < 8; k++) {
      // Row k: across the bed from its middle, as the shader counts them (floor of the distance over the spacing).
      const t = (k + 0.5) * sp;
      let run: [number, number][] = [];
      const flush = () => {
        // Its ridge's points: every RIDGE_STEP along the stretch, and its end.
        const every = Math.round(RIDGE_STEP / SAMPLE);
        const points = run.filter((_, i) => i % every === 0 || i === run.length - 1);
        if (points.length >= 2) out.push({ points, color: kind === "kelp" ? KELP : VEG[rowVariety(f.seed, bed, k)]!, kind });
        run = [];
      };
      for (let s = -1; s <= 1.0001; s += SAMPLE) {
        const [dx, dz] = [at[0] + ux * s + vx * t, at[1] + uz * s + vz * t];
        const here = bedAt(f, n, dx, dz);
        if (here.bed === bed && here.depth > ROW_MARGIN) run.push([x + dx, z + dz]);
        else flush();
      }
      flush();
    }
  }
  return out;
}
