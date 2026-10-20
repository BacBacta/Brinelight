/**
 * The island's animals (week 8, meeting 4; assets/blender/life.py): gulls wheeling over the coast that land on the roofs
 * now and then, a cat on the Fishery's jetty by its fisher, hens by the Shelters, crabs on the beach, a dolphin and small
 * fish leaping far off from time to time. One InstancedMesh per kind; their wings, tails and heads move in the shader.
 * With reduced motion they all stand still, and nothing leaps.
 */
import * as THREE from "three";
import { BUILDING_IDS, type BuildingId } from "@brinelight/shared";
import type { PlayerState } from "../../state/index.js";
import { bakeModel } from "../../scene/models.js";
import { hexX, hexZ } from "../../scene/island.js";
import { loadStage, stageName, stageOf } from "../staged.js";
import { ERA_PLOTS } from "../plots.js";
import { FRONT } from "./cast.js";

export const KINDS = ["gull", "cat", "hen", "crab", "dolphin", "fish"] as const;
export type Kind = (typeof KINDS)[number];
/** Where the parts are (life.py): a gull's wings, a cat's tail and head, a hen's head, a crab's legs, a tail. */
const PARTS = { WING_X: 0.014, TAIL_Z: -0.045, HEAD_Z: 0.03, LEGS_X: 0.025 } as const;
/** The sea at rest (shore.ts): the dolphin and the fish leap from it. */
const SEA_Y = -0.42;
const FLOOR: Record<number, number> = { 1: 0, 5: 0.16, 10: 0.14, 15: 0.1, 20: 0.1, 25: 0.08, 30: 0.08 };

const hash = (n: number) => {
  const s = Math.sin(n * 57.3 + 91.1) * 43758.5453;
  return s - Math.floor(s);
};

/** An animal at a moment: where it is, the way it faces (and its pitch, for a leap), and whether it moves its parts. */
export type Beast = { kind: Kind; x: number; y: number; z: number; turn: number; pitch?: number; resting: boolean; phase: number };

const plot = (id: BuildingId) => {
  const [q, r] = ERA_PLOTS[id];
  return { x: hexX(q, r), z: hexZ(r) };
};

/** The beach's spots for the crabs: the middles of the island's sides that face the camera (+z), just inside its rim. */
export function beachSpots(): { x: number; z: number; along: [number, number] }[] {
  const out: { x: number; z: number; along: [number, number] }[] = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, -1],
    [-1, 1],
  ] as const;
  const inside = (q: number, r: number) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2;
  for (let q = -2; q <= 2; q++)
    for (let r = -2; r <= 2; r++) {
      if (!inside(q, r)) continue;
      for (const [dq, dr] of dirs) {
        if (inside(q + dq, r + dr)) continue;
        const [nx, nz] = [hexX(dq, dr) / 2, hexZ(dr) / 2];
        if (nz < 0.3) continue;
        out.push({ x: hexX(q, r) + nx * 1.04, z: hexZ(r) + nz * 1.04, along: [-nz, nx] });
      }
    }
  return out.sort((a, b) => a.x - b.x);
}

