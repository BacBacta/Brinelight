/**
 * The city fabric (owner, 21 October): what grows between the buildings as the city grows. Display only: no rule, no
 * value, nothing of the city's data; the same city always gets the same fabric (hashes of places, never randomness), as
 * in its target images (assets/blender/fabric_target.py).
 *
 * - Houses: as many as the larger of the Shelters' room (one house for two survivors of room) and a minimum that
 *   follows the Lighthouse up to 10, so the city moves from the first levels. On the island's free plots first (six
 *   around each plot's middle), then on the plots won; their style by era, the last era's on the outskirts. Each one
 *   where the normal view sees it and where it hides no building nor house (sight.ts).
 * - One equipment per era in the middle of a free plot, kept as the city grows; the wind turbines on the far coast.
 * - The camp's small details, one more at each Lighthouse level from 1 to 7: a fire, drying racks, washing, barrels, a
 *   rowboat pulled up on the beach.
 * - Streets: the trails between the buildings and a street through each plot with houses, in the era's ground; lamps
 *   from the workshop era, power poles and street trees from the electricity era; a square around the Lighthouse.
 * - Fields on the plots won free of houses: gardens in rows, orchards, kelp in rows, then parks (fields.ts).
 * - The port: quays and boats along the coast on either side of the Harbor, more with the eras.
 *
 * Pure: the game builds its meshes from it (fabric/index.ts), the tests read it.
 */
import { BUILDING_IDS, RAFT_DAMAGED_BELOW, RAFT_SLOTS, survivorCap, yardSlot } from "@brinelight/shared";
import type { PlayerState } from "../../state/index.js";
import { hexX, hexZ } from "../../scene/island.js";
import { terrainCoast } from "../../scene/terrainCoast.js";
import { ERA_PLOTS } from "../eraPlots.js";
import { trails } from "../life/cast.js";
import { SEA, hexReach, islandDepth, landDepth, type At, type LandSlots } from "../land/field.js";
import LAND from "../life/land.json";
import { boxOf, buildingBoxes, createView, hiddenBy, MOST_HIDDEN } from "./sight.js";
import { fieldRows, type FieldRow } from "./fields.js";

/** Where the washing dries by the Shelters (life/details.ts, LAUNDRY; a test checks they agree): no house there. */
export const LAUNDRY_AT = { x: hexX(1, -1) + 0.42, z: hexZ(-1) + 0.2 } as const;

/** The eras of the fabric, by the Lighthouse: salvage 1-4, colony 5-9, workshop 10-14, industry 15-19, electricity 20-24, modern 25-30. */
export const ERAS = ["salvage", "colony", "workshop", "industry", "electricity", "modern"] as const;
export const eraOf = (lighthouse: number): number => Math.min(5, Math.floor(Math.max(1, lighthouse) / 5));

/** Two survivors of room to a house (owner: the survivors themselves never grow in the rules, docs/tasks/week-8.md). */
export const PER_HOUSE = 2;
/** The fewest houses the city shows at each Lighthouse level from 1 to 10 (then 20): five at first, then one or two more a level. */
export const MIN_HOUSES = [5, 6, 7, 8, 10, 12, 14, 16, 18, 20] as const;
export const minHouses = (lighthouse: number): number => MIN_HOUSES[Math.min(MIN_HOUSES.length, Math.max(1, lighthouse)) - 1]!;
/** The houses a city shows: the larger of the Shelters' room and the Lighthouse's minimum. */
export const housesShown = (lighthouse: number, shelters: number): number => Math.max(Math.ceil(survivorCap(shelters) / PER_HOUSE), minHouses(lighthouse));

/** The houses are drawn 1.2 times as made (owner, after the target images); the camp's tents and huts 1.3 times (owner, 21 October: the first Lighthouses). */
export const HOUSE_SCALE = 1.2;
export const CAMP_SCALE = 1.3;
export const houseScale = (model: string): number => (model === "tent" || model === "hut" ? CAMP_SCALE : HOUSE_SCALE);
/** The share of windows lit in the Mist, by era (owner, 21 October): from two in five in the camp to nearly every window in the Modern era. */
export const LIT = [0.4, 0.5, 0.6, 0.7, 0.85, 0.95] as const;

