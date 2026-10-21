/**
 * The land won on the sea in the game (owner, step 2): from the Lighthouse 5, with the look made in Blender, every raft
 * is drawn as land welded to the island. One mesh for the whole land (mesh.ts), built again when the slots change, over
 * one texture of its ground per look (land-<look>, assets/blender/land_texture.py); its shore painted from the coast
 * (sand, rock, the gravel behind the dike, mud, fresh earth); the land won's edge a dike repeated along its coast (stakes
 * and stones, a wattle band in the gardens, stone quays and lamps in the Modern era); a flooded slot's broken dike; the
 * landfill of the slot being filled; a few plants on each plot. Display only: the rules keep their rafts.
 */
import * as THREE from "three";
import { RAFT_DAMAGED_BELOW, RAFT_SLOTS, yardSlot } from "@brinelight/shared";
import type { PlayerState } from "../../state/index.js";
import { CITY_MANIFEST, SEA_RISE } from "../../scene/cityLook.js";
import { SHORE as GRID } from "../../scene/shoreGrid.js";
import { bakeModel } from "../../scene/models.js";
import { hexX, hexZ } from "../../scene/island.js";
import { loadStage } from "../staged.js";
import { plantLook, type Look } from "../life/plants.js";
import { raftBuildingName, villageAge } from "../village.js";
import { raftSlots } from "../rafts.js";
import { SEA, type At, type LandSlots } from "./field.js";
import { landGeometry, type CoastSegment } from "./mesh.js";
import { landJob, landJobNow } from "./jobs.js";
import type { LandDone } from "./job.js";

/**
 * The land's last rebuild (the ?fps counter shows it, owner on the S22): `aside`, ms in the worker (the display goes
 * on meanwhile, the old land shown); `shown`, ms on the display's thread to put the new one in place.
 */
export const landClock: { last: { aside: number; shown: number } | null } = { last: null };

/** The land's models are served (land-<look>, the ground's texture of each look). */
export const hasLand = (): boolean => (["wild", "garden", "modern"] as const).every((l) => CITY_MANIFEST[`land-${l}`]);

const position = (key: string): At => {
  const s = RAFT_SLOTS.find((x) => x.key === key)!;
  return { x: hexX(s.q, s.r), z: hexZ(s.r) };
};

/** What the land is made of in a city: every raft (a flooded one under 60), the slot the shipyard fills, the free ones. */
export function landSlotsOf(state: PlayerState): LandSlots {
  const filling = state.yard?.kind === "raft" ? yardSlot(state.yard) : null;
  const won: At[] = [];
  const flooded: At[] = [];
  const free: At[] = [];
  for (const s of RAFT_SLOTS) {
    const raft = state.rafts[s.key];
    const at = position(s.key);
    if (raft || s.key === filling) won.push(at);
    else free.push(at);
    if (raft && raft.hp < RAFT_DAMAGED_BELOW) flooded.push(at);
  }
  return { won, flooded, filling: filling ? position(filling) : null, free };
}

/**
 * The models a city on land shows at once, what its first image waits for: its ground's texture, its buildings on
 * rafts, and the free slots' buoys (no deck, walkway nor mooring: city/rafts.ts).
 */
export function landModels(state: PlayerState): string[] {
  const age = villageAge(state.buildings.lighthouse);
  const buildings = Object.values(state.rafts)
    .filter((r) => r.building)
    .map((r) => raftBuildingName(r.building!, r.level, age));
  const free = raftSlots(state).some((s) => s.view === "free");
  return [...new Set([`land-${plantLook(state.buildings.lighthouse)}`, ...buildings, ...(free ? ["raft-free"] : [])])];
}

/** The water's rest level in the city, which the shore's grid is measured from. */
const SHORE_WATER = GRID.waterY + SEA_RISE;

const key = (L: LandSlots) => JSON.stringify([L.won, L.flooded, L.filling]);

/** The shore's colors, by look (the island's: land.py, colors; the gravel behind the dike, by era). */
const SHORE = {
  sand: "#D9C9A3",
  rock: "#76716A",
  rockDark: "#5E5850",
  mud: "#6E6248",
  fresh: "#7E5F3E",
  quay: { wild: "#9A8466", garden: "#A08B6C", modern: "#B7AE9C" },
  yard: { wild: "#9A7448", garden: "#A5835A", modern: "#B9AB92" },
} as const;

