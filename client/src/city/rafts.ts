/**
 * The raft slots around the island: the floating village made in Blender (village.ts) draws the rafts, their walkways
 * and moorings, the raft the shipyard builds, the free slots' buoys and the buildings on rafts; from the Lighthouse 5
 * the rafts are land (city/land) and only their buildings stand, on it. Here: what each slot shows, the free slots'
 * golden marks and the shapes a tap is tested against. No 3D label: the sheet and the queue say it.
 */
import * as THREE from "three";
import { RAFT_DAMAGED_BELOW, RAFT_SLOTS, canAddRaft, raftCap, slotOpen, yardSlot, type RaftBuildingId } from "@brinelight/shared";
import { RAFT_BUILDING_IDS, hexX, hexZ } from "../scene/index.js";
import { RAFT_FILL } from "../scene/coast.js";
import type { PlayerState } from "../state/index.js";
import { VILLAGE_DECK, VILLAGE_SEA, raftMoorings, villageAge, villageModels, villageNormalNames, type Placed, type Village } from "./village.js";
import { SEA_RISE } from "../scene/cityLook.js";
import { landShown } from "./words.js";
import { landSlotsOf } from "./land/index.js";
import { ground as groundAt } from "./land/field.js";

export type RaftSlotView = "raft" | "damaged" | "building" | "free";

/** What each slot shows: a raft (sound or damaged), the shipyard at work, a free lit slot, or nothing. */
export function raftSlots(state: PlayerState): { key: string; view: RaftSlotView }[] {
  const lighthouse = state.buildings.lighthouse;
  // Free slots are shown only when a raft can be started: below the Lighthouse's limit and with the shipyard free.
  const open = !state.yard && Object.keys(state.rafts).length < raftCap(lighthouse);
  const out: { key: string; view: RaftSlotView }[] = [];
  for (const s of RAFT_SLOTS) {
    const raft = state.rafts[s.key];
    if (raft) out.push({ key: s.key, view: raft.hp < RAFT_DAMAGED_BELOW ? "damaged" : "raft" });
    else if (yardSlot(state.yard) === s.key) out.push({ key: s.key, view: "building" });
    else if (open && slotOpen(s.ring, lighthouse)) out.push({ key: s.key, view: "free" });
  }
  return out;
}

/** The world position of a slot (prototype: hx, hz). */
export const slotPosition = (key: string) => {
  const s = RAFT_SLOTS.find((x) => x.key === key)!;
  return { x: hexX(s.q, s.r), z: hexZ(s.r), q: s.q };
};

/** The buildings standing on rafts, by type, each with its slot: a building is drawn only once its work is done. */
export function raftBuildingsShown(state: PlayerState): Record<RaftBuildingId, string[]> {
  const out = Object.fromEntries(RAFT_BUILDING_IDS.map((id) => [id, [] as string[]])) as Record<RaftBuildingId, string[]>;
  for (const s of RAFT_SLOTS) {
    const b = state.rafts[s.key]?.building;
    if (b) out[b].push(s.key);
  }
  return out;
}

/** The village's decks (raft.py: a mast, nets, planters, a deck garden). */
export const DECK_VARIANTS = 4;

/**
 * With the four decks (style pass, owner: no monotonous ring), each slot's: a hash of the slot, the next one up when
 * a neighbor already has it, in the slots' order. Fixed, never random: the same raft looks the same everywhere, and
 * two rafts side by side never look alike.
 */
const VARIED = (() => {
  const out = new Map<string, number>();
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]] as const;
  for (const s of RAFT_SLOTS) {
    const taken = new Set(near.map(([dq, dr]) => RAFT_SLOTS.find((o) => o.q === s.q + dq && o.r === s.r + dr)?.key).map((k) => (k ? out.get(k) : undefined)));
    const h = (Math.imul(s.q + 17, 73856093) ^ Math.imul(s.r + 31, 19349663)) >>> 0;
    let v = h % DECK_VARIANTS;
    while (taken.has(v)) v = (v + 1) % DECK_VARIANTS;
    out.set(s.key, v);
  }
  return out;
})();

/** Which of the village's four decks a slot shows (above). */
export const raftVariant = (key: string): number => VARIED.get(key)!;

/** The six slots around a slot, in axial coordinates. */
const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
] as const;

/**
 * A walkway: its middle on the water, its direction (turn around the vertical, its length along +z turned), its length;
 * `shore` when it runs from a raft of ring 3 to the island.
 */
export type Walkway = { x: number; z: number; turn: number; length: number; shore?: boolean };

/** How far a walkway reaches onto a raft's deck, or onto the island's shore. */
export const WALKWAY_GRIP = 0.12;

/**
 * The walkways of the floating village, one per raft, toward the island: a raft of ring 3 to the island's shore
 * (`coastAt`), a raft of ring 4 to a raft of ring 3 beside it (the first of its neighbors in NEIGHBORS order, a fixed
 * rule), or none while no raft of ring 3 is moored beside it. Pure: the same rafts always get the same walkways.
 */