/** The animals at `t`; `perches` are the roofs a gull may land on. With `still`, nothing moves and nothing leaps. */
export function beastsAt(state: PlayerState, t: number, perches: readonly { x: number; y: number; z: number }[], still: boolean): Beast[] {
  const out: Beast[] = [];
  // Eight gulls wheel over the coast; every other one lands on a roof for a while in each of its rounds.
  for (let i = 0; i < 8; i++) {
    const period = 36 + i * 3;
    const r = 4.6 + (i % 3) * 0.8;
    const h = 1.8 + (i % 4) * 0.25;
    const w = (i % 2 ? -1 : 1) * 0.3;
    const a0 = hash(i) * Math.PI * 2;
    const circle = (s: number) => ({ x: Math.cos(a0 + w * s) * r, y: h + Math.sin(s * 0.7 + i) * 0.1, z: Math.sin(a0 + w * s) * r });
    const heading = (s: number) => Math.atan2(-Math.sin(a0 + w * s) * w, Math.cos(a0 + w * s) * w);
    const perch = i % 2 === 0 && perches.length ? perches[(i / 2) % perches.length] : undefined;
    const u = (t + hash(i + 9) * period) % period;
    const start = t - u;
    if (perch && u > period - 10) {
      const k = u - (period - 10);
      const [down, up] = [circle(start + period - 10), circle(start + period)];
      const turn = Math.atan2(down.x - perch.x, down.z - perch.z) + Math.PI;
      if (k < 2) {
        const e = k / 2;
        out.push({ kind: "gull", x: down.x + (perch.x - down.x) * e, y: down.y + (perch.y - down.y) * e, z: down.z + (perch.z - down.z) * e, turn, resting: false, phase: i });
      } else if (k < 8) out.push({ kind: "gull", ...perch, turn, resting: true, phase: i });
      else {
        const e = (k - 8) / 2;
        out.push({ kind: "gull", x: perch.x + (up.x - perch.x) * e, y: perch.y + (up.y - perch.y) * e, z: perch.z + (up.z - perch.z) * e, turn: Math.atan2(up.x - perch.x, up.z - perch.z), resting: false, phase: i });
      }
    } else out.push({ kind: "gull", ...circle(t), turn: heading(t), resting: false, phase: i });
  }
  // The cat sits on the Fishery's jetty, by its fisher (cast.ts), watching the line.
  if (state.buildings.fishery >= 1) {
    const c = plot("fishery");
    out.push({ kind: "cat", x: c.x + 0.68, y: FLOOR[stageOf(state.buildings.fishery)]! + 0.08, z: c.z + 0.08, turn: Math.PI * 0.6, resting: true, phase: 3 });
  }
  // Four hens peck about in front of the Shelters.
  if (state.buildings.shelters >= 1) {
    const c = plot("shelters");
    [-0.3, -0.1, 0.15, 0.32].forEach((x, k) => {
      const s = t * 0.25 + k * 1.7;
      const [dx, dz] = [Math.cos(s) * 0.05, Math.sin(s * 1.3) * 0.04];
      out.push({ kind: "hen", x: c.x + x + dx, y: 0, z: c.z + FRONT.z - 0.02 + (k % 2) * 0.1 + dz, turn: s + Math.PI / 2, resting: false, phase: k });
    });
  }
  // Five crabs scuttle to and fro along the beach.
  const beach = beachSpots();
  for (let k = 0; k < 5 && beach.length; k++) {
    const b = beach[Math.floor(hash(k + 20) * beach.length)]!;
    const s = Math.sin(t * 0.6 + k * 2) * 0.1;
    out.push({ kind: "crab", x: b.x + b.along[0] * s, y: 0, z: b.z + b.along[1] * s, turn: Math.atan2(b.along[0], b.along[1]) + Math.PI / 2, resting: false, phase: k });
  }
  if (still) return out;
  // Far off in front, a dolphin leaps every 11 s, and three small fish every 5 s.
  const leap = (kind: Kind, every: number, length: number, height: number, span: number, radius: [number, number], n: number) => {
    const k = Math.floor(t / every);
    const u = (t - k * every) / length;
    if (u >= 1) return;
    const angle = Math.PI * (0.18 + 0.64 * hash(k * 3 + every));
    const d = radius[0] + (radius[1] - radius[0]) * hash(k * 5 + every);
    const turn = hash(k * 7 + every) * Math.PI * 2;
    for (let j = 0; j < n; j++) {
      const [ox, oz] = [Math.cos(angle) * d + j * 0.12, Math.sin(angle) * d + j * 0.07];
      const along = (u - 0.5 - j * 0.08) * span;
      const v = Math.min(1, Math.max(0, u - j * 0.08));
      out.push({ kind, x: ox + Math.sin(turn) * along, y: SEA_Y - 0.08 + Math.sin(Math.PI * v) * height, z: oz + Math.cos(turn) * along, turn, pitch: -Math.cos(Math.PI * v) * 0.9, resting: false, phase: j });
    }
  };
  leap("dolphin", 11, 1.8, 0.55, 1.1, [8.5, 10], 1);
  leap("fish", 5, 0.8, 0.22, 0.4, [8, 9.5], 3);
  return out;
}

const VERTEX = /* glsl */ `
attribute float aRest;
attribute float aPhase;
uniform float uTime;
uniform float uKind;
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
`;

const MOVE = /* glsl */ `
float t = uTime + aPhase * 1.7;
vec3 p = position;
mat3 r = mat3(1.);
vec3 pivot = vec3(0.);
vec3 shift = vec3(0.);
int kind = int(uKind + .5);
if (kind == 0 && abs(p.x) > ${PARTS.WING_X}) {
  float flap = aRest > .5 ? .12 : sin(t * 9.) * .7;
  r = rotZ(p.x > 0. ? flap : -flap);
  pivot = vec3(sign(p.x) * ${PARTS.WING_X}, .024, 0.);
} else if (kind == 1 && p.z < ${PARTS.TAIL_Z}) {
  r = rotY(.4 * sin(t * 1.5));
  pivot = vec3(0., .02, -.03);
} else if (kind == 1 && p.z > ${PARTS.HEAD_Z} - .01 && p.y > .045) {
  r = rotY(.35 * sin(t * .4));
  pivot = vec3(0., .05, .03);
} else if (kind == 2 && p.z > ${PARTS.HEAD_Z} - .008) {
  r = rotX(pow(max(0., sin(t * 3.)), 6.) * .9);
  pivot = vec3(0., .05, .02);
} else if (kind == 3 && abs(p.x) > ${PARTS.LEGS_X}) {
  shift.y = .003 * sin(t * 22. + p.z * 300.);
} else if (kind >= 4 && p.z < -.1) {
  r = rotY(.25 * sin(t * 10.));
  pivot = vec3(0., 0., -.1);
}
`;

