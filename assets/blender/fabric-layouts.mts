/**
 * The layouts of the city fabric's target images (owner, 21 October: houses, streets, a square, one equipment per era,
 * fields, the port, lit windows), step 1: the same city at the Lighthouses 3, 7, 12, 17, 22 and 30, seen by the game's
 * camera on the S22 (384 × 699 px, the band below the Tasks button and above the quest card). Its buildings' levels,
 * its rafts and its Shelters are the balance simulator's regular player on the day it reaches each Lighthouse
 * (docs/balance/days.csv); the room for survivors follows the Shelters (survivorCap). Nothing in the game changes.
 * Written to assets/blender/targets/fabric-<lighthouse>.json, read by fabric_target.py; fabric-worst.json is the
 * budget's worst city (every slot land, the Shelters at 30), never rendered.
 *
 *     npx tsx assets/blender/fabric-layouts.mts
 */
import { writeFileSync } from "node:fs";
import { BUILDING_IDS, RAFT_SLOTS, slotOpen, survivorCap, type BuildingId } from "@brinelight/shared";
import { CITY_ANGLE, CITY_FILL, CITY_FOV, buildingPoints, cityFraming } from "../../client/src/scene/framing.js";
import { terrainCoast } from "../../client/src/scene/terrainCoast.js";
import { hexX, hexZ } from "../../client/src/scene/island.js";
import { ERA_PLOTS } from "../../client/src/city/plots.js";
import { buildingScale, extraName, shownShape, stageName } from "../../client/src/city/staged.js";
import { LAND_FROM } from "../../client/src/city/words.js";

/** The S22 (owner): 384 × 699 CSS pixels; the band below the Tasks button (154) and above the quest card (551). */
const VIEW = { width: 384, height: 699, top: 154, bottom: 551 };

type Levels = Omit<Record<BuildingId, number>, "lighthouse">;
type City = { name: string; lighthouse: number; levels: Levels; rafts: number };

// The regular player of the simulator, the first day at each Lighthouse (days.csv). At the Lighthouse 3 (before the
// simulator's first day, at 4), the same city one level lower, without its Harbor yet.
const CITIES: City[] = [
  { name: "fabric-3", lighthouse: 3, levels: { refinery: 1, fishery: 1, lumberyard: 1, shelters: 1, barracks: 1, harbor: 0, observatory: 0, infirmary: 0 }, rafts: 0 },
  { name: "fabric-7", lighthouse: 7, levels: { refinery: 2, fishery: 1, lumberyard: 3, shelters: 1, barracks: 1, harbor: 1, observatory: 1, infirmary: 1 }, rafts: 0 },
  { name: "fabric-12", lighthouse: 12, levels: { refinery: 4, fishery: 4, lumberyard: 6, shelters: 4, barracks: 4, harbor: 4, observatory: 4, infirmary: 3 }, rafts: 2 },
  { name: "fabric-17", lighthouse: 17, levels: { refinery: 8, fishery: 8, lumberyard: 9, shelters: 8, barracks: 8, harbor: 8, observatory: 8, infirmary: 7 }, rafts: 7 },
  { name: "fabric-22", lighthouse: 22, levels: { refinery: 11, fishery: 11, lumberyard: 14, shelters: 11, barracks: 11, harbor: 10, observatory: 11, infirmary: 10 }, rafts: 7 },
  { name: "fabric-30", lighthouse: 30, levels: { refinery: 15, fishery: 15, lumberyard: 19, shelters: 14, barracks: 14, harbor: 14, observatory: 14, infirmary: 14 }, rafts: 7 },
  { name: "fabric-worst", lighthouse: 30, levels: { refinery: 30, fishery: 30, lumberyard: 30, shelters: 30, barracks: 30, harbor: 30, observatory: 30, infirmary: 30 }, rafts: RAFT_SLOTS.length },
];

const ERA_NAMES = ["salvage", "colony", "workshop", "industry", "electricity", "modern"] as const;
const eraOf = (lighthouse: number) => Math.min(5, Math.floor(Math.max(1, lighthouse) / 5));

// The rafts go first where the camera sees them: ring 3 before ring 4, the front (+z) first.
const ORDER = [...RAFT_SLOTS].sort((a, b) => a.ring - b.ring || hexZ(b.r) - hexZ(a.r) || hexX(a.q, a.r) - hexX(b.q, b.r));

for (const c of CITIES) {
  const levels: Record<BuildingId, number> = { lighthouse: c.lighthouse, ...c.levels };
  const buildings = BUILDING_IDS.filter((id) => levels[id] > 0).map((id) => {
    const [q, r] = ERA_PLOTS[id];
    const shape = shownShape(id, levels[id]);
    return { id, level: levels[id], model: stageName(id, levels[id]), extra: extraName(id, levels[id]), scale: buildingScale(id), x: hexX(q, r), z: hexZ(r), reach: shape.reach, height: shape.height };
  });
  const land = c.lighthouse >= LAND_FROM;
  const taken = ORDER.slice(0, c.rafts);
  const slots = land ? taken.map((s) => ({ key: s.key, x: hexX(s.q, s.r), z: hexZ(s.r), ring: s.ring, building: null, flooded: false })) : [];
  const keys = new Set(taken.map((s) => s.key));
  const free = RAFT_SLOTS.filter((s) => !keys.has(s.key) && slotOpen(s.ring, c.lighthouse)).map((s) => ({ key: s.key, x: hexX(s.q, s.r), z: hexZ(s.r) }));
  const edges = slots.flatMap(({ x, z }) => Array.from({ length: 12 }, (_, i) => ({ x: x + Math.cos((i * Math.PI) / 6) * 1.25, y: 0, z: z + Math.sin((i * Math.PI) / 6) * 1.25 })));
  const tops = [...buildings.flatMap((b) => buildingPoints({ x: b.x, z: b.z, height: b.height, reach: b.reach })), ...edges];
  const { distance, target } = cityFraming(VIEW, slots.map(({ x, z }) => ({ x, z })), tops, { share: CITY_FILL, coast: terrainCoast });
  const position = target.clone().addScaledVector(CITY_ANGLE, distance);
  const era = eraOf(c.lighthouse);
  const layout = {
    lighthouse: c.lighthouse,
    era,
    eraName: ERA_NAMES[era],
    look: c.lighthouse >= 25 ? "modern" : c.lighthouse >= 10 ? "garden" : "wild",
    // The room for survivors the Shelters give: what the houses follow.
    room: survivorCap(levels.shelters),
    camera: { position: position.toArray(), target: target.toArray(), fov: CITY_FOV, aspect: VIEW.width / VIEW.height, width: VIEW.width, height: VIEW.height },
    buildings,
    slots,
    free: land ? free : [],
    filling: null,
  };
  const path = new URL(`targets/${c.name}.json`, import.meta.url).pathname;
  writeFileSync(path, JSON.stringify(layout, null, 1) + "\n");
  console.log(c.name, `era ${layout.eraName}, room for ${layout.room}, ${slots.length} plots won, distance ${distance.toFixed(2)}`);
}
