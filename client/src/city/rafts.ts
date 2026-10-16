/**
 * The raft slots around the island, as in the prototype: moored rafts (deck and planks), the slot the shipyard
 * works on (scaffolding), and the free slots the Lighthouse lights (a golden hex that pulses).
 * Up to 39 rafts: each part is one InstancedMesh, so the number of draw calls never grows with the rafts.
 */
import * as THREE from "three";
import { RAFT_DAMAGED_BELOW, RAFT_SLOTS, raftCap, slotOpen } from "@brinelight/shared";
import { hexX, hexZ, kitModel, type Kit } from "../scene/index.js";
import type { PlayerState } from "../state/index.js";

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
    else if (state.yard?.slot === s.key) out.push({ key: s.key, view: "building" });
    else if (open && slotOpen(s.ring, lighthouse)) out.push({ key: s.key, view: "free" });
  }
  return out;
}

/** The world position of a slot (prototype: hx, hz). */
export const slotPosition = (key: string) => {
  const s = RAFT_SLOTS.find((x) => x.key === key)!;
  return { x: hexX(s.q, s.r), z: hexZ(s.r), q: s.q };
};

export type CityRafts = {
  /** The shapes a tap is tested against. */
  hits: THREE.Object3D[];
  /** The slot a tap landed on. */
  slotOf(hit: THREE.Intersection): string | null;
  refresh(state: PlayerState): void;
  /** Rafts bob on the water; free slots pulse. */
  animate(now: number): void;
  /** The meshes drawn for the rafts, whatever their number (draw calls). */
  readonly meshes: THREE.Object3D[];
};

const MAX = RAFT_SLOTS.length;
const PLANKS = 3;

export function createCityRafts(kit: Kit, add: (o: THREE.Object3D) => void): CityRafts {
  const deckGeo = new THREE.CylinderGeometry(1.1, 1.14, 0.22, 6);
  deckGeo.rotateY(Math.PI / 6);
  const deck = new THREE.InstancedMesh(deckGeo, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 }), MAX);
  deck.castShadow = true;
  deck.receiveShadow = true;
  const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.03, 0.12), new THREE.MeshStandardMaterial({ color: "#7A5130", roughness: 0.9 }), MAX * PLANKS);
  const ghostGeo = new THREE.CircleGeometry(1.05, 6);
  ghostGeo.rotateX(-Math.PI / 2);
  ghostGeo.rotateY(Math.PI / 6);
  const ghost = new THREE.InstancedMesh(ghostGeo, new THREE.MeshBasicMaterial({ color: "#FFE27A", transparent: true, opacity: 0.16, depthWrite: false }), MAX);
  const ringGeo = new THREE.RingGeometry(0.92, 1.04, 6, 1);
  ringGeo.rotateX(-Math.PI / 2);
  ringGeo.rotateY(Math.PI / 6);
  const ringM = new THREE.MeshBasicMaterial({ color: "#FFE27A", transparent: true, opacity: 0.75, depthWrite: false });
  const ring = new THREE.InstancedMesh(ringGeo, ringM, MAX);
  const hit = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1.4, 6), new THREE.MeshBasicMaterial({ visible: false }), MAX);
  const scaffold = kitModel(kit, "building_scaffolding");
  scaffold.scale.setScalar(0.8);
  scaffold.visible = false;
  const meshes = [deck, planks, ghost, ring, hit];
  for (const m of meshes) {
    m.count = 0;
    m.frustumCulled = false;
    add(m);
  }
  add(scaffold);

  const sound = new THREE.Color("#A8743F");
  const damaged = new THREE.Color("#5E4A36");
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  let afloat: { key: string; x: number; z: number; tilt: number; bob: number }[] = [];
  let hitSlots: string[] = [];
  let key = "";

  /** Places the rafts at their height on the water at `now` (a gentle bob, as in the prototype). */
  const placeRafts = (now: number) => {
    afloat.forEach((r, i) => {
      const y = Math.sin(now * 1.3 + r.bob) * 0.04;
      deck.setMatrixAt(i, m4.compose(p.set(r.x, y - 0.13, r.z), q.identity(), one));
      for (let k = 0; k < PLANKS; k++) {
        q.setFromAxisAngle(up, r.tilt);
        const off = new THREE.Vector3(0, 0, (k - 1) * 0.42).applyQuaternion(q);
        planks.setMatrixAt(i * PLANKS + k, m4.compose(p.set(r.x + off.x, y - 0.01, r.z + off.z), q, one));
      }
    });
    deck.instanceMatrix.needsUpdate = true;
    planks.instanceMatrix.needsUpdate = true;
  };

  return {
    hits: [hit],
    meshes,
    slotOf(h) {
      return h.object === hit && h.instanceId !== undefined ? (hitSlots[h.instanceId] ?? null) : null;
    },
    refresh(state) {
      const slots = raftSlots(state);
      const k = JSON.stringify(slots);
      if (k === key) return;
      key = k;
      afloat = [];
      hitSlots = [];
      let free = 0;
      scaffold.visible = false;
      for (const s of slots) {
        const { x, z, q: col } = slotPosition(s.key);
        // Hash of the slot, never randomness: the same raft looks the same on every device.
        const bob = (Math.abs(x * 7.3 + z * 3.1) % 6.28) as number;
        if (s.view === "free") {
          ghost.setMatrixAt(free, m4.makeTranslation(x, -0.2, z));
          ring.setMatrixAt(free, m4.makeTranslation(x, -0.19, z));
          free++;
        } else {
          afloat.push({ key: s.key, x, z, tilt: (Math.PI / 6) * (col % 2 ? 1 : -1), bob });
          deck.setColorAt(afloat.length - 1, s.view === "damaged" ? damaged : sound);
          if (s.view === "building") {
            scaffold.position.set(x, 0, z);
            scaffold.visible = true;
          }
        }
        hit.setMatrixAt(hitSlots.length, m4.makeTranslation(x, 0.5, z));
        hitSlots.push(s.key);
      }
      deck.count = afloat.length;
      planks.count = afloat.length * PLANKS;
      ghost.count = free;
      ring.count = free;
      hit.count = hitSlots.length;
      for (const m of [ghost, ring, hit]) m.instanceMatrix.needsUpdate = true;
      // A tap is tested against the slots shown now, not the ones at the first refresh.
      hit.computeBoundingSphere();
      if (deck.instanceColor) deck.instanceColor.needsUpdate = true;
      placeRafts(0);
    },
    animate(now) {
      if (afloat.length) placeRafts(now);
      ringM.opacity = 0.45 + Math.sin(now * 3) * 0.3;
    },
  };
}
