/**
 * The island's small living details (week 8, meeting 4): the chimneys' smoke, the lanterns that light up as the light
 * falls (the Mist), and washing drying by the Shelters. Where the chimneys and lanterns are on each model is read from
 * the scripts that make them (assets/blender/spots.py, spots.json). The smoke and the lanterns are points (one draw call
 * for both, no triangle); with reduced motion the smoke stands still and the washing hangs, the lanterns still glow.
 */
import * as THREE from "three";
import { BUILDING_IDS } from "@brinelight/shared";
import type { PlayerState } from "../../state/index.js";
import { bakeModel } from "../../scene/models.js";
import { hexX, hexZ } from "../../scene/island.js";
import { buildingScale, loadStage, stageName, stageOf } from "../staged.js";
import { ERA_PLOTS } from "../plots.js";
import { slotPosition } from "../rafts.js";
import { raftBuildingName, villageAge } from "../village.js";
import { DECK_Y } from "./cast.js";
import SPOTS from "./spots.json";

type Spot = [number, number, number, number];
const spots = SPOTS as unknown as Record<string, { smoke?: Spot[]; lamps?: Spot[] }>;

/** A chimney or a lantern in the city: where it is, and the raft it rides on (it bobs with it), if any. */
export type Source = { x: number; y: number; z: number; raft: string | null };

/** The chimneys that smoke and the lanterns that light in a city: its buildings' at their level, its rafts' buildings'. */
export function sources(state: PlayerState): { smoke: Source[]; lamps: Source[] } {
  const out = { smoke: [] as Source[], lamps: [] as Source[] };
  const put = (entry: { smoke?: Spot[]; lamps?: Spot[] } | undefined, level: number, at: { x: number; y: number; z: number }, raft: string | null, k = 1) => {
    for (const kind of ["smoke", "lamps"] as const) for (const [x, y, z, from] of entry?.[kind] ?? []) if (from <= level) out[kind].push({ x: at.x + x * k, y: at.y + y * k, z: at.z + z * k, raft });
  };
  for (const id of BUILDING_IDS) {
    const level = state.buildings[id];
    if (level < 1) continue;
    const [q, r] = ERA_PLOTS[id];
    // The buildings are drawn larger than made (staged.ts), their chimneys and lanterns with them.
    put(spots[stageName(id, level)], level, { x: hexX(q, r), y: 0, z: hexZ(r) }, null, buildingScale(id));
  }
  for (const [key, raft] of Object.entries(state.rafts)) {
    if (!raft.building || raft.level < 1) continue;
    const c = slotPosition(key);
    put(spots[raftBuildingName(raft.building, raft.level, villageAge(state.buildings.lighthouse))], raft.level, { x: c.x, y: DECK_Y, z: c.z }, key);
  }
  return out;
}

/** Where the washing dries: on the free plot left of the Shelters (plots.ts: the Shelters on 2,-1), near them. */
export const LAUNDRY = { x: hexX(1, -1) + 0.42, z: hexZ(-1) + 0.2 } as const;

/** Puffs of smoke over each chimney, each rising and fading in turn. */
const PUFFS = 6;

const POINTS_VERTEX = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute float aGlow;
varying float vAlpha;
varying float vGlow;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vGlow = aGlow;
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

/** A puff of smoke (aGlow 0) or a lantern's glow (aGlow 1): both in one cloud of points, one draw call. */
const POINTS_FRAGMENT = /* glsl */ `
varying float vAlpha;
varying float vGlow;
uniform vec3 uSmoke;
void main() {
  float d = length(gl_PointCoord - .5) * 2.;
  float heart = 1. - smoothstep(0., .45, d);
  float smoke = (1. - smoothstep(.55, 1., d)) * vAlpha;
  float glow = min(1., pow(max(0., 1. - d), 1.6) * 1.5 * vAlpha);
  float a = mix(smoke, glow, vGlow);
  if (a < .01) discard;
  // A lit lantern's heart is brighter than white: only it glows at full quality (post.ts).
  gl_FragColor = vec4(mix(uSmoke, mix(vec3(1., .7, .27), vec3(1., .98, .94), heart) * (1. + 1.6 * heart), vGlow), a);
}`;

function pointCloud(max: number) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(max), 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(max), 1));
  geometry.setAttribute("aGlow", new THREE.BufferAttribute(new Float32Array(max), 1));
  geometry.setDrawRange(0, 0);
  const uniforms = { uScale: { value: 400 }, uSmoke: { value: new THREE.Color("#F4F1EA") } };
  const material = new THREE.ShaderMaterial({ vertexShader: POINTS_VERTEX, fragmentShader: POINTS_FRAGMENT, uniforms, transparent: true, depthWrite: false });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

