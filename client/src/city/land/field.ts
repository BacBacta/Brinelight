/**
 * The land won on the sea (owner, after the S22's worst case), as assets/blender/reclaim.py and land.py compute it: one
 * signed field for the island and every slot taken, so that the coast stays one smooth line whatever slots are taken,
 * holes too. Pure functions of (x, z) in the game's units; client/test/landField.test.ts checks them against the Python
 * that made the island (assets/blender/reclaim.py), point by point.
 *
 *     depth > 0 on land, < 0 in the sea.
 */
import { BUILDING_IDS } from "@brinelight/shared";
import { ERA_PLOTS } from "../plots.js";

/** The city's sea after the style pass (land.py, SEA): its rest level. */
export const SEA = -0.22;
/** A slot's land around its center, as a plot's (reclaim.py, LAND). */
export const LAND = 1.12;
/** A free slot's water (reclaim.py, ROOM). */
export const ROOM = 0.98;
/** The soft join between neighboring slots (reclaim.py, JOIN). */
export const JOIN = 0.9;
const CARVE = 0.12;

const fract = (v: number) => v - Math.floor(v);
const hash = (i: number, j: number, seed: number) => fract(Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453);

/** Value noise in -1..1 (land.py, vnoise). */
export function vnoise(x: number, z: number, seed = 0): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi, seed);
  const b = hash(xi + 1, zi, seed);
  const c = hash(xi, zi + 1, seed);
  const d = hash(xi + 1, zi + 1, seed);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

/** Four octaves of value noise (land.py, fbm). */
export function fbm(x: number, z: number, seed = 0): number {
  let out = 0;
  let amp = 0.5;
  let f = 1;
  for (let k = 0; k < 4; k++) {
    out += amp * vnoise(x * f, z * f, seed + k * 13.1);
    amp *= 0.5;
    f *= 2;
  }
  return out;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** A smooth minimum (land.py, smin). */
export function smin(a: number, b: number, k: number): number {
  const h = clamp(0.5 + (0.5 * (b - a)) / k);
  return b * (1 - h) + a * h - k * h * (1 - h);
}

export const hexReach = (x: number, z: number): number => Math.max(Math.abs(x), Math.abs(x / 2 + z * 0.866), Math.abs(-x / 2 + z * 0.866));
const hx = (q: number, r: number): [number, number] => [2 * (q + r / 2), 1.732 * r];

/** The 19 plots of rings 0 to 2, and the plots the buildings stand on (ERA_PLOTS). */
const PLOTS: [number, number][] = [];
for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2) PLOTS.push(hx(q, r));
const BUILT: [number, number][] = BUILDING_IDS.map((id) => hx(...ERA_PLOTS[id]));

/** Hex distance to the nearest plot's center: up to 1 on a plot (land.py, plot_reach). */
export function plotReach(x: number, z: number): number {
  let m = Infinity;
  for (const [cx, cz] of PLOTS) m = Math.min(m, hexReach(x - cx, z - cz));
  return m;
}

/** The island's own land, without the rafts' rooms (reclaim.py, island_depth). */
export function islandDepth(x: number, z: number): number {
  let base = 0;
  let near = Infinity;
  PLOTS.forEach(([cx, cz], i) => {
    const r = Math.hypot(x - cx, z - cz);
    near = Math.min(near, r);
    const d = r - 1.12;
    base = i === 0 ? d : smin(base, d, 0.6);
  });
  const coast = -base + 0.16 * fbm(x * 0.55, z * 0.55, 3.0) + 0.05 * fbm(x * 2.2, z * 2.2, 4.0);
  return -smin(-coast, -(1.12 - near), 0.12);
}

/** Where the island's coast is a low cliff (1) rather than a beach (0) (land.py, cliffs). */
export const cliffs = (x: number, z: number): number => clamp((fbm(x * 0.8, z * 0.8, 9.0) + 0.05) * 4) * clamp(1.1 - 0.25 * z, 0.35, 1);

/** 0 on the buildings' plots and every plot's rim, 1 in the free plots' middles and beyond (land.py, flat_weight). */
export function flatWeight(x: number, z: number): number {
  let built = Infinity;
  for (const [cx, cz] of BUILT) built = Math.min(built, hexReach(x - cx, z - cz));
  const rim = plotReach(x, z);
  return clamp((built - 0.95) / 0.35) * clamp((0.95 - rim) / 0.3) + clamp((rim - 1.04) / 0.1) * clamp((built - 1.0) / 0.3);
}

/** The island's meadow: gentle hills, flat on the plots (land.py, heights' `hills`). */
export const hills = (x: number, z: number): number => (0.05 + 0.07 * fbm(x * 0.6, z * 0.6, 1.0)) * flatWeight(x, z);

export type At = { x: number; z: number };
/** What the land is made of: the slots won (land, a flooded one too), the flooded ones, the one being filled, the free ones. */
export type LandSlots = { won: readonly At[]; flooded: readonly At[]; filling: At | null; free: readonly At[] };