function creatureMaterial(base: THREE.Material, time: { value: number }, kind: number): THREE.Material {
  const material = (base as THREE.MeshStandardMaterial).clone();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uKind = { value: kind };
    shader.vertexShader = (VERTEX + shader.vertexShader)
      .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>\n${MOVE}\nobjectNormal = r * objectNormal;`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed = pivot + r * (position - pivot) + shift;");
  };
  material.customProgramCacheKey = () => "brinelight-creature";
  return material;
}

const MAX: Record<Kind, number> = { gull: 8, cat: 1, hen: 4, crab: 5, dolphin: 1, fish: 3 };

export function createAnimals(add: (o: THREE.Object3D) => void) {
  const time = { value: 0 };
  const meshes = new Map<Kind, THREE.InstancedMesh>();
  const drawn: THREE.Object3D[] = [];
  let perches: { x: number; y: number; z: number }[] = [];
  let perchKey = "";
  let state: PlayerState | null = null;
  const m4 = new THREE.Matrix4();
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const frustum = new THREE.Frustum();
  const sphere = new THREE.Sphere();

  const load = () => {
    KINDS.forEach((kind, k) => {
      void loadStage(`life-${kind}`).then((model) => {
        const { geometry, material } = bakeModel(model);
        geometry.setAttribute("aRest", new THREE.InstancedBufferAttribute(new Float32Array(MAX[kind]), 1));
        geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(new Float32Array(MAX[kind]), 1));
        const mesh = new THREE.InstancedMesh(geometry, creatureMaterial(material, time, k), MAX[kind]);
        mesh.name = kind;
        mesh.frustumCulled = false;
        mesh.receiveShadow = true;
        mesh.count = 0;
        meshes.set(kind, mesh);
        drawn.push(mesh);
        add(mesh);
      });
    });
  };

  /** The roofs the gulls land on: the top of each building's model near its plot's middle (the Lighthouse's excepted). */
  const findPerches = (s: PlayerState) => {
    const ids = BUILDING_IDS.filter((id) => id !== "lighthouse" && s.buildings[id] >= 1);
    const key = ids.map((id) => stageName(id, s.buildings[id])).join();
    if (key === perchKey) return;
    perchKey = key;
    const ray = new THREE.Raycaster();
    void Promise.all(
      ids.map((id) =>
        loadStage(stageName(id, s.buildings[id])).then((shown) => {
          // The model shown stands in its plot's group: a copy of it (sharing its geometry) stands at the origin.
          const model = shown.clone();
          model.position.set(0, 0, 0);
          model.updateMatrixWorld(true);
          const c = plot(id);
          let best: THREE.Vector3 | null = null;
          for (const [dx, dz] of [[0, 0], [0.15, 0.1], [-0.15, -0.1], [0.2, -0.15]] as const) {
            ray.set(new THREE.Vector3(dx, 10, dz), new THREE.Vector3(0, -1, 0));
            const hit = ray.intersectObject(model, true)[0];
            if (hit && (!best || hit.point.y > best.y)) best = hit.point.clone();
          }
          return best && best.y > 0.2 ? { x: c.x + best.x, y: best.y, z: c.z + best.z } : null;
        }),
      ),
    ).then((list) => {
      if (perchKey === key) perches = list.filter((x): x is { x: number; y: number; z: number } => x !== null);
    });
  };

  let started = false;
  return {
    meshes: drawn,
    update(next: PlayerState) {
      state = next;
      if (started) findPerches(next);
    },
    animate(now: number, still: boolean, near: boolean, camera: THREE.Camera) {
      if (!state) return;
      if (!started) {
        started = true;
        load();
        findPerches(state);
      }
      time.value = still ? 0 : now;
      if (near) frustum.setFromProjectionMatrix(m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const counts = new Map<Kind, number>();
      for (const b of beastsAt(state, still ? 0 : now, perches, still)) {
        const mesh = meshes.get(b.kind);
        if (!mesh) continue;
        p.set(b.x, b.y, b.z);
        if (near && !frustum.intersectsSphere(sphere.set(p, 0.3))) continue;
        const i = counts.get(b.kind) ?? 0;
        if (i >= MAX[b.kind]) continue;
        counts.set(b.kind, i + 1);
        mesh.setMatrixAt(i, m4.compose(p, q.setFromEuler(e.set(b.pitch ?? 0, b.turn, 0, "YXZ")), one));
        (mesh.geometry.getAttribute("aRest") as THREE.BufferAttribute).setX(i, b.resting ? 1 : 0);
        (mesh.geometry.getAttribute("aPhase") as THREE.BufferAttribute).setX(i, b.phase);
      }
      for (const [kind, mesh] of meshes) {
        mesh.count = counts.get(kind) ?? 0;
        mesh.visible = mesh.count > 0;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.geometry.getAttribute("aRest").needsUpdate = true;
        mesh.geometry.getAttribute("aPhase").needsUpdate = true;
      }
    },
  };
}