const LAUNDRY_VERTEX = /* glsl */ `
uniform float uTime;
`;

export function createDetails(add: (o: THREE.Object3D) => void) {
  let found = { smoke: [] as Source[], lamps: [] as Source[] };
  // The smoke and the lanterns: one cloud of points (the style pass: fewer draw calls).
  const cloud = pointCloud(64 * PUFFS + 64);
  cloud.name = "smoke-lanterns";
  add(cloud);
  const time = { value: 0 };
  let laundry: THREE.Mesh | null = null;
  let laundryAt: { x: number; z: number } | null = null;
  const drawn: THREE.Object3D[] = [cloud];

  const set = (i: number, x: number, y: number, z: number, size: number, alpha: number, glow: number) => {
    (cloud.geometry.getAttribute("position") as THREE.BufferAttribute).setXYZ(i, x, y, z);
    (cloud.geometry.getAttribute("aSize") as THREE.BufferAttribute).setX(i, size);
    (cloud.geometry.getAttribute("aAlpha") as THREE.BufferAttribute).setX(i, alpha);
    (cloud.geometry.getAttribute("aGlow") as THREE.BufferAttribute).setX(i, glow);
  };
  const done = (n: number) => {
    cloud.geometry.setDrawRange(0, n);
    for (const name of ["position", "aSize", "aAlpha", "aGlow"]) cloud.geometry.getAttribute(name).needsUpdate = true;
    cloud.visible = n > 0;
  };

  return {
    meshes: drawn,
    update(state: PlayerState) {
      found = sources(state);
      // The washing dries by the Shelters, on the free plot beside them.
      if (state.buildings.shelters >= 1) {
        laundryAt = LAUNDRY;
        if (!laundry)
          void loadStage("life-laundry").then((model) => {
            if (laundry) return;
            const { geometry, material } = bakeModel(model);
            const m = (material as THREE.MeshStandardMaterial).clone();
            // The cloths (under the line) flap in the wind, more at their hem.
            m.onBeforeCompile = (shader) => {
              shader.uniforms.uTime = time;
              shader.vertexShader = (LAUNDRY_VERTEX + shader.vertexShader).replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>
float hang = clamp((.196 - position.y) / .1, 0., 1.) * step(abs(position.z), .25) * step(.02, position.y);
transformed.x += sin(uTime * 3. + position.z * 9.) * .018 * hang;`,
              );
            };
            laundry = new THREE.Mesh(geometry, m);
            laundry.name = "laundry";
            // Its line across the camera's view, so the cloths show side by side.
            laundry.rotation.y = Math.PI / 2;
            laundry.scale.setScalar(1.2);
            laundry.castShadow = true;
            laundry.receiveShadow = true;
            drawn.push(laundry);
            add(laundry);
          });
      } else laundryAt = null;
    },
    /** Each frame: the smoke rises (still with reduced motion), the lanterns glow as the light falls. */
    animate(now: number, still: boolean, dimness: number, bob: (raft: string) => number, camera: THREE.Camera) {
      const t = still ? 0 : now;
      time.value = t;
      // A point's size is in the game's units: its pixels follow the camera's lens and the screen's height.
      const scale = (camera.projectionMatrix.elements[5]! * innerHeight * Math.min(2, devicePixelRatio || 1)) / 2;
      (cloud.material as THREE.ShaderMaterial).uniforms.uScale!.value = scale;
      let n = 0;
      found.smoke.forEach((s, k) => {
        const lift = s.raft ? bob(s.raft) : 0;
        for (let i = 0; i < PUFFS; i++) {
          const u = (t * 0.22 + i / PUFFS + k * 0.37) % 1;
          set(n++, s.x + u * 0.22 + Math.sin(u * 5 + k) * 0.03, s.y + lift + u * 0.6, s.z - u * 0.06, 0.08 + u * 0.2, 0.85 * Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - u), 0);
        }
      });
      // Out in the late afternoon (style pass, owner); lit as the light falls, in the Mist.
      const lit = dimness;
      if (lit > 0.02) for (const s of found.lamps.slice(0, 64)) set(n++, s.x, s.y + (s.raft ? bob(s.raft) : 0), s.z, 0.28, lit, 1);
      done(n);
      if (laundry) {
        laundry.visible = laundryAt !== null;
        if (laundryAt) laundry.position.set(laundryAt.x, 0, laundryAt.z);
      }
    },
  };
}
