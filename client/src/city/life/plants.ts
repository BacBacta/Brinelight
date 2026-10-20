/**
 * The island's plants (week 8, meeting 4; assets/blender/life.py): trees, bushes, grass and flowers that sway in the
 * wind, in three looks that follow the Lighthouse (owner): wild at first (1–9), tended gardens next (10–24), vegetable
 * plots and trees in rows in the Modern era (25–30). The trees grow only on the plots no building takes, the low plants
 * also at the sides of the buildings' plots, off their floors and their workers' places; none hides a building
 * (client/test/visible.test.ts). One InstancedMesh per plant; the wind moves them in the shader, never with reduced motion.
 */
import * as THREE from "three";
import { BUILDING_IDS } from "@brinelight/shared";
import { bakeModel } from "../../scene/models.js";
import { hexX, hexZ } from "../../scene/island.js";
import { loadStage } from "../staged.js";
import { ERA_PLOTS } from "../plots.js";
import { LAUNDRY } from "./details.js";

export type Look = "wild" | "garden" | "modern";
export const plantLook = (lighthouse: number): Look => (lighthouse >= 25 ? "modern" : lighthouse >= 10 ? "garden" : "wild");

/** The plants of each look (their models are life-plant-<name>). */
export const LOOK_PLANTS: Record<Look, readonly string[]> = {
  wild: ["wild-tree", "wild-bush", "grass", "wild-flowers"],
  garden: ["garden-tree", "hedge", "grass", "flowerbed"],
  modern: ["modern-tree", "hedge", "grass", "veg"],
};

/** A plant on the island: its model, where it stands, its turn and its size. */
export type Plant = { name: string; x: number; z: number; turn: number; scale: number };

const hash = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** The plots of rings 0 to 2 that no building takes (plots.ts, ERA_PLOTS). */
export function freePlots(): [number, number][] {
  const taken = new Set(BUILDING_IDS.map((id) => ERA_PLOTS[id].join(",")));
  const out: [number, number][] = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2 && !taken.has(`${q},${r}`)) out.push([q, r]);
  return out;
}

/** Each look's layout of a free plot, from its center: [plant, x, z]. The trees stand in its back half. */
const FREE: Record<Look, [string, number, number][]> = {
  wild: [
    ["wild-tree", -0.35, -0.45],
    ["wild-tree", 0.32, -0.3],
    ["wild-bush", 0.45, 0.2],
    ["wild-bush", -0.5, 0.05],
    ["wild-bush", 0.05, 0.45],
    ["wild-flowers", -0.2, 0.3],
    ["wild-flowers", 0.3, 0.45],
    ["wild-flowers", -0.45, 0.5],
    ...([-0.55, -0.1, 0.25, 0.55, -0.3, 0.1] as const).map((x, k): [string, number, number] => ["grass", x, -0.2 + 0.13 * k]),
  ],
  garden: [
    ["garden-tree", -0.3, -0.4],
    ["garden-tree", 0.3, -0.4],
    ["hedge", -0.35, 0.58],
    ["hedge", 0.35, 0.58],
    ["flowerbed", -0.4, 0.05],
    ["flowerbed", 0.4, 0.05],
    ...([-0.55, 0.0, 0.55, -0.2] as const).map((x, k): [string, number, number] => ["grass", x, 0.25 + 0.08 * k]),
  ],
  modern: [
    ...([-0.45, -0.15, 0.15, 0.45] as const).map((x): [string, number, number] => ["modern-tree", x, -0.5]),
    ["veg", -0.27, 0.1],
    ["veg", 0.27, 0.1],
    ["veg", -0.27, 0.45],
    ["veg", 0.27, 0.45],
    ["hedge", 0.0, -0.2],
    ...([-0.6, 0.6] as const).map((x): [string, number, number] => ["grass", x, 0.2]),
  ],
};

/** The sides of a building's plot (beyond its floor, x > 0.7; short of its path): low plants only. */
const SIDES: Record<Look, [string, number, number][]> = {
  wild: [
    ["grass", 0.8, 0.3],
    ["wild-flowers", -0.8, 0.28],
    ["wild-bush", 0.8, -0.3],
    ["grass", -0.82, -0.25],
  ],
  garden: [
    ["flowerbed", 0.8, 0.3],
    ["grass", -0.8, 0.28],
    ["grass", 0.8, -0.3],
    ["grass", -0.82, -0.25],
  ],
  modern: [
    ["grass", 0.8, 0.3],
    ["grass", -0.8, 0.28],
    ["grass", 0.8, -0.3],
    ["grass", -0.82, -0.25],
  ],
};