/** The island's field kept apart (it never changes): its depth, hills, cliffs and plot reach at a point. */
export type IslandAt = { isl: number; hills: number; cliffs: number; plot: number };
export const islandAt = (x: number, z: number): IslandAt => ({ isl: islandDepth(x, z), hills: hills(x, z), cliffs: cliffs(x, z), plot: plotReach(x, z) });

/** The slots' land: round lands joined softly (reclaim.py, slots_depth); -99 without any. */
export function slotsDepth(x: number, z: number, won: readonly At[]): number {
  if (!won.length) return -99;
  let base = 0;
  won.forEach((s, i) => {
    const dx = x - s.x;
    const dz = z - s.z;
    // smin gives `base` itself when d is JOIN or more above it: such a slot is skipped before its square root.
    if (i > 0) {
      const far = base + JOIN + LAND;
      if (far > 0 && dx * dx + dz * dz >= far * far) return;
    }
    const d = Math.sqrt(dx * dx + dz * dz) - LAND;
    base = i === 0 ? d : d - base >= JOIN ? base : smin(base, d, JOIN);
  });
  return -base;
}

/** The whole land's field and how much the coast here is the land won's (1: the dike) rather than the island's (0). */
export function landDepth(x: number, z: number, L: LandSlots, island: IslandAt = islandAt(x, z)): { depth: number; won: number; mine: number } {
  const isl = island.isl;
  const won = slotsDepth(x, z, L.won);
  let whole = -smin(-isl, -won, 0.3);
  if (L.free.length) {
    let room = Infinity;
    for (const s of L.free) {
      const dx = x - s.x;
      const dz = z - s.z;
      const near = room + ROOM;
      if (dx * dx + dz * dz < near * near) room = Math.sqrt(dx * dx + dz * dz) - ROOM;
    }
    whole = smin(whole, room, CARVE);
  }
  return { depth: whole, won, mine: clamp((won - isl) / 0.15 + 0.5) };
}

/** 1 in a flooded slot's breach: its dike's side facing the sea (away from the island's center) (reclaim.py, breach). */
export function breach(x: number, z: number, flooded: readonly At[]): number {
  let out = 0;
  for (const s of flooded) {
    const a0 = Math.atan2(s.z, s.x);
    const a = Math.atan2(z - s.z, x - s.x);
    const da = Math.abs(((((a - a0 + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);
    const r = Math.hypot(x - s.x, z - s.z);
    out = Math.max(out, clamp((0.45 - da) / 0.15) * clamp((r - 0.55) / 0.2) * clamp((1.45 - r) / 0.15));
  }
  return out;
}

export type Ground = { y: number; depth: number; mine: number; cliff: number; plot: number; mud: number; fresh: number };

/**
 * The ground at a point (reclaim.py, Land.heights): the island's (hills, beaches, low cliffs); on the land won a flat
 * meadow ending straight at its dike; a flooded slot's ground under the water, its rim broken toward the sea; the slot
 * being filled a landfill just above the water. Also what colors it (its depth, whose coast, cliff, mud, fresh earth).
 */
export function ground(x: number, z: number, L: LandSlots, island: IslandAt = islandAt(x, z)): Ground {
  const { depth: d, mine } = landDepth(x, z, L, island);
  const flatWon = mine > 0 ? 0.015 * fbm(x * 1.3, z * 1.3, 12.0) : 0;
  const h = island.hills * (1 - mine) + flatWon * mine;
  const c = island.cliffs * (1 - mine) + mine;
  let beach = clamp(d / 0.35);
  beach = beach * beach * (3 - 2 * beach);
  const cliff = clamp(d / 0.04);
  let shore = beach * (1 - c) + cliff * c;
  if (island.plot <= 1.02) shore = Math.max(shore, 1.0);
  const edge = SEA - 0.03;
  const land = edge + (h - edge) * shore;
  const floor = (SEA - 0.03 + Math.max(d, -0.9) * 0.45) * (1 - c) + (SEA - 0.12 + Math.max(d, -0.7) * 0.9) * c;
  let y = d > 0 ? land : floor;
  let mud = 0;
  if (L.flooded.length) {
    let fl = Infinity;
    for (const s of L.flooded) fl = Math.min(fl, Math.hypot(x - s.x, z - s.z));
    if (fl < 1.5) {
      let sink = clamp((0.9 - fl) / 0.2);
      sink = Math.max(sink, breach(x, z, L.flooded) * (fl < 1.3 ? 1 : 0));
      if (sink > 0) y = y * (1 - sink) + (SEA - 0.07 + 0.02 * fbm(x * 3, z * 3, 14.0)) * sink;
      mud = clamp((1.0 - fl) / 0.15);
    }
  }
  let fresh = 0;
  if (L.filling) {
    const f = hexReach(x - L.filling.x, z - L.filling.z);
    const fill = clamp((1.05 - f) / 0.15);
    if (fill > 0) {
      const heaps = SEA + 0.03 + 0.05 * clamp(fbm(x * 2.2, z * 2.2, 15.0) + 0.2);
      y = y * (1 - fill) + Math.min(y, heaps) * fill;
    }
    fresh = clamp((1.08 - f) / 0.12);
  }
  return { y, depth: d, mine, cliff: c, plot: island.plot, mud, fresh };
}
