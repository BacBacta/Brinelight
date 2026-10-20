/**
 * The floating village made in Blender (week 8, meeting 3; assets/blender/raft.py and raft_buildings.py), with ?blender:
 * the rafts, their walkways, the moorings of the rafts of ring 3, the raft the shipyard builds, the free slots' buoys and
 * the buildings on rafts at their level, in the Lighthouse's age (driftwood, tarred, steel). Each model shown is one
 * InstancedMesh, and the lit lamps one more: the draw calls grow with the kinds of things afloat, never with the rafts.
 * Only the current age's models are fetched, and the next age's while the Lighthouse's upgrade toward it runs. The
 * decks show in a light version (fewer sides, no hoops) in the normal view, and in full once the camera comes near: the
 * full ones are fetched the first time it does, never before (meeting 4, owner).
 */
import * as THREE from "three";
import { RAFT_BUILDING_MAX_LEVEL, RAFT_SLOTS, type RaftBuildingId } from "@brinelight/shared";
import { bakeModel } from "../scene/models.js";
import { CITY_MANIFEST } from "../scene/cityLook.js";
import { hexX, hexZ } from "../scene/island.js";
import type { PlayerState } from "../state/index.js";
import { loadStage } from "./staged.js";
import { reducedMotion } from "../scene/motion.js";

/** The village's three ages, by the Lighthouse's level: driftwood from 1, tarred from 10, steel from 20. */
export const VILLAGE_AGES = [1, 10, 20] as const;
export const villageAge = (lighthouse: number): number => Math.max(...VILLAGE_AGES.filter((a) => a <= Math.max(1, lighthouse)));

/** The deck's top over the floats' bottom (raft.py, DECK), where a building stands and a walkway lands. */
export const VILLAGE_DECK = 0.37;
/** The sea over the floats' bottom (raft.py, SEA): the free slot's buoys float there. */
export const VILLAGE_SEA = 0.2;

const BUILDING_IDS: readonly RaftBuildingId[] = ["greenhouse", "smokehouse", "watchtower"];
const DECKS = ["a", "b", "c", "d"] as const;

/** The decks that have a light version for the normal view. */
const LIGHT = [...DECKS, "damaged"] as const;
/** The light version of a deck, shown in the normal view. */
export const LITE = "-lite";
/** The full model of a deck's light version (other models are their own). */
export const fullName = (name: string): string => (name.endsWith(LITE) ? name.slice(0, -LITE.length) : name);

/** Every model of the village in an age (and the free slot's, the same in all). */
export function villageNames(age: number): string[] {
  const out = [...LIGHT.flatMap((v) => [`raft-${v}-age${age}`, `raft-${v}-age${age}${LITE}`]), `raft-yard-age${age}`, `raft-walk-age${age}`, `raft-moor-age${age}`];
  for (const id of BUILDING_IDS) for (let level = 1; level <= RAFT_BUILDING_MAX_LEVEL; level++) out.push(`${id}-${level}-age${age}`);
  return out;
}

/** The models of an age the normal view shows: all but the decks' full models. */
export const villageNormalNames = (age: number): string[] => villageNames(age).filter((n) => !LIGHT.some((v) => n === `raft-${v}-age${age}`));

/** The village is made: every age's models are in the manifest. */
export const hasVillage = (): boolean => [...VILLAGE_AGES.flatMap(villageNames), "raft-free"].every((n) => CITY_MANIFEST[n]);

/** A deck's light version, as the normal view shows it. */
export const deckName = (variant: number, age: number): string => `raft-${DECKS[variant % DECKS.length]}-age${age}${LITE}`;
export const raftBuildingName = (id: RaftBuildingId, level: number, age: number): string => `${id}-${Math.min(RAFT_BUILDING_MAX_LEVEL, Math.max(1, level))}-age${age}`;

/** What a slot shows (rafts.ts, raftSlots), with its deck's variant. */
export type VillageSlot = { key: string; view: "raft" | "damaged" | "building" | "free"; variant: number };