/** Every plant of the island for a Lighthouse at `lighthouse`: the same for every city at that look. */
export function plantsFor(lighthouse: number): Plant[] {
  const look = plantLook(lighthouse);
  const out: Plant[] = [];
  const put = (layout: [string, number, number][], cx: number, cz: number, seed: number, rows: boolean) =>
    layout.forEach(([name, x, z], k) => {
      const h = hash(seed * 31 + k);
      // Wild plants lean and differ; planted ones stand in line, all alike.
      out.push({ name: `life-plant-${name}`, x: cx + x + (rows ? 0 : (h - 0.5) * 0.08), z: cz + z + (rows ? 0 : (hash(h * 97) - 0.5) * 0.08), turn: rows ? 0 : h * Math.PI * 2, scale: rows ? 1 : 0.85 + 0.3 * hash(h * 13) });
    });
  freePlots().forEach(([q, r], i) => put(FREE[look], hexX(q, r), hexZ(r), i, look !== "wild"));
  BUILDING_IDS.filter((id) => id !== "lighthouse").forEach((id, i) => {
    const [q, r] = ERA_PLOTS[id];
    put(SIDES[look], hexX(q, r), hexZ(r), 100 + i, look !== "wild");
  });
  // The washing's place by the Shelters (details.ts) stays clear.
  return out.filter((p) => Math.hypot(p.x - LAUNDRY.x, p.z - LAUNDRY.z) > 0.38);
}

const SWAY = /* glsl */ `
uniform float uTime;
uniform float uSway;
uniform float uHeight;
`;

function windMaterial(base: THREE.Material, time: { value: number }, sway: number, height: number): THREE.Material {
  const material = (base as THREE.MeshStandardMaterial).clone();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uSway = { value: sway };
    shader.uniforms.uHeight = { value: height };
    shader.vertexShader = (SWAY + shader.vertexShader).replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vec2 w = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
float h = clamp(position.y / uHeight, 0., 1.);
float a = uTime * 1.6 + w.x * .8 + w.y * .5;
transformed.xz += vec2(sin(a), cos(a * .7) * .5) * uSway * h * h;`,
    );
  };
  material.customProgramCacheKey = () => "brinelight-wind";
  return material;
}

/** How far each plant's top sways in the wind (game units). */
const SWAYS: Record<string, number> = { "wild-tree": 0.025, "garden-tree": 0.02, "modern-tree": 0.018, "wild-bush": 0.008, grass: 0.012, "wild-flowers": 0.01, flowerbed: 0.004, hedge: 0, veg: 0.003 };

export function createPlants(add: (o: THREE.Object3D) => void) {
  const time = { value: 0 };
  const meshes = new Map<string, THREE.InstancedMesh>();
  const drawn: THREE.Object3D[] = [];
  let plants: Plant[] = [];
  let look: Look | null = null;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();

  const lay = () => {
    const counts = new Map<string, number>();
    for (const it of plants) {
      const mesh = meshes.get(it.name);
      if (!mesh) continue;
      const i = counts.get(it.name) ?? 0;
      counts.set(it.name, i + 1);
      mesh.setMatrixAt(i, m4.compose(p.set(it.x, 0, it.z), q.setFromAxisAngle(up, it.turn), s.setScalar(it.scale)));
    }
    for (const [name, mesh] of meshes) {
      mesh.count = counts.get(name) ?? 0;
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    meshes: drawn,
    /** The plants of the look the Lighthouse's level gives, fetching their models the first time. */
    show(lighthouse: number) {
      const next = plantLook(lighthouse);
      if (next === look) return;
      look = next;
      plants = plantsFor(lighthouse);
      for (const name of new Set(plants.map((x) => x.name))) {
        if (meshes.has(name)) continue;
        void loadStage(name).then((model) => {
          if (meshes.has(name)) return;
          const { geometry, material } = bakeModel(model);
          geometry.computeBoundingBox();
          const plain = name.replace("life-plant-", "");
          const mesh = new THREE.InstancedMesh(geometry, windMaterial(material, time, SWAYS[plain] ?? 0.01, Math.max(0.05, geometry.boundingBox!.max.y)), plants.filter((x) => x.name === name).length + 64);
          // Their own shadow on the meadow, as the buildings'; the grass and flowers are too low for one.
          mesh.name = name;
          mesh.castShadow = plain.endsWith("tree") || plain.endsWith("bush") || plain === "hedge";
          mesh.receiveShadow = true;
          mesh.frustumCulled = false;
          meshes.set(name, mesh);
          drawn.push(mesh);
          add(mesh);
          lay();
        });
      }
      lay();
    },
    animate(now: number, still: boolean) {
      time.value = still ? 0 : now;
    },
  };
}
