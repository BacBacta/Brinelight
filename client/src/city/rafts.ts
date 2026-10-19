/**
 * The raft slots around the island, as in the prototype: moored rafts (the raft model of the art direction), the slot
 * the shipyard works on (scaffolding), and the free slots the Lighthouse lights (a golden hex that pulses).
 * Up to 39 rafts: each part is one InstancedMesh, so the number of draw calls never grows with the rafts.
 * The buildings on rafts (greenhouse, smokehouse, watchtower) stand on the rafts that carry them: one InstancedMesh
 * per type, with room for the RAFT_BUILDING_MAX_COPIES rafts a type may have. No 3D label: the sheet and the queue say it.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RAFT_BUILDING_MAX_COPIES, RAFT_DAMAGED_BELOW, RAFT_SLOTS, raftCap, slotOpen, yardSlot, type RaftBuildingId } from "@brinelight/shared";
import { RAFT_BUILDING_IDS, bakeModel, hexX, hexZ, kitModel, type Kit, type RaftBuildingModels } from "../scene/index.js";
import { RAFT_FILL } from "../scene/coast.js";
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

/** A building's turn on its raft: every one faces the camera, as the island's do (week 8: no raft turned at random). */
export const raftBuildingTurn = (_key: string): number => 0;

/**
 * Which of the raft models a slot shows: (q − r) mod 3, a fixed rule that gives two rafts side by side two different
 * models (every neighbor of a slot is 1 or 2 away from it, mod 3). With fewer models, the rule wraps around them.
 */
export const raftVariant = (key: string, models = 3): number => {
  const s = RAFT_SLOTS.find((x) => x.key === key)!;
  return ((((s.q - s.r) % 3) + 3) % 3) % models;
};

/** The six slots around a slot, in axial coordinates. */
const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
] as const;

/** A walkway: its middle on the water, its direction (turn around the vertical, its length along +z turned), its length. */
export type Walkway = { x: number; z: number; turn: number; length: number };

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
        out.push({ x: (x / d) * mid, z: (z / d) * mid, turn: Math.atan2(-x, -z), length: from - to });
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
  /** The meshes drawn for the rafts, whatever their number (draw calls). */
  readonly meshes: THREE.Object3D[];
  /** The buildings on rafts, once loaded: from then on they stand on the rafts that carry them. */
  useBuildings(models: RaftBuildingModels): void;
  /** The scaffolding over a raft the shipyard builds, in place of the prototype kit's (the look made in Blender). */
  useScaffold(model: THREE.Object3D): void;
};

const MAX = RAFT_SLOTS.length;
/**
 * The room of a raft: the hexagon of its slot (whose sides are 1 from its center), shrunk to RAFT_FILL. Two rafts side by
 * side then have 2 × (1 − RAFT_FILL) of water between them, and a raft of ring 3 a little less to the island's shore.
 */
export { RAFT_FILL };
/** The widest a raft can be: its room's hexagon, corner to corner. */
export const RAFT_WIDTH = (2 * RAFT_FILL) / Math.cos(Math.PI / 6);
const RAFT_BOTTOM = -0.62;
/** The room a building takes on its raft: its widest side, and its height (the Watchtower is the tallest). */
export const RAFT_BUILDING_FIT = { width: 1.1, height: 1.5 };

/** A building's model as one geometry, centered, its bottom at y = 0, fitted to RAFT_BUILDING_FIT. */
export function raftBuildingGeometry(model: THREE.Object3D): { geometry: THREE.BufferGeometry; material: THREE.Material } {
  const { geometry, material } = bakeModel(model);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -box.min.y, -center.z);
  const s = Math.min(RAFT_BUILDING_FIT.width / Math.max(size.x, size.z), RAFT_BUILDING_FIT.height / size.y);
  geometry.scale(s, s, s);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, material };
}

/** Hex distance with the slots' orientation: a slot's sides are 1 from its center. */
const hexReach = (x: number, z: number) => Math.max(Math.abs(x), Math.abs(x / 2 + z * 0.866), Math.abs(-x / 2 + z * 0.866));

/**
 * The raft model as one geometry, centered on its slot, its bottom at y = 0, as large as its room allows (RAFT_FILL),
 * and the height of its deck, where its building stands.
 */
export function raftGeometry(model: THREE.Object3D): { geometry: THREE.BufferGeometry; material: THREE.Material; deck: number } {
  const { geometry, material } = bakeModel(model);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const center = box.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -box.min.y, -center.z);
  const pos = geometry.getAttribute("position");
  let reach = 0;
  for (let i = 0; i < pos.count; i++) reach = Math.max(reach, hexReach(pos.getX(i), pos.getZ(i)));
  const s = RAFT_FILL / reach;
  geometry.scale(s, s, s);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  // The deck is the top of the raft's middle, where its building stands (the middle stays free on every raft model).
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 100, 0), new THREE.Vector3(0, -1, 0));
  const deck = ray.intersectObject(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })))[0]?.point.y ?? geometry.boundingBox!.max.y / 2;
  return { geometry, material, deck };
}

