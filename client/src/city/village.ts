/**
 * The floating village made in Blender (week 8, meeting 3; assets/blender/raft.py and raft_buildings.py), with ?blender:
 * the rafts, their walkways, the raft the shipyard builds, the free slots' buoys and the buildings on rafts at their
 * level, in the Lighthouse's age (driftwood, tarred, steel). Each model shown is one InstancedMesh: the draw calls grow
 * with the kinds of things afloat, never with the rafts. Only the current age's models are fetched, and the next age's
 * while the Lighthouse's upgrade toward it runs.
 */
import * as THREE from "three";
import { RAFT_BUILDING_MAX_LEVEL, type RaftBuildingId } from "@brinelight/shared";
import { bakeModel } from "../scene/models.js";
import { CITY_MANIFEST } from "../scene/cityLook.js";
import type { PlayerState } from "../state/index.js";
import { loadStage } from "./staged.js";

/** The village's three ages, by the Lighthouse's level: driftwood from 1, tarred from 10, steel from 20. */
export const VILLAGE_AGES = [1, 10, 20] as const;
export const villageAge = (lighthouse: number): number => Math.max(...VILLAGE_AGES.filter((a) => a <= Math.max(1, lighthouse)));

/** The deck's top over the floats' bottom (raft.py, DECK), where a building stands and a walkway lands. */
export const VILLAGE_DECK = 0.37;
/** The sea over the floats' bottom (raft.py, SEA): the free slot's buoys float there. */
export const VILLAGE_SEA = 0.2;

const BUILDING_IDS: readonly RaftBuildingId[] = ["greenhouse", "smokehouse", "watchtower"];
const DECKS = ["a", "b", "c"] as const;

/** Every model of the village in an age (and the free slot's, the same in all). */
export function villageNames(age: number): string[] {
  const out = [...DECKS.map((v) => `raft-${v}-age${age}`), `raft-damaged-age${age}`, `raft-yard-age${age}`, `raft-walk-age${age}`];
  for (const id of BUILDING_IDS) for (let level = 1; level <= RAFT_BUILDING_MAX_LEVEL; level++) out.push(`${id}-${level}-age${age}`);
  return out;
}

/** The village is made: every age's models are in the manifest. */
export const hasVillage = (): boolean => [...VILLAGE_AGES.flatMap(villageNames), "raft-free"].every((n) => CITY_MANIFEST[n]);

export const deckName = (variant: number, age: number): string => `raft-${DECKS[variant % 3]}-age${age}`;
export const raftBuildingName = (id: RaftBuildingId, level: number, age: number): string => `${id}-${Math.min(RAFT_BUILDING_MAX_LEVEL, Math.max(1, level))}-age${age}`;

/** What a slot shows (rafts.ts, raftSlots), with its deck's variant. */
export type VillageSlot = { key: string; view: "raft" | "damaged" | "building" | "free"; variant: number };

/** The model each slot and each building on a raft shows, in the Lighthouse's age; and the walkway's. */
export function villageModels(slots: readonly VillageSlot[], rafts: PlayerState["rafts"], lighthouse: number): { slots: Map<string, string>; buildings: Map<string, string>; walk: string } {
  const age = villageAge(lighthouse);
  const out = new Map<string, string>();
  const buildings = new Map<string, string>();
  for (const s of slots) {
    out.set(s.key, s.view === "free" ? "raft-free" : s.view === "damaged" ? `raft-damaged-age${age}` : s.view === "building" ? `raft-yard-age${age}` : deckName(s.variant, age));
    const raft = rafts[s.key];
    if (raft?.building && s.view !== "free" && s.view !== "building") buildings.set(s.key, raftBuildingName(raft.building, raft.level, age));
  }
  return { slots: out, buildings, walk: `raft-walk-age${age}` };
}

/** The models a city's village shows at once: what its first image waits for. */
export function villageShown(slots: readonly VillageSlot[], rafts: PlayerState["rafts"], lighthouse: number, walkways: boolean): string[] {
  const m = villageModels(slots, rafts, lighthouse);
  return [...new Set([...m.slots.values(), ...m.buildings.values(), ...(walkways ? [m.walk] : [])])];
}

export type Placed = { name: string; x: number; z: number; y: number; bob?: number; turn?: number; length?: number };

/**
 * The village's meshes: one InstancedMesh per model, made when its model comes. `show` lays every instance; `bob`
 * moves those that float with the rafts' bob, each frame.
 */
export function createVillage(add: (o: THREE.Object3D) => void, max: number) {
  const meshes = new Map<string, THREE.InstancedMesh>();
  const asked = new Set<string>();
  let placed: Placed[] = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const drawn: THREE.Object3D[] = [];

  const lay = (now: number) => {
    const counts = new Map<string, number>();
    for (const it of placed) {
      const mesh = meshes.get(it.name);
      if (!mesh) continue;
      const i = counts.get(it.name) ?? 0;
      counts.set(it.name, i + 1);
      const y = it.y + (it.bob === undefined ? 0 : Math.sin(now * 1.3 + it.bob) * 0.04);
      mesh.setMatrixAt(i, m4.compose(p.set(it.x, y, it.z), q.setFromAxisAngle(up, it.turn ?? 0), sc.set(1, 1, it.length ?? 1)));
    }
    for (const [name, mesh] of meshes) {
      mesh.count = counts.get(name) ?? 0;
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  const fetch = (name: string) => {
    if (asked.has(name)) return;
    asked.add(name);
    void loadStage(name).then((model) => {
      const { geometry, material } = bakeModel(model);
      const mesh = new THREE.InstancedMesh(geometry, material, max);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      meshes.set(name, mesh);
      drawn.push(mesh);
      add(mesh);
      lay(0);
    });
  };

  return {
    /** The meshes drawn (draw calls). */
    meshes: drawn,
    /** Lays these instances, fetching the models not there yet. */
    show(items: Placed[]) {
      placed = items;
      for (const it of items) fetch(it.name);
      lay(0);
    },
    /** Fetches models ahead (the next age while the Lighthouse's upgrade runs). */
    prefetch(names: readonly string[]) {
      for (const n of names) void loadStage(n);
    },
    animate(now: number) {
      if (placed.some((it) => it.bob !== undefined)) lay(now);
    },
  };
}

export type Village = ReturnType<typeof createVillage>;
