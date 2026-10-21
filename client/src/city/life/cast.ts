/**
 * Who the island's life shows, and where (week 8, meeting 4): a pure function of the city, so the same city always
 * shows the same people at the same places. Display only.
 *
 * As many survivors show as min(24, 4 + survivors ÷ 5) (owner): five for a new player. The trades come first, each
 * where its building works (the fisher on the Fishery's jetty, the woodcutter at the Lumberyard, the barrel carrier at
 * the Refinery, the gardener at a Kelp Greenhouse, the stoker at a Smokehouse, the lookout at a Watchtower's foot, these
 * three on the frontmost raft with their building), then two builders at each building site (and at the shipyard's
 * work), then passers-by on the island's trails and on the walkways between the rafts.
 */
import { RAFT_SLOTS, type BuildingId } from "@brinelight/shared";
import type { PlayerState } from "../../state/index.js";
import { hexX, hexZ } from "../../scene/island.js";
import { ERA_PLOTS } from "../plots.js";
import { BUILDING_SCALE, buildingScale, stageOf } from "../staged.js";
import { raftSlots, raftWalkways, slotPosition } from "../rafts.js";
import { VILLAGE_DECK } from "../village.js";
import type { Anim, Tool } from "./body.js";
import LAND from "./land.json";
import { SEA_RISE } from "../../scene/cityLook.js";
import { landShown } from "../words.js";

/** The most survivors shown at once, and how many show for a city of `survivors`. */
export const PEOPLE_MAX = 24;
export const peopleShown = (survivors: number): number => Math.min(PEOPLE_MAX, 4 + Math.floor(Math.max(0, survivors) / 5));

/** A point of a figure's way: on the island (`raft` null) or on a raft's deck, which bobs with it. */
export type Point = { x: number; y: number; z: number; raft: string | null };

/**
 * A figure: one point and the way it faces (`turn`, around the vertical; 0 faces +z), or a way it walks there and back
 * at `speed`. `phase` sets it apart from the others (its time in its action, where it is on its way).
 */
export type Figure = { role: "trade" | "builder" | "passer"; anim: Anim; tool: Tool | null; way: Point[]; turn: number; speed: number; phase: number };

/** The rafts' bottom under the sea (rafts.ts) and the deck's top over it: where a survivor on a raft stands. */
export const RAFT_BOTTOM = -0.62 + SEA_RISE;
export const DECK_Y = RAFT_BOTTOM + VILLAGE_DECK;
/** The floor each era lays under a building (assets/blender/parts.py, FLOOR): the Fishery's jetty stands on it. */
const FLOOR: Record<number, number> = { 1: 0, 5: 0.16, 10: 0.14, 15: 0.1, 20: 0.1, 25: 0.08, 30: 0.08 };

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const plotCenter = (id: BuildingId) => {
  const [q, r] = ERA_PLOTS[id];
  return { x: hexX(q, r), z: hexZ(r) };
};

/** A figure standing at a point of a plot (x, z from its center), facing `turn`. */
const onPlot = (id: BuildingId, x: number, z: number, y: number, turn: number) => {
  const c = plotCenter(id);
  return { way: [{ x: c.x + x, y, z: c.z + z, raft: null }], turn };
};

/**
 * A figure standing on a raft's deck at (x, z) from its center (rafts are never turned), facing `turn`; on the land won
 * from the Lighthouse 5 (words.ts, landShown), on its ground, still.
 */
let onLand = false;
const onRaft = (key: string, x: number, z: number, turn: number, above = 0) => {
  const c = slotPosition(key);
  return { way: [{ x: c.x + x, y: (onLand ? LAND_Y : DECK_Y) + above, z: c.z + z, raft: onLand ? null : key }], turn };
};
/** The land won's ground (city/land/field.ts: nearly flat at the meadow's height). */
export const LAND_Y = 0;

/** The front of a plot, where its builders and some trades stand: off the era's floor (z beyond 0.6, buildings ×1.15), on the meadow. */
export const FRONT = { x: 0.42 * BUILDING_SCALE, z: 0.74 * BUILDING_SCALE } as const;

type TrailPoint = [number, number, number];
const TRAILS = (LAND as unknown as { trails: TrailPoint[][] }).trails;

/** The island's trails (land.json, made by assets/blender/terrain.py): polylines of the game's (x, y, z), y on the ground. */
export const trails = (): readonly TrailPoint[][] => TRAILS;

/**
 * A passer-by's way: one of the island's worn trails, picked by `seed`, walked there and back a little to the right of
 * its middle (facing along it).
 */
export function trailWay(seed: number): Point[] {
  const line = TRAILS[seed % TRAILS.length]!;
  const side = (seed % 2 ? 1 : -1) * 0.02;
  return line.map(([x, y, z], i) => {
    const [ax, , az] = line[Math.max(0, i - 1)]!;
    const [bx, , bz] = line[Math.min(line.length - 1, i + 1)]!;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    return { x: x + ((bz - az) / len) * side, y, z: z - ((bx - ax) / len) * side, raft: null };
  });
}