export function raftWalkways(moored: readonly string[], coastAt: (angle: number) => number): Walkway[] {
  const here = new Set(moored);
  const out: Walkway[] = [];
  for (const key of moored) {
    const s = RAFT_SLOTS.find((x) => x.key === key)!;
    const x = hexX(s.q, s.r);
    const z = hexZ(s.r);
    if (s.ring === 3) {
      const d = Math.hypot(x, z);
      // From the raft's side facing the island to the shore, along the line to the island's center.
      const from = d - RAFT_FILL + WALKWAY_GRIP;
      const to = coastAt(Math.atan2(z, x)) - WALKWAY_GRIP;
      if (from > to) {
        const mid = (from + to) / 2;
        out.push({ x: (x / d) * mid, z: (z / d) * mid, turn: Math.atan2(-x, -z), length: from - to, shore: true });
      }
      continue;
    }
    const inner = NEIGHBORS.map(([dq, dr]) => RAFT_SLOTS.find((o) => o.q === s.q + dq && o.r === s.r + dr)).find((o) => o && o.ring === 3 && here.has(o.key));
    if (!inner) continue;
    const ox = hexX(inner.q, inner.r);
    const oz = hexZ(inner.r);
    const gap = Math.hypot(ox - x, oz - z) - 2 * RAFT_FILL;
    out.push({ x: (x + ox) / 2, z: (z + oz) / 2, turn: Math.atan2(ox - x, oz - z), length: gap + 2 * WALKWAY_GRIP });
  }
  return out;
}

export type CityRafts = {
  /** The shapes a tap is tested against: the slots, and the buildings on rafts once they are loaded. */
  hits: THREE.Object3D[];
  /** The slot a tap landed on. */
  slotOf(hit: THREE.Intersection): string | null;
  refresh(state: PlayerState): void;
  /** Rafts bob on the water; free slots pulse. */
  animate(now: number): void;
  /** The meshes drawn here (the free slots' marks, the tap shapes), whatever the number of rafts (draw calls). */
  readonly meshes: THREE.Object3D[];
  /** While a free slot's sheet is open (placing a raft): every free slot shows its marks. */
  setPlacing(on: boolean): void;
};

/**
 * The free slots that show their buoys and golden marks (style pass, owner): those a
 * raft can be moored on now (the shipyard free, the resources there), or all of them while placing one. Nothing on
 * the water otherwise; every free slot still answers a tap.
 */
export function markedSlots(state: PlayerState, placing: boolean): Set<string> {
  const free = raftSlots(state).filter((s) => s.view === "free").map((s) => s.key);
  if (placing) return new Set(free);
  const ctx = { rafts: state.rafts, lighthouse: state.buildings.lighthouse, stock: state.stock, yardBusy: state.yard !== null };
  return new Set(free.filter((slot) => canAddRaft({ ...ctx, slot }).ok));
}

const MAX = RAFT_SLOTS.length;
/**
 * The room of a raft: the hexagon of its slot (whose sides are 1 from its center), shrunk to RAFT_FILL. Two rafts side by
 * side then have 2 × (1 − RAFT_FILL) of water between them, and a raft of ring 3 a little less to the island's shore.
 */
export { RAFT_FILL };
/** The widest a raft can be: its room's hexagon, corner to corner. */
export const RAFT_WIDTH = (2 * RAFT_FILL) / Math.cos(Math.PI / 6);
const RAFT_BOTTOM = -0.62 + SEA_RISE;
/** Where a raft is in its bob (`sin(now × 1.3 + phase) × 0.04`): a hash of its place, never randomness. */
export const bobPhase = (x: number, z: number): number => Math.abs(x * 7.3 + z * 3.1) % 6.28;
/** How high a raft at (x, z) rides on the water at `now`. */
export const bobAt = (x: number, z: number, now: number): number => Math.sin(now * 1.3 + bobPhase(x, z)) * 0.04;
/**
 * A free slot's golden marks: at each corner of its room's hexagon (pointing along z, as the buoys: raft.py), two short
 * strokes along its sides, `length` long and `width` wide, flat on the water.
 */