/** What each era builds: the small house (one house's worth) and, from the industry era, the big one and its worth. */
const STYLES: readonly { small: readonly string[]; big?: { model: string; worth: number }; older?: string }[] = [
  { small: ["tent", "hut"] },
  { small: ["wooden"], older: "hut" },
  { small: ["brick"], older: "wooden" },
  { small: ["brick"], big: { model: "row", worth: 3 }, older: "wooden" },
  { small: ["lit-house"], big: { model: "row", worth: 3 }, older: "brick" },
  { small: ["solar-house"], big: { model: "apartments", worth: 6 }, older: "lit-house" },
];
/** The houses' models, and their worth in houses. */
export const HOUSE_WORTH: Record<string, number> = { tent: 1, hut: 1, wooden: 1, brick: 1, "lit-house": 1, "solar-house": 1, row: 3, apartments: 6 };

/** The camp's details, one more a Lighthouse level from 1 to 7, kept until the workshop era. */
export const CAMP = ["campfire", "drying-rack", "laundry-line", "barrels", "rowboat", "drying-rack", "laundry-line"] as const;

/** One copy of a model of the fabric: on the ground at (x, z), turned, at a size; `lit`: when its windows light, 0 first. */
export type Piece = { model: string; x: number; z: number; turn: number; scale: number; lit: number; y?: number };
export type FieldKind = "garden" | "orchard" | "kelp" | "park";
export type Field = { kind: FieldKind; x: number; z: number };
/** A tree of the fabric (orchards, parks, the streets'): drawn with the island's plants. */
export type Tree = { name: string; x: number; z: number; turn: number; scale: number };

export type FabricPlan = {
  era: number;
  /** The houses shown, in houses' worth. */
  houses: number;
  pieces: Piece[];
  /** A power line between two poles (x, z of each end). */
  wires: [number, number, number, number][];
  fields: Field[];
  trees: Tree[];
  /** The gardens' and the kelp's raised rows (fields.ts). */
  rows: FieldRow[];
  /** The streets, polylines of (x, z): their ground is painted. */
  streets: [number, number][][];
  /** The square around the Lighthouse: how far it reaches (hex distance), 0 for none. */
  square: number;
  /** The plots the fabric takes (their wild plants give way): (x, z) of their middles. */
  taken: At[];
  /** The plots with houses or the camp: their ground is a yard of trodden earth. */
  yards: At[];
  /** Where smoke rises: the forge's and the workshops' chimneys. */
  smoke: { x: number; y: number; z: number }[];
};

/** A number from a place, never randomness. */
const hash = (x: number, z: number, k = 0): number => {
  const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
  return s - Math.floor(s);
};

const BUILT = BUILDING_IDS.map((id) => ({ x: hexX(...ERA_PLOTS[id]), z: hexZ(ERA_PLOTS[id][1]) }));
/** The island's free plots of rings 1 and 2: nearest the Lighthouse first, then the front (+z), then the left. */
const ISLAND_PLOTS: At[] = (() => {
  const out: At[] = [];
  for (let q = -2; q <= 2; q++)
    for (let r = -2; r <= 2; r++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > 2) continue;
      const p = { x: hexX(q, r), z: hexZ(r) };
      if (!BUILT.some((b) => Math.hypot(b.x - p.x, b.z - p.z) < 0.1)) out.push(p);
    }
  return out.sort((a, b) => Math.round(Math.hypot(a.x, a.z) * 10) - Math.round(Math.hypot(b.x, b.z) * 10) || b.z - a.z || a.x - b.x);
})();

/** The plots won free of a building and sound, nearest the Lighthouse first. */
function wonPlots(state: PlayerState): At[] {
  const filling = state.yard?.kind === "raft" ? yardSlot(state.yard) : null;
  return RAFT_SLOTS.filter((s) => {
    const r = state.rafts[s.key];
    return r && !r.building && r.hp >= RAFT_DAMAGED_BELOW && s.key !== filling;
  })
    .map((s) => ({ x: hexX(s.q, s.r), z: hexZ(s.r) }))
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z) || b.z - a.z);
}

