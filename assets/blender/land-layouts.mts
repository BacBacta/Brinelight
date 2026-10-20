/**
 * The layouts of the land's target images (owner, after the S22's worst case: the rafts become land from the Lighthouse
 * 5): where the buildings stand, which slots are land (or flooded, or being filled), the free slots' buoys and the
 * game's camera on the S22 (384 × 699 px, the band below the Tasks button and above the quest card), from the game's
 * own code. Written to assets/blender/targets/land-<city>.json, read by land_target.py.
 *
 *     npx tsx assets/blender/land-layouts.mts
 */
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import { BUILDING_IDS, RAFT_SLOTS, slotOpen, type BuildingId } from "@brinelight/shared";
import { CITY_ANGLE, CITY_FILL, CITY_FOV, buildingPoints, cityFraming } from "../../client/src/scene/framing.js";
import { terrainCoast } from "../../client/src/scene/terrainCoast.js";
import { hexX, hexZ } from "../../client/src/scene/island.js";
import { ERA_PLOTS } from "../../client/src/city/plots.js";
import { buildingScale, extraName, shownShape, stageName } from "../../client/src/city/staged.js";
import { villageAge } from "../../client/src/city/village.js";

/** The S22 (owner): 384 × 699 CSS pixels; the band below the Tasks button (154) and above the quest card (551). */
const VIEW = { width: 384, height: 699, top: 154, bottom: 551 };

type Slot = { key: string; building?: "greenhouse" | "smokehouse" | "watchtower"; level?: number; flooded?: boolean };
type City = { name: string; lighthouse: number; levels?: Partial<Record<BuildingId, number>>; slots: Slot[]; filling?: string; close?: string };

const at = (key: string) => {
  const [q, r] = key.split(",").map(Number) as [number, number];
  return { x: hexX(q, r), z: hexZ(r) };
};
const ring = (key: string) => RAFT_SLOTS.find((s) => s.key === key)!.ring;
const keys = (pred: (s: (typeof RAFT_SLOTS)[number]) => boolean) => RAFT_SLOTS.filter(pred).map((s) => s.key);

// The owner's Lighthouse 5 city: three rafts in front of the island.
const LH5 = { lighthouse: 5, refinery: 5, fishery: 4, lumberyard: 4, shelters: 5, barracks: 3, harbor: 3, observatory: 2, infirmary: 3 };
const ring3 = keys((s) => s.ring === 3);
// Lighthouse 15: fifteen slots, holes among them, three buildings on rafts, one raft damaged; the shipyard fills a slot.
const fifteen: Slot[] = ["-3,3", "-2,3", "-1,3", "0,3", "1,2", "2,1", "3,0", "3,-1", "-3,1", "-3,0", "-2,-1", "-1,-2", "0,-3", "-4,4", "-1,4"].map((key) => ({ key }));
fifteen[1] = { key: "-2,3", building: "greenhouse", level: 3 };
fifteen[4] = { key: "1,2", building: "smokehouse", level: 2 };
fifteen[9] = { key: "-3,0", building: "watchtower", level: 3 };
fifteen[2] = { key: "-1,3", flooded: true };
const all: Slot[] = RAFT_SLOTS.map((s) => ({ key: s.key }));
for (const [i, b] of [[0, "greenhouse"], [7, "smokehouse"], [14, "watchtower"], [21, "greenhouse"], [28, "smokehouse"], [35, "watchtower"]] as const) all[i] = { key: all[i]!.key, building: b, level: 3 };

const CITIES: City[] = [
  { name: "land5", lighthouse: 5, levels: LH5, slots: ["-2,3", "-1,3", "0,3"].map((key) => ({ key })) },
  { name: "land15", lighthouse: 15, slots: fifteen, filling: "2,2" },
  { name: "land30", lighthouse: 30, slots: all },
  { name: "land15-flooded", lighthouse: 15, slots: fifteen, filling: "2,2", close: "-1,3" },
  { name: "land15-filling", lighthouse: 15, slots: fifteen, filling: "2,2", close: "2,2" },
];

for (const c of CITIES) {
  const levels = Object.fromEntries(BUILDING_IDS.map((id) => [id, c.levels?.[id] ?? c.lighthouse])) as Record<BuildingId, number>;
  const buildings = BUILDING_IDS.map((id) => {
    const [q, r] = ERA_PLOTS[id];
    const shape = shownShape(id, levels[id]);
    return { id, level: levels[id], model: stageName(id, levels[id]), extra: extraName(id, levels[id]), scale: buildingScale(id), x: hexX(q, r), z: hexZ(r), reach: shape.reach, height: shape.height };
  });
  const taken = new Set(c.slots.map((s) => s.key));
  const age = villageAge(c.lighthouse);
  const slots = c.slots.map((s) => ({ ...at(s.key), key: s.key, ring: ring(s.key), building: s.building ? `${s.building}-${s.level ?? 1}-age${age}` : null, flooded: !!s.flooded }));
  // Buoys only where a raft can be moored: an open slot, free, not the one being filled.
  const free = RAFT_SLOTS.filter((s) => !taken.has(s.key) && s.key !== c.filling && slotOpen(s.ring, c.lighthouse)).map((s) => ({ key: s.key, ...at(s.key) }));
  const filling = c.filling ? { key: c.filling, ...at(c.filling) } : null;
  // The game's normal view: the land (as the rafts did) across three quarters of the width at least, every building whole.
  const tops = buildings.flatMap((b) => buildingPoints({ x: b.x, z: b.z, height: b.height, reach: b.reach }));
  const framed = [...slots, ...(filling ? [filling] : [])].map(({ x, z }) => ({ x, z }));
  let { distance, target } = cityFraming(VIEW, framed, tops, { share: CITY_FILL, coast: terrainCoast });
  if (c.close) {
    // A close look at one slot: the camera at the normal view's angle, near it.
    target = new THREE.Vector3(at(c.close).x, 0, at(c.close).z);
    distance = 7;
  }
  const position = target.clone().addScaledVector(CITY_ANGLE, distance);
  const layout = {
    lighthouse: c.lighthouse,
    look: c.lighthouse >= 25 ? "modern" : c.lighthouse >= 10 ? "garden" : "wild",
    camera: { position: position.toArray(), target: target.toArray(), fov: CITY_FOV, aspect: VIEW.width / VIEW.height, width: VIEW.width, height: VIEW.height },
    buildings,
    slots,
    free,
    filling,
  };
  const path = new URL(`targets/${c.name}.json`, import.meta.url).pathname;
  writeFileSync(path, JSON.stringify(layout, null, 1) + "\n");
  console.log(c.name, `${slots.length} land, ${free.length} buoys, distance ${distance.toFixed(2)}`);
}