/** The model each slot and each building on a raft shows, in the Lighthouse's age; and the walkway's and the mooring's. */
export function villageModels(slots: readonly VillageSlot[], rafts: PlayerState["rafts"], lighthouse: number): { slots: Map<string, string>; buildings: Map<string, string>; walk: string; moor: string } {
  const age = villageAge(lighthouse);
  const out = new Map<string, string>();
  const buildings = new Map<string, string>();
  for (const s of slots) {
    out.set(s.key, s.view === "free" ? "raft-free" : s.view === "damaged" ? `raft-damaged-age${age}${LITE}` : s.view === "building" ? `raft-yard-age${age}` : deckName(s.variant, age));
    const raft = rafts[s.key];
    if (raft?.building && s.view !== "free" && s.view !== "building") buildings.set(s.key, raftBuildingName(raft.building, raft.level, age));
  }
  return { slots: out, buildings, walk: `raft-walk-age${age}`, moor: `raft-moor-age${age}` };
}

const ringOf = (key: string): number => RAFT_SLOTS.find((s) => s.key === key)?.ring ?? 0;
const afloat = (s: VillageSlot) => s.view === "raft" || s.view === "damaged";

/** The models a city's village shows at once: what its first image waits for. */
export function villageShown(slots: readonly VillageSlot[], rafts: PlayerState["rafts"], lighthouse: number): string[] {
  const m = villageModels(slots, rafts, lighthouse);
  const moored = slots.filter(afloat).map((s) => ringOf(s.key));
  return [...new Set([...m.slots.values(), ...m.buildings.values(), ...(moored.includes(4) ? [m.walk] : []), ...(moored.includes(3) ? [m.moor] : [])])];
}

/** How far from a raft's center of ring 3 its mooring's stake stands on the beach (raft.py, MOOR_STAKE). */
export const MOOR_STAKE = 1.0;
/** How far beside the middle of the raft's side its mooring runs, clear of where a walkway would land. */
export const MOOR_ASIDE = 0.24;

/** A mooring: its stake on the beach (the meadow's height), turned so its rope runs toward its raft. */
export type Mooring = { key: string; x: number; z: number; turn: number };

/**
 * The moorings of the rafts of ring 3: too close to the shore for a walkway (0.08 of water across their side facing the
 * island), each is tied to a stake on the beach of the plot beside it (the first of rings 0 to 2 in the slots' order of
 * neighbors, a fixed rule). Pure: the same rafts always get the same moorings.
 */
export function raftMoorings(moored: readonly string[]): Mooring[] {
  const out: Mooring[] = [];
  for (const key of moored) {
    const s = RAFT_SLOTS.find((x) => x.key === key);
    if (!s || s.ring !== 3) continue;
    const plot = NEIGHBORS.map(([dq, dr]) => [s.q + dq, s.r + dr] as const).find(([q, r]) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2);
    if (!plot) continue;
    const [x, z] = [hexX(s.q, s.r), hexZ(s.r)];
    const [dx, dz] = [(hexX(plot[0], plot[1]) - x) / 2, (hexZ(plot[1]) - z) / 2];
    // Toward the plot, then aside along the raft's side (a quarter turn of that direction).
    const sx = x + dx * MOOR_STAKE - dz * MOOR_ASIDE;
    const sz = z + dz * MOOR_STAKE + dx * MOOR_ASIDE;
    out.push({ key, x: sx, z: sz, turn: Math.atan2(-dx, -dz) });
  }
  return out;
}

/** The six slots around a slot, in axial coordinates (the order of rafts.ts). */
const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
] as const;

export type Placed = { name: string; x: number; z: number; y: number; bob?: number; turn?: number; length?: number };

/**
 * The warm light of a lit lamp: a soft round glow, white at its heart and amber at its rim, so it shows on the beach's
 * sand as on the sea (no real light: too costly on a phone).
 */