/** A walkway of length 1 along +z, its middle at the origin: a deck of planks between two rails, in driftwood. */
export function walkwayGeometry(): THREE.BufferGeometry {
  const part = (w: number, h: number, d: number, x: number, y: number, color: string) => {
    const g = new THREE.BoxGeometry(w, h, d).translate(x, y, 0).toNonIndexed();
    g.deleteAttribute("uv");
    const c = new THREE.Color(color);
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(Array.from({ length: g.getAttribute("position").count }, () => [c.r, c.g, c.b]).flat()), 3));
    return g;
  };
  return mergeGeometries([part(0.3, 0.05, 1, 0, 0, "#C9A77A"), part(0.035, 0.12, 1, -0.15, 0.08, "#8C6B4A"), part(0.035, 0.12, 1, 0.15, 0.08, "#8C6B4A")]);
}

/**
 * The rafts of the city. `models` are the raft's models, one per variant (raftVariant picks one per slot); until the
 * painted variants are made, there is one.
 */
export function createCityRafts(kit: Kit, models: THREE.Object3D | readonly THREE.Object3D[], add: (o: THREE.Object3D) => void, coastAt: (angle: number) => number = () => 0): CityRafts {
  const variants = (Array.isArray(models) ? models : [models]).map(raftGeometry);
  // One InstancedMesh per variant: draw calls grow with the models, never with the rafts.
  const decks = variants.map((v) => {
    const mesh = new THREE.InstancedMesh(v.geometry, v.material, MAX);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  });
  const deckHeight = Math.max(...variants.map((v) => v.deck));
  const walk = new THREE.InstancedMesh(walkwayGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), MAX * 3);
  walk.castShadow = true;
  walk.receiveShadow = true;
  const room = RAFT_FILL / Math.cos(Math.PI / 6);
  const ghostGeo = new THREE.CircleGeometry(room, 6);
  ghostGeo.rotateX(-Math.PI / 2);
  ghostGeo.rotateY(Math.PI / 6);
  const ghost = new THREE.InstancedMesh(ghostGeo, new THREE.MeshBasicMaterial({ color: "#FFE27A", transparent: true, opacity: 0.16, depthWrite: false }), MAX);
  const ringGeo = new THREE.RingGeometry(room - 0.11, room, 6, 1);
  ringGeo.rotateX(-Math.PI / 2);
  ringGeo.rotateY(Math.PI / 6);
  const ringM = new THREE.MeshBasicMaterial({ color: "#FFE27A", transparent: true, opacity: 0.75, depthWrite: false });
  const ring = new THREE.InstancedMesh(ringGeo, ringM, MAX);
  const hit = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1.4, 6), new THREE.MeshBasicMaterial({ visible: false }), MAX);
  const scaffold = new THREE.Group();
  scaffold.add(kitModel(kit, "building_scaffolding"));
  scaffold.scale.setScalar(0.8);
  scaffold.visible = false;
  const meshes = [...decks, ghost, ring, hit, walk];
  for (const m of meshes) {
    m.count = 0;
    m.frustumCulled = false;
    add(m);
  }
  add(scaffold);

  // Multiplies the raft's texture: a damaged raft looks darker.
  const sound = new THREE.Color("#FFFFFF");
  const damaged = new THREE.Color("#7A6A5A");
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  let afloat: { key: string; x: number; z: number; variant: number; index: number; bob: number }[] = [];
  let hitSlots: string[] = [];
  let key = "";
  // The buildings on rafts: one InstancedMesh per type once loaded, and the slots each one stands on.
  const hits: THREE.Object3D[] = [hit];
  let onRafts: Partial<Record<RaftBuildingId, THREE.InstancedMesh>> = {};
  let standing = raftBuildingsShown({ rafts: {} } as PlayerState);
  let last: PlayerState | null = null;
  const q2 = new THREE.Quaternion();

  /** Places the rafts, and the buildings on them, at their height on the water at `now` (a gentle bob, as in the prototype). */
  const placeRafts = (now: number) => {
    const height = new Map<string, number>();
    for (const r of afloat) {
      const y = Math.sin(now * 1.3 + r.bob) * 0.04;
      height.set(r.key, y);
      decks[r.variant]!.setMatrixAt(r.index, m4.compose(p.set(r.x, RAFT_BOTTOM + y, r.z), q.identity(), one));
    }
    for (const d of decks) d.instanceMatrix.needsUpdate = true;
    for (const id of RAFT_BUILDING_IDS) {
      const mesh = onRafts[id];
      if (!mesh) continue;
      standing[id].forEach((slot, i) => {
        const { x, z } = slotPosition(slot);
        q2.setFromAxisAngle(up, raftBuildingTurn(slot));
        mesh.setMatrixAt(i, m4.compose(p.set(x, RAFT_BOTTOM + deckHeight + (height.get(slot) ?? 0), z), q2, one));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  /** Which building stands on which raft: set again whenever the rafts change. */
  const standBuildings = (state: PlayerState) => {
    standing = raftBuildingsShown(state);
    for (const id of RAFT_BUILDING_IDS) {
      const mesh = onRafts[id];
      if (!mesh) continue;
      // Never more than the rule allows; the city was read by parseState, which refuses a third copy.
      mesh.count = Math.min(RAFT_BUILDING_MAX_COPIES, standing[id].length);
      mesh.visible = mesh.count > 0;
    }
  };

  return {
    hits,
    meshes,
    slotOf(h) {
      if (h.instanceId === undefined) return null;
      if (h.object === hit) return hitSlots[h.instanceId] ?? null;
      const id = RAFT_BUILDING_IDS.find((b) => onRafts[b] === h.object);
      return id ? (standing[id][h.instanceId] ?? null) : null;
    },
    useScaffold(model) {
      scaffold.clear();
      scaffold.add(model);
    },
    useBuildings(models) {
      if (Object.keys(onRafts).length) return;
      for (const id of RAFT_BUILDING_IDS) {
        const parts = raftBuildingGeometry(models[id]);
        const mesh = new THREE.InstancedMesh(parts.geometry, parts.material, RAFT_BUILDING_MAX_COPIES);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.count = 0;
        mesh.visible = false;
        mesh.userData.raftBuilding = id;
        onRafts[id] = mesh;
        meshes.push(mesh);
        hits.push(mesh);
        add(mesh);
      }
      onRafts = { ...onRafts };
      if (last) {
        standBuildings(last);
        placeRafts(0);
        for (const id of RAFT_BUILDING_IDS) onRafts[id]!.computeBoundingSphere();
      }
    },
    refresh(state) {
      last = state;
      const slots = raftSlots(state);
      const k = JSON.stringify([slots, raftBuildingsShown(state)]);
      if (k === key) return;
      key = k;
      standBuildings(state);
      afloat = [];
      hitSlots = [];
      let free = 0;
      scaffold.visible = false;
      const counts = decks.map(() => 0);
      for (const s of slots) {
        const { x, z } = slotPosition(s.key);
        // Hash of the slot, never randomness: the same raft looks the same on every device.
        const bob = (Math.abs(x * 7.3 + z * 3.1) % 6.28) as number;
        if (s.view === "free") {
          ghost.setMatrixAt(free, m4.makeTranslation(x, -0.2, z));
          ring.setMatrixAt(free, m4.makeTranslation(x, -0.19, z));
          free++;
        } else {
          const variant = raftVariant(s.key, decks.length);
          const index = counts[variant]!++;
          afloat.push({ key: s.key, x, z, variant, index, bob });
          decks[variant]!.setColorAt(index, s.view === "damaged" ? damaged : sound);
          if (s.view === "building") {
            scaffold.position.set(x, 0, z);
            scaffold.visible = true;
          }
        }
        hit.setMatrixAt(hitSlots.length, m4.makeTranslation(x, 0.5, z));
        hitSlots.push(s.key);
      }
      decks.forEach((d, i) => (d.count = counts[i]!));
      // The walkways, between rafts moored side by side and from the first ring to the shore.
      const ways = raftWalkways(
        slots.filter((x) => x.view === "raft" || x.view === "damaged").map((x) => x.key),
        coastAt,
      );
      ways.forEach((w, i) => walk.setMatrixAt(i, m4.compose(p.set(w.x, RAFT_BOTTOM + deckHeight - 0.08, w.z), q.setFromAxisAngle(up, w.turn), sc.set(1, 1, w.length))));
      walk.count = ways.length;
      walk.instanceMatrix.needsUpdate = true;
      ghost.count = free;
      ring.count = free;
      hit.count = hitSlots.length;
      for (const m of [ghost, ring, hit]) m.instanceMatrix.needsUpdate = true;
      // A tap is tested against the slots shown now, not the ones at the first refresh.
      hit.computeBoundingSphere();
      for (const d of decks) if (d.instanceColor) d.instanceColor.needsUpdate = true;
      placeRafts(0);
      // A tap on a building is tested against where it stands now.
      for (const id of RAFT_BUILDING_IDS) onRafts[id]?.computeBoundingSphere();
    },
    animate(now) {
      if (afloat.length) placeRafts(now);
      ringM.opacity = 0.45 + Math.sin(now * 3) * 0.3;
    },
  };
}