const GROUND_VERTEX = /* glsl */ `
attribute vec4 aShore;
attribute vec2 aMarks;
varying vec4 vShore;
varying vec2 vMarks;
varying vec2 vXZ;
`;
const GROUND_FRAGMENT = /* glsl */ `
varying vec4 vShore;
varying vec2 vXZ;
varying vec2 vMarks;
uniform vec3 uSand, uRock, uRockDark, uQuay, uMud, uFresh, uYard;
uniform vec2 uYards[6];
uniform int uYardCount;
float hexReach(vec2 p) { return max(abs(p.x), max(abs(p.x * .5 + p.y * .866), abs(-p.x * .5 + p.y * .866))); }
`;
/** The shore painted from the coast, as land.py painted the island's (the same thresholds). */
const GROUND_PAINT = /* glsl */ `
{
  float d = vShore.x; float mine = vShore.y; float cc = vShore.z; float plotOk = vShore.w;
  vec3 col = diffuseColor.rgb;
  for (int i = 0; i < 6; i++) {
    if (i >= uYardCount) break;
    col = mix(col, uYard, clamp(1. - (hexReach(vXZ - uYards[i]) - .3) / .3, 0., 1.) * .8);
  }
  col = mix(col, uSand * .9, clamp((.28 - d) / .12, 0., 1.) * (1. - cc) * plotOk * (1. - mine));
  col = mix(col, mix(uRock, uRockDark, .5), clamp((.07 - d) / .04, 0., 1.) * cc * (1. - mine));
  col = mix(col, uQuay, clamp((.16 - d) / .08, 0., 1.) * mine);
  col = mix(col, mix(uSand * .72, uRockDark, max(cc, mine)), clamp(-d / .15, 0., 1.));
  col = mix(col, uMud, vMarks.x);
  col = mix(col, uFresh, vMarks.y);
  diffuseColor.rgb = col;
}
`;

const PIECE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
const colored = (g: THREE.BufferGeometry, hex: string, top?: string): THREE.BufferGeometry => {
  const geo = g.index ? g.toNonIndexed() : g;
  const n = geo.getAttribute("position").count;
  const c = new THREE.Color(hex);
  const t = top ? new THREE.Color(top) : c;
  const normals = geo.getAttribute("normal");
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) (normals && normals.getY(i) > 0.9 ? t : c).toArray(out, i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(out, 3));
  return geo;
};
const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  for (const p of parts) {
    pos.push(...(p.getAttribute("position").array as Float32Array));
    nor.push(...(p.getAttribute("normal").array as Float32Array));
    col.push(...(p.getAttribute("color").array as Float32Array));
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return geo;
};
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: [number, number, number] = [1, 1, 1]) =>
  g.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(...s)));

/** The dike's pieces, each one InstancedMesh: a stake, a stone, the gardens' wattle band, the Modern era's quay block and lamp. */
const MAX_PIECES = 1600;
function pieces() {
  const make = (geo: THREE.BufferGeometry, max = MAX_PIECES) => {
    const m = new THREE.InstancedMesh(geo, PIECE, max);
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.count = 0;
    return m;
  };
  const stake = make(colored(new THREE.CylinderGeometry(0.018, 0.022, 0.36, 4), "#9C8C74"));
  const stone = make(colored(new THREE.OctahedronGeometry(0.05), "#7D766C"));
  const band = make(colored(new THREE.BoxGeometry(1, 0.06, 0.018), "#B5A78F"), 800);
  const quay = make(colored(new THREE.BoxGeometry(1, 0.3, 0.12), "#B9B2A6", "#D6D0C4"), 800);
  const lamp = make(merge([colored(new THREE.CylinderGeometry(0.014, 0.016, 0.42, 4).translate(0, 0.21, 0), "#163A63"), colored(new THREE.BoxGeometry(0.07, 0.08, 0.07).translate(0, 0.45, 0), "#FFC83A")]), 64);
  return { stake, stone, band, quay, lamp, all: [stake, stone, band, quay, lamp] };
}

/** A number from a place, never randomness: the same land looks the same on every device. */
const hash = (x: number, z: number, k = 0) => {
  const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
  return s - Math.floor(s);
};

/** The plants of each look on the land won: a tree, a low plant and a ground cover (life-plant-*). */
const PLANTS: Record<Look, [string, string, string]> = {
  wild: ["wild-tree", "wild-bush", "wild-flowers"],
  garden: ["garden-tree", "hedge", "flowerbed"],
  modern: ["modern-tree", "hedge", "flowerbed"],
};