function glowTexture(): THREE.DataTexture {
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const d = Math.min(1, Math.hypot(i - (n - 1) / 2, j - (n - 1) / 2) / (n / 2));
      const heart = Math.max(0, 1 - d * 2);
      data.set([255, Math.round(178 + 72 * heart), Math.round(70 + 170 * heart), Math.round(Math.min(1, (1 - d) ** 1.6 * 1.5) * 255)], (i * n + j) * 4);
    }
  const t = new THREE.DataTexture(data, n, n);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

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
  // The lit lamps (the steel age's): one point each, all in one draw call, moving with their rafts.
  const lampsAt = new Float32Array(max * 4 * 3);
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute("position", new THREE.BufferAttribute(lampsAt, 3));
  // Brighter than white: at full quality, only the lit lamps are bright enough to glow (post.ts, BLOOM); at the other
  // steps, the screen just shows them white and amber, as before.
  const glowMaterial = new THREE.PointsMaterial({ size: 2.4, color: new THREE.Color(2.6, 2.3, 1.8), map: glowTexture(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false });
  const glow = new THREE.Points(glowGeometry, glowMaterial);
  // Out by day (style pass, owner): lit as the light falls, in the Mist.
  let lit = 0;
  glow.name = "lamps";
  glow.frustumCulled = false;
  add(glow);
  const drawn: THREE.Object3D[] = [glow];

  // Near (zoomed in or in the close view): the decks' full models, once they are there.
  let near = false;
  const shownAs = (name: string) => (near && meshes.has(fullName(name)) ? fullName(name) : name);
  const lay = (now: number) => {
    const counts = new Map<string, number>();
    let lamps = 0;
    for (const it of placed) {
      const name = shownAs(it.name);
      const mesh = meshes.get(name);
      if (!mesh) continue;
      const i = counts.get(name) ?? 0;
      counts.set(name, i + 1);
      const y = it.y + (it.bob === undefined ? 0 : Math.sin(now * 1.3 + it.bob) * 0.04);
      mesh.setMatrixAt(i, m4.compose(p.set(it.x, y, it.z), q.setFromAxisAngle(up, it.turn ?? 0), sc.set(1, 1, it.length ?? 1)));
      // A raft is never turned: its lamps are where the model says, moved to it.
      for (const [lx, ly, lz] of CITY_MANIFEST[name]?.lamps ?? []) if (lamps < lampsAt.length / 3) lampsAt.set([it.x + lx!, y + ly!, it.z + lz!], 3 * lamps++);
    }
    glowGeometry.setDrawRange(0, lamps);
    glowGeometry.getAttribute("position").needsUpdate = true;
    glow.visible = lamps > 0 && lit > 0.02;
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
      for (const it of items) fetch(near ? fullName(it.name) : it.name);
      lay(0);
    },
    /**
     * How much nearer the camera is than in the normal view (SceneHandle.closeness): from 1.15 the decks show in full
     * (fetched the first time), back under 1.05 in their light version.
     */
    /** How far the light has fallen (0 the late afternoon, 1 the Mist): the lamps glow as much. */
    setDimness(dimness: number) {
      if (Math.abs(dimness - lit) < 0.01) return;
      lit = dimness;
      glowMaterial.opacity = lit;
      glow.visible = glowGeometry.drawRange.count > 0 && lit > 0.02;
    },
    setCloseness(closeness: number) {
      const next = near ? closeness > 1.05 : closeness > 1.15;
      if (next === near) return;
      near = next;
      if (near) for (const it of placed) fetch(fullName(it.name));
      lay(0);
    },
    /** Fetches models ahead (the next age while the Lighthouse's upgrade runs). */
    prefetch(names: readonly string[]) {
      for (const n of names) void loadStage(n);
    },
    /** With reduced motion, the rafts ride still (as the island's life stands). */
    animate(now: number) {
      if (placed.some((it) => it.bob !== undefined)) lay(reducedMotion() ? 0 : now);
    },
  };
}

export type Village = ReturnType<typeof createVillage>;