/** A passer-by's way across a walkway: from the deck of a raft of ring 4 to the deck of the raft of ring 3 it joins. */
function walkwayWay(state: PlayerState, index: number): Point[] | null {
  const moored = raftSlots(state)
    .filter((s) => s.view === "raft" || s.view === "damaged")
    .map((s) => s.key);
  const outer = moored.filter((k) => RAFT_SLOTS.find((s) => s.key === k)!.ring === 4);
  const ways = raftWalkways(moored, () => 0).filter((w) => !w.shore);
  if (!ways.length || !outer.length) return null;
  const w = ways[index % ways.length]!;
  // The two rafts the walkway joins: the nearest of each ring to its ends.
  const [dx, dz] = [Math.sin(w.turn), Math.cos(w.turn)];
  const ends = [-1, 1].map((s) => ({ x: w.x + dx * s * (w.length / 2 + 0.3), z: w.z + dz * s * (w.length / 2 + 0.3) }));
  const nearest = (p: { x: number; z: number }) => moored.reduce((a, k) => (Math.hypot(slotPosition(k).x - p.x, slotPosition(k).z - p.z) < Math.hypot(slotPosition(a).x - p.x, slotPosition(a).z - p.z) ? k : a));
  const [a, b] = ends.map(nearest) as [string, string];
  const side = (s: number) => ({ x: w.x + dx * s * (w.length / 2), z: w.z + dz * s * (w.length / 2) });
  return [
    { ...ends[0]!, y: DECK_Y, raft: a },
    { ...side(-1), y: DECK_Y, raft: a },
    { ...side(1), y: DECK_Y, raft: b },
    { ...ends[1]!, y: DECK_Y, raft: b },
  ];
}

const built = (state: PlayerState, id: BuildingId) => state.buildings[id] >= 1;

/** The trades: one for each working building, in this order. */
function trades(state: PlayerState): Omit<Figure, "phase" | "role">[] {
  const out: Omit<Figure, "phase" | "role">[] = [];
  if (built(state, "fishery")) {
    // On the end of the Fishery's jetty (fishery.py: jetty), its rod over the sea to the east.
    // The jetty is the building's, drawn ×1.15 (staged.ts).
    const k = buildingScale("fishery");
    const y = (FLOOR[stageOf(state.buildings.fishery)]! + 0.08) * k;
    out.push({ anim: "fish", tool: "rod", speed: 0, ...onPlot("fishery", 0.84 * k, -0.04 * k, y, Math.PI / 2) });
  }
  if (built(state, "lumberyard")) out.push({ anim: "chop", tool: "axe", speed: 0, ...onPlot("lumberyard", -FRONT.x, FRONT.z, 0, (3 * Math.PI) / 4) });
  if (built(state, "refinery")) {
    const c = plotCenter("refinery");
    out.push({ anim: "carry", tool: "barrel", speed: 0.12, turn: 0, way: [-0.5, 0.35].map((x) => ({ x: c.x + x, y: 0, z: c.z + FRONT.z, raft: null })) });
  }
  // On the raft nearest the camera (the front), where it shows best; the same raft every time.
  const onRafts = (building: string) =>
    Object.entries(state.rafts)
      .filter(([, r]) => r.building === building && r.level >= 1)
      .map(([k]) => k)
      .sort((a, b) => slotPosition(b).z - slotPosition(a).z || a.localeCompare(b));
  const greenhouse = onRafts("greenhouse")[0];
  if (greenhouse) out.push({ anim: "water", tool: "can", speed: 0, ...onRaft(greenhouse, 0.56, 0.2, -Math.PI / 2) });
  const smokehouse = onRafts("smokehouse")[0];
  if (smokehouse) out.push({ anim: "stoke", tool: "poker", speed: 0, ...onRaft(smokehouse, 0.05, 0.3, Math.PI) });
  const tower = onRafts("watchtower")[0];
  // At the Watchtower's foot, its spyglass on the sea: on the platform, the tower's roof hides it from the camera.
  if (tower) out.push({ anim: "watch", tool: "spyglass", speed: 0, ...onRaft(tower, 0.32, 0.38, 0) });
  return out;
}

/** The builders: two at each building site, two at the shipyard's work (on the raft it works on). */
function builders(state: PlayerState): Omit<Figure, "phase" | "role">[] {
  const out: Omit<Figure, "phase" | "role">[] = [];
  for (const job of state.queue) {
    for (const s of [-1, 1]) out.push({ anim: "hammer", tool: "hammer", speed: 0, ...onPlot(job.id, s * FRONT.x, FRONT.z, 0, Math.PI + s * 0.5) });
  }
  const yard = state.yard;
  if (yard && "slot" in yard) {
    // The raft being built has only its back half laid: they work from there.
    const spots = yard.kind === "raft" ? [[-0.35, -0.1, 0], [0.4, -0.15, 0]] : [[-0.5, 0.3, Math.PI * 0.75], [0.5, 0.3, -Math.PI * 0.75]];
    for (const [x, z, turn] of spots) out.push({ anim: "hammer", tool: "hammer", speed: 0, ...onRaft(yard.slot, x!, z!, turn!) });
  } else if (yard && yard.kind === "repair") {
    const slot = [...yard.slots].sort()[0];
    if (slot) for (const s of [-1, 1]) out.push({ anim: "hammer", tool: "hammer", speed: 0, ...onRaft(slot, s * 0.3, 0.42, Math.PI) });
  }
  return out;
}

/** Everyone the city shows: the trades, then the builders, then the passers-by, as many as `peopleShown` allows. */
export function cast(state: PlayerState, land = landShown(state.buildings.lighthouse)): Figure[] {
  onLand = land;
  const n = peopleShown(state.survivors);
  const out: Figure[] = [];
  const add = (role: Figure["role"], f: Omit<Figure, "phase" | "role">) => out.length < n && out.push({ ...f, role, phase: hash(out.length + 1) * 20 });
  for (const f of trades(state)) add("trade", f);
  for (const f of builders(state)) add("builder", f);
  for (let i = 0; out.length < n; i++) {
    // One passer-by in three on the walkways, while there are some.
    const across = i % 3 === 2 && !land ? walkwayWay(state, Math.floor(i / 3)) : null;
    add("passer", { anim: "walk", tool: null, speed: 0.16, turn: 0, way: across ?? trailWay(i + 1) });
  }
  return out;
}