export type CityLand = ReturnType<typeof createLand>;

/**
 * The land of a city: `update` builds it again when its slots changed (and says whether it is shown: from the
 * Lighthouse 5), `object` is what the shore's foam is measured from.
 */
export function createLand(add: (o: THREE.Object3D) => void) {
  const group = new THREE.Group();
  group.name = "land";
  add(group);
  const uniforms = {
    uSand: { value: new THREE.Color(SHORE.sand) },
    uRock: { value: new THREE.Color(SHORE.rock) },
    uRockDark: { value: new THREE.Color(SHORE.rockDark) },
    uQuay: { value: new THREE.Color(SHORE.quay.wild) },
    uMud: { value: new THREE.Color(SHORE.mud) },
    uFresh: { value: new THREE.Color(SHORE.fresh) },
    uYard: { value: new THREE.Color(SHORE.yard.wild) },
    uYards: { value: Array.from({ length: 6 }, () => new THREE.Vector2()) },
    uYardCount: { value: 0 },
  };
  const material = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = (GROUND_VERTEX + shader.vertexShader).replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvShore = aShore;\nvMarks = aMarks;\nvXZ = (modelMatrix * vec4(position, 1.)).xz;",
    );
    shader.fragmentShader = (GROUND_FRAGMENT + shader.fragmentShader).replace("#include <map_fragment>", `#include <map_fragment>\n${GROUND_PAINT}`);
  };
  material.customProgramCacheKey = () => "brinelight-land";
  const ground_ = new THREE.Mesh(new THREE.BufferGeometry(), material);
  ground_.name = "land-ground";
  ground_.receiveShadow = true;
  group.add(ground_);
  const p = pieces();
  for (const m of p.all) group.add(m);
  const props = new THREE.Mesh(new THREE.BufferGeometry(), PIECE);
  props.castShadow = true;
  props.receiveShadow = true;
  group.add(props);
  const plantMeshes = new Map<string, THREE.InstancedMesh>();
  let plantSpots: { name: string; x: number; y: number; z: number; turn: number; scale: number }[] = [];

  let look: Look | null = null;
  let built = "";
  let slots: LandSlots | null = null;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const e = new THREE.Euler();

  const lay = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, rx: number, ry: number, rz: number, sx = 1, sy = 1, sz = 1) => {
    mesh.setMatrixAt(i, m4.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), s.set(sx, sy, sz)));
  };

  /** The dike along the land won's coast, by look; a flooded slot's broken dike; the landfill's stakes (`fill`: x, z). */
  const dike = (coast: readonly CoastSegment[], fill: Float32Array, L: LandSlots, l: Look) => {
    let stakes = 0;
    let stones = 0;
    let bands = 0;
    let blocks = 0;
    let lamps = 0;
    for (const c of coast) {
      if (!c.won) continue;
      const dx = c.bx - c.ax;
      const dz = c.bz - c.az;
      const len = Math.hypot(dx, dz);
      if (len < 1e-4) continue;
      const tx = dx / len;
      const tz = dz / len;
      // Out to sea: the side where the land's field falls (meshData.ts).
      const mx = (c.ax + c.bx) / 2;
      const mz = (c.az + c.bz) / 2;
      const nx = c.nx;
      const nz = c.nz;
      const turn = -Math.atan2(tz, tx);
      if (l === "modern") {
        lay(p.quay, blocks++, mx - nx * 0.04, -0.13, mz - nz * 0.04, 0, turn, 0, len * 1.04, 1, 1);
        if (hash(mx, mz, 3) < len / 1.7 && lamps < 64) lay(p.lamp, lamps++, mx - nx * 0.14, 0, mz - nz * 0.14, 0, 0, 0);
        continue;
      }
      for (const t of [0.25, 0.75]) {
        if (stakes >= MAX_PIECES) break;
        const x = c.ax + dx * t + nx * 0.02;
        const z = c.az + dz * t + nz * 0.02;
        lay(p.stake, stakes++, x, -0.15 + (hash(x, z) - 0.4) * 0.05, z, (hash(x, z, 1) - 0.5) * 0.16, hash(x, z, 2) * 6.28, (hash(x, z, 4) - 0.5) * 0.12);
      }
      if (l === "garden" && bands < 800) lay(p.band, bands++, mx + nx * 0.03, -0.04, mz + nz * 0.03, 0, turn, 0, len * 1.02, 1, 1);
      const k = hash(mx, mz, 5);
      const out = 0.04 + hash(mx, mz, 6) * 0.1;
      if (stones < MAX_PIECES) lay(p.stone, stones++, mx + nx * out, SEA + (k - 0.5) * 0.05, mz + nz * out, 0, k * 6.28, 0, 0.6 + k * 0.8, (0.6 + k * 0.8) * 0.6, 0.6 + hash(mx, mz, 7) * 0.8);
    }
    // The breach: a few stakes or blocks fallen, stones scattered in the gap.
    for (const f of L.flooded) {
      const a0 = Math.atan2(f.z, f.x);
      for (let j = 0; j < 7; j++) {
        const a = a0 + (hash(f.x, f.z, j) - 0.5);
        const r = 0.9 + hash(f.x, f.z, j + 9) * 0.25;
        const x = f.x + Math.cos(a) * r;
        const z = f.z + Math.sin(a) * r;
        if (l === "modern" && blocks < 800) lay(p.quay, blocks++, x, SEA - 0.08, z, (hash(x, z) - 0.5) * 0.8, hash(x, z, 1) * 3, (hash(x, z, 2) - 0.5) * 0.8, 0.2, 0.4, 1);
        else if (stakes < MAX_PIECES) lay(p.stake, stakes++, x, SEA + 0.03, z, 1.2 + hash(x, z) * 0.3, hash(x, z, 1) * 6.28, 0);
        if (stones < MAX_PIECES) lay(p.stone, stones++, x + (hash(x, z, 3) - 0.5) * 0.2, SEA - 0.01, z + (hash(x, z, 4) - 0.5) * 0.2, 0, hash(x, z, 5) * 6, 0, 1, 0.6, 1);
      }
    }
    // The landfill: stakes all around its slot, on the water's side.
    for (let j = 0; j < fill.length && stakes < MAX_PIECES; j += 2) {
      const x = fill[j]!;
      const z = fill[j + 1]!;
      lay(p.stake, stakes++, x, SEA + 0.1, z, (hash(x, z) - 0.5) * 0.16, 0, (hash(x, z, 1) - 0.5) * 0.16, 1, 1.15, 1);
    }
    const counts: [THREE.InstancedMesh, number][] = [
      [p.stake, stakes],
      [p.stone, stones],
      [p.band, bands],
      [p.quay, blocks],
      [p.lamp, lamps],
    ];
    for (const [m, n] of counts) {
      m.count = n;
      m.visible = n > 0;
      m.instanceMatrix.needsUpdate = true;
    }
  };

  /**
   * Where the props and plants need their ground (the land's job measures it): the landfill's heaps, its wheelbarrow and
   * planks, then each plant's place on the plots won. Only hashes of places: the same land looks the same everywhere.
   */
  const planOf = (state: PlayerState, L: LandSlots, l: Look) => {
    const points: number[] = [];
    const heaps: [number, number, number][] = [];
    const f = L.filling;
    if (f) {
      for (let j = 0; j < 5; j++) {
        const a = hash(f.x, f.z, j) * 6.28;
        const r = 0.1 + hash(f.x, f.z, j + 5) * 0.5;
        const x = f.x + Math.cos(a) * r;
        const z = f.z + Math.sin(a) * r;
        heaps.push([x, z, 0.16 + hash(x, z) * 0.1]);
        points.push(x, z);
      }
      points.push(f.x - 0.35, f.z + 0.25, f.x + 0.2, f.z - 0.4);
    }
    const plants: { name: string; x: number; z: number; turn: number; scale: number }[] = [];
    const [tree, low, cover] = PLANTS[l];
    for (const sl of RAFT_SLOTS) {
      const raft = state.rafts[sl.key];
      if (!raft || raft.hp < RAFT_DAMAGED_BELOW) continue;
      const c = position(sl.key);
      const n = 6 + Math.floor(hash(c.x, c.z, 40) * 6);
      for (let k = 0; k < n; k++) {
        const a = hash(c.x, c.z, 41 + k) * 6.28;
        const r = 0.15 + hash(c.x, c.z, 61 + k) * 0.7;
        if (raft.building && r < 0.62) continue;
        const x = c.x + Math.cos(a) * r;
        const z = c.z + Math.sin(a) * r;
        const roll = hash(x, z, 81);
        const name = !raft.building && roll < 0.45 ? tree : roll < 0.75 ? low : cover;
        plants.push({ name: `life-plant-${name}`, x, z, turn: hash(x, z, 82) * 6.28, scale: 0.8 + hash(x, z, 83) * 0.4 });
        points.push(x, z);
      }
    }
    return { points: new Float32Array(points), heaps, plants, fill: f };
  };
  type Plan = ReturnType<typeof planOf>;

  /** The props' shapes, made once (each rebuild only places copies of them). */
  let shapes: Record<"heap" | "tuft" | "plank" | "wood" | "load" | "wheel" | "handle", THREE.BufferGeometry> | null = null;
  /** The landfill's heaps, wheelbarrow, planks and shovel; the drowned tufts of a flooded slot: one mesh. */
  const propsOf = (L: LandSlots, plan: Plan, h: Float32Array): THREE.BufferGeometry => {
    const parts: THREE.BufferGeometry[] = [];
    const { heap, tuft, plank, wood, load, wheel, handle } = (shapes ??= {
      heap: colored(new THREE.SphereGeometry(1, 8, 5), "#9A7448"),
      tuft: colored(new THREE.ConeGeometry(0.03, 0.08, 4), "#5E8A4F"),
      plank: colored(new THREE.BoxGeometry(0.5, 0.015, 0.07), "#C9A77A"),
      wood: colored(new THREE.BoxGeometry(0.2, 0.07, 0.14), "#8C6B4A"),
      load: colored(new THREE.BoxGeometry(0.16, 0.04, 0.1), "#9A7448"),
      wheel: colored(new THREE.CylinderGeometry(0.055, 0.055, 0.025, 8), "#2A2018"),
      handle: colored(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 4), "#8C6B4A"),
    });
    const f = plan.fill;
    if (f) {
      plan.heaps.forEach(([x, z, k], j) => parts.push(at(heap, x, h[j * 2]!, z, 0, 0, 0, [k, k * 0.35, k])));
      const x = f.x - 0.35;
      const z = f.z + 0.25;
      const y = h[plan.heaps.length * 2]!;
      parts.push(at(wood, x, y + 0.11, z, 0, 0.4), at(load, x, y + 0.15, z, 0, 0.4), at(wheel, x + 0.11, y + 0.06, z - 0.05, Math.PI / 2, 0.4, 0));
      for (const side of [-1, 1]) parts.push(at(handle, x - 0.12, y + 0.11, z + side * 0.06 + 0.05, 0, 0.4, Math.PI / 2 - 0.2));
      const py = h[plan.heaps.length * 2 + 2]!;
      for (let k = 0; k < 3; k++) parts.push(at(plank, f.x + 0.2 + k * 0.02, py + 0.03 + k * 0.016, f.z - 0.4 + k * 0.08, 0, 0.2 * k));
    }
    for (const fl of L.flooded)
      for (let j = 0; j < 8; j++) {
        const a = hash(fl.x, fl.z, j + 20) * 6.28;
        const r = hash(fl.x, fl.z, j + 30) * 0.65;
        parts.push(at(tuft, fl.x + Math.cos(a) * r, SEA + 0.02, fl.z + Math.sin(a) * r));
      }
    return parts.length ? merge(parts) : new THREE.BufferGeometry();
  };

  /** The plants that stand: never where the land is too thin (the dike, the shore). */
  const plantsOf = (plan: Plan, h: Float32Array) => {
    const first = plan.fill ? (plan.heaps.length + 2) * 2 : 0;
    const out: typeof plantSpots = [];
    plan.plants.forEach((it, k) => {
      const y = h[first + k * 2]!;
      const depth = h[first + k * 2 + 1]!;
      if (depth >= 0.2) out.push({ ...it, y: y - 0.01 });
    });
    return out;
  };

  const layPlants = () => {
    const counts = new Map<string, number>();
    for (const it of plantSpots) {
      const mesh = plantMeshes.get(it.name);
      if (!mesh) {
        if (!plantMeshes.has(it.name)) fetchPlant(it.name);
        continue;
      }
      const i = counts.get(it.name) ?? 0;
      if (i >= mesh.instanceMatrix.count) continue;
      counts.set(it.name, i + 1);
      lay(mesh, i, it.x, it.y, it.z, 0, it.turn, 0, it.scale, it.scale, it.scale);
    }
    for (const [name, mesh] of plantMeshes) {
      mesh.count = counts.get(name) ?? 0;
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
  const asked = new Set<string>();
  const fetchPlant = (name: string) => {
    if (asked.has(name)) return;
    asked.add(name);
    void loadStage(name).then((model) => {
      const { geometry, material } = bakeModel(model);
      const mesh = new THREE.InstancedMesh(geometry, material, 400);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      plantMeshes.set(name, mesh);
      group.add(mesh);
      layPlants();
    });
  };

  const setLook = (l: Look) => {
    if (l === look) return;
    look = l;
    uniforms.uQuay.value.set(SHORE.quay[l]);
    uniforms.uYard.value.set(SHORE.yard[l]);
    built = "";
    void loadStage(`land-${l}`).then((model) => {
      if (look !== l) return;
      model.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if ((o as THREE.Mesh).isMesh && m?.map) {
          material.map = m.map;
          material.needsUpdate = true;
        }
      });
    });
  };

  let jobId = 0;
  let builtLand = "";
  let grid: Uint8Array | null = null;
  /** Puts a land's job in place: its ground (if built), its dike, props and plants. Timed for the ?fps counter. */
  const put = (done: LandDone, plan: Plan, L: LandSlots, l: Look) => {
    const t = performance.now();
    if (done.data) {
      ground_.geometry.dispose();
      ground_.geometry = landGeometry(done.data);
      coast = done.data.coast;
      grid = done.grid;
    }
    dike(coast, done.fillStakes, L, l);
    props.geometry.dispose();
    props.geometry = propsOf(L, plan, done.heights);
    plantSpots = plantsOf(plan, done.heights);
    layPlants();
    slots = L;
    landClock.last = { aside: done.ms, shown: performance.now() - t };
    if (done.data) land.onBuilt?.();
  };
  let coast: CoastSegment[] = [];

  const land = {
    /** The land's group: what the shore's foam is measured from (its ground). */
    object: ground_,
    group,
    /** The meshes drawn (draw calls). */
    get meshes(): THREE.Object3D[] {
      return [ground_, props, ...p.all, ...plantMeshes.values()];
    },
    /** The slots shown now, for the framing (their land's edge stays on screen). */
    get slots(): LandSlots | null {
      return slots;
    },
    /**
     * Shows the city's land (`on`), built again if its slots changed; returns whether it was built again (the shore's
     * foam is then measured again).
     */
    update(state: PlayerState, on: boolean): boolean {
      group.visible = on;
      if (!on) return false;
      const l = plantLook(state.buildings.lighthouse);
      setLook(l);
      const L = landSlotsOf(state);
      // The buildings on rafts: the earth of their yards (the shader's, no rebuild).
      const yards = RAFT_SLOTS.filter((sl) => state.rafts[sl.key]?.building).map((sl) => position(sl.key));
      uniforms.uYardCount.value = Math.min(6, yards.length);
      yards.slice(0, 6).forEach((y, i) => uniforms.uYards.value[i]!.set(y.x, y.z));
      const landKey = key(L);
      const decorKey = landKey + l + JSON.stringify(yards);
      if (decorKey === built) return false;
      const mesh = landKey !== builtLand;
      built = decorKey;
      builtLand = landKey;
      const plan = planOf(state, L, l);
      const job = { kind: "land" as const, L, mesh, points: plan.points, waterY: SHORE_WATER };
      // The first land, before the city's first image: at once (no frame to hold).
      if (!ground_.geometry.index) {
        put(landJobNow({ ...job, mesh: true }), plan, L, l);
        return true;
      }
      // Then away from the display: the land shown stays until the new one is ready.
      const id = ++jobId;
      void landJob(job).then((done) => {
        if (id !== jobId) return;
        requestAnimationFrame(() => {
          if (id === jobId) put(done, plan, L, l);
        });
      });
      return false;
    },
    /** Called once a land built away from the display is shown (the shore's foam is measured again then). */
    onBuilt: null as null | (() => void),
    /** The shore's grid of the land shown: where it stands above the water. */
    get grid(): Uint8Array | null {
      return grid;
    },
    /** The triangles of the land's ground (tests, measures). */
    get triangles(): number {
      return (ground_.geometry.index?.count ?? 0) / 3;
    },
  };
  return land;
}