/** Six lots around a plot's middle (its streets cross it), the middle left for a yard or an equipment. */
function lots(p: At, era: number): { x: number; z: number; turn: number }[] {
  return Array.from({ length: 6 }, (_, k) => {
    const a = ((30 + 60 * k) * Math.PI) / 180;
    // From the industry era the houses face their street; before, they stand as they were put, a little turned.
    return { x: p.x + Math.cos(a) * 0.56, z: p.z + Math.sin(a) * 0.56, turn: era >= 3 ? -a + Math.PI / 2 : 0.35 * Math.sin(k * 1.7) };
  });
}

/** The equipment of each era, in a free plot's middle: the low ones in front, the tall ones at the back, the forge on a side. */
const EQUIPMENT: readonly { model: string; since: number; order: (p: At) => number }[] = [
  { model: "well", since: 0, order: (p) => -p.z * 10 + Math.abs(p.x) },
  { model: "windmill", since: 1, order: (p) => p.z * 10 + Math.abs(p.x) },
  { model: "chimneys", since: 2, order: (p) => -Math.abs(p.x) * 10 + p.z },
  { model: "water-tower", since: 3, order: (p) => p.z * 10 - Math.abs(p.x) },
  { model: "solar-field", since: 5, order: (p) => -p.z * 10 - Math.abs(p.x) },
];

/** The island's coast near the Harbor, every 0.3, with the way out to sea: where its quays and boats go. */
const HARBOR_COAST: [number, number, number, number][] = (() => {
  const [hq, hr] = ERA_PLOTS.harbor;
  const [hx, hz] = [hexX(hq, hr), hexZ(hr)];
  const out: [number, number, number, number][] = [];
  const land = (a: number, r: number) => islandDepth(hx + Math.cos(a) * r, hz + Math.sin(a) * r) > 0;
  for (let a = -Math.PI; a < Math.PI; a += 0.04) {
    // Along each direction from the Harbor, the last point of land: found every 0.1, then to 0.01 between.
    let last = -1;
    for (let r = 0.9; r < 2.4; r += 0.1) if (land(a, r)) last = r;
    if (last < 0) continue;
    let [lo, hi] = [last, last + 0.1];
    while (hi - lo > 0.01) [lo, hi] = land(a, (lo + hi) / 2) ? [(lo + hi) / 2, hi] : [lo, (lo + hi) / 2];
    last = lo;
    if (last > 2.35) continue;
    const [x, z] = [hx + Math.cos(a) * last, hz + Math.sin(a) * last];
    const e = 0.02;
    const nx = islandDepth(x - e, z) - islandDepth(x + e, z);
    const nz = islandDepth(x, z - e) - islandDepth(x, z + e);
    const n = Math.hypot(nx, nz) || 1;
    if (!out.length || Math.hypot(x - out[out.length - 1]![0], z - out[out.length - 1]![1]) >= 0.3) out.push([x, z, nx / n, nz / n]);
  }
  return out.sort((a, b) => Math.hypot(a[0] - hx, a[1] - hz) - Math.hypot(b[0] - hx, b[1] - hz));
})();

/** The beach spots (land.json: the crabs'): the camp's rowboat is pulled up on the nearest. */
const BEACH = (LAND as unknown as { beach: [number, number, number][] }).beach;

/** Points every `step` along polylines of (x, z), with their direction. */
function along(lines: readonly (readonly [number, number])[][], step: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const pts of lines) {
    let acc = step / 2;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i]!;
      const [bx, bz] = pts[i + 1]!;
      const seg = Math.hypot(bx - ax, bz - az);
      while (acc < seg) {
        const t = acc / seg;
        out.push([ax + (bx - ax) * t, az + (bz - az) * t, Math.atan2(bz - az, bx - ax)]);
        acc += step;
      }
      acc -= seg;
    }
  }
  return out;
}

/** Where the wind turbines may stand on the far coast (their directions from the Lighthouse), the first three clear. */
const TURBINE_AT = [-1.75, -1.3, -2.2, -0.85, -1.52, -1.98, -1.08];

/** The trails between the buildings (land.json), as polylines of (x, z). */
const TRAILS: [number, number][][] = trails().map((t) => t.map(([x, , z]) => [x, z] as [number, number]));