export function cornerMarks(room: number, length: number, width: number): THREE.BufferGeometry {
  const corner = (k: number) => new THREE.Vector2(Math.cos(Math.PI / 2 + (k * Math.PI) / 3), Math.sin(Math.PI / 2 + (k * Math.PI) / 3)).multiplyScalar(room);
  const points: number[] = [];
  for (let k = 0; k < 6; k++) {
    const c = corner(k);
    for (const n of [corner(k + 1), corner(k + 5)]) {
      const along = n.clone().sub(c).normalize();
      // Inward, toward the slot's middle.
      const inward = c.clone().multiplyScalar(-1).normalize();
      const side = new THREE.Vector2(-along.y, along.x);
      if (side.dot(inward) < 0) side.negate();
      const [a, b] = [c, c.clone().addScaledVector(along, length)];
      const [a2, b2] = [a.clone().addScaledVector(side, width), b.clone().addScaledVector(side, width)];
      for (const p of [a, b, b2, a, b2, a2]) points.push(p.x, 0, p.y);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** The free slots' marks and the tap shapes; the village (village.ts) draws everything else, on the water or on the land. */
export function createCityRafts(add: (o: THREE.Object3D) => void, coastAt: (angle: number) => number, village: Village): CityRafts {
  const room = RAFT_FILL / Math.cos(Math.PI / 6);
  // The free slots are the village's buoys and a thin rope, golden marks at their corners and no fill: from the city's
  // height, no grid reads on the water (style pass, owner).
  const ringM = new THREE.MeshBasicMaterial({ color: "#FFE27A", transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.InstancedMesh(cornerMarks(room, 0.16, 0.035), ringM, MAX);
  const hit = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1.4, 6), new THREE.MeshBasicMaterial({ visible: false }), MAX);
  const meshes = [ring, hit];
  for (const m of meshes) {
    m.count = 0;
    m.frustumCulled = false;
    add(m);
  }
  const m4 = new THREE.Matrix4();
  let hitSlots: string[] = [];
  let key = "";
  let placing = false;
  let last: PlayerState | null = null;

  return {
    hits: [hit],
    meshes,
    slotOf(h) {
      if (h.instanceId === undefined || h.object !== hit) return null;
      return hitSlots[h.instanceId] ?? null;
    },
    setPlacing(on) {
      if (on === placing) return;
      placing = on;
      if (last) this.refresh(last);
    },
    refresh(state) {
      last = state;
      const slots = raftSlots(state);
      const marked = markedSlots(state, placing);
      // From the Lighthouse 5 the rafts are land (city/land): no deck, walkway nor mooring.
      const land = landShown(state.buildings.lighthouse);
      const k = JSON.stringify([slots, raftBuildingsShown(state), [...marked], land]);
      if (k === key) return;
      key = k;
      hitSlots = [];
      let free = 0;
      const lighthouse = state.buildings.lighthouse;
      const shown = villageModels(
        slots.map((x) => ({ ...x, variant: raftVariant(x.key) })),
        state.rafts,
        lighthouse,
      );
      const items: Placed[] = [];
      const ground = land ? landSlotsOf(state) : null;
      for (const s of slots) {
        const { x, z } = slotPosition(s.key);
        hit.setMatrixAt(hitSlots.length, m4.makeTranslation(x, 0.5, z));
        hitSlots.push(s.key);
        // A free slot nobody can fill now shows nothing on the water; it still answers a tap.
        if (s.view === "free" && !marked.has(s.key)) continue;
        if (s.view === "free") ring.setMatrixAt(free++, m4.makeTranslation(x, -0.19, z));
        if (ground && s.view !== "free") {
          // The land won draws the plot, the flood and the landfill; its building stands on its ground, still.
          const b = shown.buildings.get(s.key);
          if (b) items.push({ name: b, x, z, y: groundAt(x, z, ground).y - 0.005 });
          continue;
        }
        // Hash of the slot, never randomness: the same raft looks the same on every device.
        const bob = s.view === "free" ? undefined : bobPhase(x, z);
        items.push({ name: shown.slots.get(s.key)!, x, z, y: s.view === "free" ? RAFT_BOTTOM + VILLAGE_SEA : RAFT_BOTTOM, bob });
        const b = shown.buildings.get(s.key);
        if (b) items.push({ name: b, x, z, y: RAFT_BOTTOM + VILLAGE_DECK, bob });
      }
      if (!land) {
        // The walkways, from rafts of ring 4 to ring 3; a raft of ring 3 lies too close to the shore for one: it is
        // moored to a stake on the beach instead.
        const moored = slots.filter((x) => x.view === "raft" || x.view === "damaged").map((x) => x.key);
        for (const w of raftWalkways(moored, coastAt)) if (!w.shore) items.push({ name: shown.walk, x: w.x, z: w.z, y: RAFT_BOTTOM + VILLAGE_DECK - 0.01, turn: w.turn, length: w.length });
        for (const m of raftMoorings(moored)) items.push({ name: shown.moor, x: m.x, z: m.z, y: 0, turn: m.turn });
      }
      village.show(items);
      // The next age's buildings, while the Lighthouse's upgrade toward it runs.
      const next = villageAge(lighthouse + 1);
      if (next !== villageAge(lighthouse) && state.queue.some((j) => j.id === "lighthouse")) village.prefetch(villageNormalNames(next));
      ring.count = free;
      hit.count = hitSlots.length;
      for (const m of [ring, hit]) m.instanceMatrix.needsUpdate = true;
      // A tap is tested against the slots shown now, not the ones at the first refresh.
      hit.computeBoundingSphere();
    },
    animate(now) {
      village.animate(now);
      ringM.opacity = 0.5 + Math.sin(now * 3) * 0.2;
    },
  };
}