/** The fabric of a city. `L`: its land (the plots won); the pieces' heights are set by the game, on its ground. */
export function fabricPlan(state: PlayerState, L: LandSlots): FabricPlan {
  const lighthouse = state.buildings.lighthouse;
  const era = eraOf(lighthouse);
  const style = STYLES[era]!;
  const need = housesShown(lighthouse, state.buildings.shelters);
  const pieces: Piece[] = [];
  const camp = era < 2;
  const put = (model: string, x: number, z: number, turn = 0, scale = 1, lit = 1) => pieces.push({ model, x, z, turn, scale, lit });
  const litOf = (x: number, z: number) => hash(x, z, 11);
  const plots = [...ISLAND_PLOTS.map((p) => ({ ...p, won: false })), ...wonPlots(state).map((p) => ({ ...p, won: true }))];
  const keyOf = (p: At) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`;
  const taken = new Map<string, At>();
  const take = (p: At) => taken.set(keyOf(p), { x: p.x, z: p.z });
  const isTaken = (p: At) => taken.has(keyOf(p));

  // What the normal view sees: the buildings at their levels, then the fabric as it is put.
  const view = createView(buildingBoxes(state.buildings));
  // The equipment, in the middles of the island's free plots, kept from era to era: where it stays in sight with the
  // buildings at their tallest.
  const middles = new Set<string>();
  const always = createView(buildingBoxes(state.buildings, true));
  for (const e of EQUIPMENT) {
    const order = [...ISLAND_PLOTS].sort((a, b) => e.order(a) - e.order(b)).filter((q) => !middles.has(keyOf(q)));
    const p = order.find((q) => always.fits(boxOf(e.model, q.x, q.z)!)) ?? order[0];
    if (!p) continue;
    middles.add(keyOf(p));
    always.put(boxOf(e.model, p.x, p.z)!);
    if (era >= e.since) {
      put(e.model, p.x, p.z);
      view.put(boxOf(e.model, p.x, p.z)!);
      take(p);
    }
  }
  const wellPlot = [...ISLAND_PLOTS].sort((a, b) => EQUIPMENT[0]!.order(a) - EQUIPMENT[0]!.order(b))[0]!;
  const isCamp = (p: At) => camp && keyOf(p) === keyOf(wellPlot);

  // The camp, around the well, one detail more a level from 1 to 7, until the workshop era; its plot holds no house.
  if (camp) {
    const n = Math.min(CAMP.length, Math.max(1, lighthouse));
    // Six spots around the well, one a detail; the rowboat is on the beach.
    const spots = lots(wellPlot, 0);
    let j = 0;
    for (let k = 0; k < n; k++) {
      const model = CAMP[k]!;
      if (model === "rowboat") {
        const b = [...BEACH].sort((a, c) => Math.hypot(a[0] - wellPlot.x, a[2] - wellPlot.z) - Math.hypot(c[0] - wellPlot.x, c[2] - wellPlot.z))[0];
        if (b) put("rowboat", b[0], b[2], 0.6);
        continue;
      }
      const s = spots[j++]!;
      put(model, s.x, s.z, s.turn + k, 1, model === "campfire" ? 0 : 1);
    }
    take(wellPlot);
  }

  // The houses: the big ones first, on whole plots of their own at the back; then the small ones, nearest the
  // Lighthouse first, the last fifth in the era before's style (the outskirts).
  let left = need;
  const whole = new Set<string>();
  if (style.big) {
    const backs = plots.filter((p) => !p.won && !isCamp(p) && !middles.has(keyOf(p))).sort((a, b) => a.z - b.z);
    let n = Math.max(1, Math.round(need / 3 / style.big.worth));
    for (const p of backs) {
      if (n <= 0 || left <= 0) break;
      // A row and its workshop behind it (the industry and electricity eras), or two blocks side by side.
      const pair: [string, number, number][] =
        era === 3 || era === 4
          ? [
              [style.big.model, p.x, p.z + 0.35],
              ["workshop", p.x, p.z - 0.3],
            ]
          : [
              [style.big.model, p.x - 0.34, p.z + 0.1],
              [style.big.model, p.x + 0.34, p.z + 0.1],
            ];
      const boxes = pair.map(([m, x, z]) => boxOf(m, x, z, HOUSE_SCALE)!);
      if (!boxes.every((b) => view.fits(b)) || hiddenBy(boxes[1]!, boxes[0]!) > MOST_HIDDEN) continue;
      whole.add(keyOf(p));
      take(p);
      pair.forEach(([m, x, z], k) => {
        if (k && m !== "workshop" && left <= 0) return;
        put(m, x, z, 0, HOUSE_SCALE, litOf(x, z - k));
        view.put(boxes[k]!);
        left -= HOUSE_WORTH[m] ?? 0;
      });
      n--;
    }
  }
  const candidates = plots
    .filter((p) => !whole.has(keyOf(p)) && !isCamp(p))
    .flatMap((p) => lots(p, era).map((l) => ({ ...l, plot: p })))
    // The washing that dries by the Shelters (life/details.ts) keeps its place.
    .filter((l) => Math.hypot(l.x - LAUNDRY_AT.x, l.z - LAUNDRY_AT.z) > 0.4);
  const small = Math.max(0, left);
  let i = 0;
  for (const l of candidates) {
    if (i >= small) break;
    const model = i >= small * 0.8 && style.older ? style.older : style.small[i % style.small.length]!;
    // Only where the view sees it, and it hides nothing it should not.
    const box = boxOf(model, l.x, l.z, houseScale(model))!;
    if (!view.fits(box)) continue;
    view.put(box);
    put(model, l.x, l.z, l.turn, houseScale(model), litOf(l.x, l.z));
    take(l.plot);
    i++;
  }
  const houses = need;
  const yards = [...taken.values()];

  // The streets: the trails, and a street through each plot with houses, to the Lighthouse's square.
  const streets: [number, number][][] = TRAILS.map((t) => [...t]);
  for (const p of taken.values()) {
    if (isCamp(p)) continue;
    streets.push([
      [p.x - 0.75, p.z + 0.05],
      [p.x, p.z - 0.05],
      [p.x + 0.75, p.z + 0.05],
    ]);
    const d = Math.hypot(p.x, p.z) || 1;
    streets.push([
      [p.x - (p.x / d) * 0.2, p.z - (p.z / d) * 0.2],
      [p.x - (p.x / d) * (d - 1), p.z - (p.z / d) * (d - 1)],
    ]);
  }

  // The fields, on the plots won free of houses; their wild plants give way.
  const kinds: Record<number, FieldKind[]> = { 1: ["garden"], 2: ["garden", "orchard"], 3: ["garden", "orchard", "kelp"], 4: ["garden", "kelp", "orchard", "park"], 5: ["park", "garden", "orchard", "kelp"] };
  const fields: Field[] = [];
  const trees: Tree[] = [];
  const rows: FieldRow[] = [];
  const treeName = era >= 5 ? "life-plant-modern-tree" : "life-plant-garden-tree";
  plots
    .filter((p) => p.won && !isTaken(p))
    .forEach((p, k) => {
      const kind = kinds[era]?.[k % kinds[era]!.length];
      if (!kind) return;
      fields.push({ kind, x: p.x, z: p.z });
      // The plot's (q, r), for its field's shape (scene/island.ts, hexX and hexZ turned back).
      const r = Math.round(p.z / 1.732);
      rows.push(...fieldRows(kind, Math.round(p.x / 2 - r / 2), r, p.x, p.z));
      take(p);
      if (kind === "orchard")
        for (let j = 0; j < 7; j++) {
          const [a, r] = [(j * Math.PI) / 3, j === 6 ? 0 : 0.5];
          trees.push({ name: "life-plant-garden-tree", x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r, turn: j * 1.3, scale: 0.85 });
        }
      else if (kind === "kelp") for (const dz of [-0.3, 0, 0.3]) put("kelp-rack", p.x, p.z + dz);
      else if (kind === "garden") {
        put("scarecrow", p.x - 0.5, p.z - 0.4);
        put("barrel", p.x + 0.5, p.z - 0.4);
      } else {
        for (let j = 0; j < 5; j++) {
          const a = j * 1.256;
          trees.push({ name: "life-plant-modern-tree", x: p.x + Math.cos(a) * 0.62, z: p.z + Math.sin(a) * 0.62, turn: a, scale: 0.9 });
        }
        put("bench", p.x, p.z + 0.3);
      }
    });

  // Lamps along the streets from the workshop era; power poles along the trails and street trees from the electricity era.
  const reach = (x: number, z: number) => Math.min(...BUILT.map((b) => hexReach(x - b.x, z - b.z)));
  const onLand = (x: number, z: number) => landDepth(x, z, L).depth > 0.15;
  const clearOf = (x: number, z: number, room: number) => reach(x, z) > 0.95 + room && onLand(x, z) && pieces.every((p) => Math.hypot(p.x - x, p.z - z) > 0.26);
  if (era >= 2)
    for (const [x, z, a] of along(streets, era < 4 ? 0.9 : 0.7)) {
      const [ox, oz] = [x - Math.sin(a) * 0.14, z + Math.cos(a) * 0.14];
      if (clearOf(ox, oz, 0.05)) put("lamp", ox, oz, 0, 1, litOf(ox, oz) * 0.5);
    }
  const wires: [number, number, number, number][] = [];
  if (era >= 4) {
    let last: [number, number] | null = null;
    for (const [x, z, a] of along(TRAILS, 0.8)) {
      const [ox, oz] = [x + Math.sin(a) * 0.16, z - Math.cos(a) * 0.16];
      if (!clearOf(ox, oz, 0.05)) {
        last = null;
        continue;
      }
      put("pole", ox, oz, -a);
      if (last && Math.hypot(last[0] - ox, last[1] - oz) < 1) wires.push([last[0], last[1], ox, oz]);
      last = [ox, oz];
    }
    for (const [x, z, a] of along(streets, 0.55)) {
      const [ox, oz] = [x + Math.sin(a) * 0.2, z - Math.cos(a) * 0.2];
      if (clearOf(ox, oz, 0.2) && trees.every((t) => Math.hypot(t.x - ox, t.z - oz) > 0.3)) trees.push({ name: treeName, x: ox, z: oz, turn: x * 3, scale: 0.7 });
    }
    // Wind turbines on the far coast, behind the city, clear of the buildings' plots.
    const masts: number[] = [];
    for (const a of TURBINE_AT) {
      const r = terrainCoast(a) - 0.45;
      const [x, z] = [Math.cos(a) * r, Math.sin(a) * r];
      if (masts.length >= 3 || reach(x, z) < 1.05 || masts.some((b) => Math.abs(b - a) < 0.4)) continue;
      masts.push(a);
      put("turbine-mast", x, z, 0.4);
    }
  }

  // The port: a jetty, then quays, and boats moored, more with the eras (never on the land won).
  const sea = HARBOR_COAST.filter(([x, z]) => landDepth(x, z, L).won < 0.05);
  const quays = [0, 2, 4, 6, 8, 10][era]!;
  sea.slice(0, quays || 2).forEach(([x, z, nx, nz]) => {
    const turn = -(Math.atan2(nz, nx) + Math.PI / 2);
    if (era >= 2) put("quay", x + nx * 0.05, z + nz * 0.05, turn);
    else put("jetty", x + nx * 0.05, z + nz * 0.05, turn);
  });
  sea.slice(0, era + 1).forEach(([x, z, nx, nz], k) => {
    const turn = -(Math.atan2(nz, nx) + Math.PI / 2);
    put(era >= 3 && k % 3 !== 2 ? "motor-boat" : "sail-boat", x + nx * 0.3, z + nz * 0.3, turn);
  });

  const smoke = pieces.filter((p) => p.model === "chimneys" || p.model === "workshop").map((p) => ({ x: p.x + (p.model === "chimneys" ? 0.14 : 0.25), y: p.model === "chimneys" ? 0.82 : 0.75, z: p.z - 0.06 }));
  return { era, houses, pieces, wires, fields, trees, rows, streets, square: [0, 0.92, 1.0, 1.06, 1.12, 1.18][era]!, taken: [...taken.values()], yards, smoke };
}

/** The pieces that sit on the water, not on the ground. */
export const AFLOAT: Readonly<Record<string, number>> = { "sail-boat": SEA, "motor-boat": SEA, jetty: SEA + 0.12 };
