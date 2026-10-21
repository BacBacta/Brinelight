/**
 * The island's plants after the style pass (owner, after meeting 4; assets/blender/terrain.py and land.py): groves along
 * the coast and between the buildings and a few trees alone, in three looks that follow the Lighthouse (wild to 9,
 * gardens to 24, the Modern era's from 25). Each look's groves are one model (one draw call), swaying in the wind in the
 * shader, never with reduced motion. They keep a ring of grass and earth around each building, never stand in front of
 * one nor on a trail (land.py; client/test/visible.test.ts and life.test.ts check it).
 */
import * as THREE from "three";
import { bakeModel } from "../../scene/models.js";
import { loadStage } from "../staged.js";
import LAND from "./land.json";

export type Look = "wild" | "garden" | "modern";
export const plantLook = (lighthouse: number): Look => (lighthouse >= 25 ? "modern" : lighthouse >= 10 ? "garden" : "wild");

/** A plant on the island: its model (as made alone, life-plant-*), where it stands (its foot's height), its turn and size. */
export type Plant = { name: string; x: number; y: number; z: number; turn: number; scale: number };

type Row = [string, number, number, number, number, number];
const GROVES = (LAND as unknown as { groves: Record<Look, Row[]> }).groves;

/** Every plant of the island in the look of a Lighthouse at `lighthouse` (land.json, made by terrain.py). */
export function plantsFor(lighthouse: number): Plant[] {
  return (GROVES[plantLook(lighthouse)] ?? []).map(([name, x, y, z, turn, scale]) => ({ name: `life-plant-${name}`, x, y, z, turn, scale }));
}

/** How far each plant's top sways in the wind (game units), and its height (life.py) the sway grows along. */
const SWAYS: Record<string, [number, number]> = {
  "wild-tree": [0.025, 0.5],
  "garden-tree": [0.02, 0.5],
  "modern-tree": [0.018, 0.46],
  "wild-bush": [0.008, 0.1],
  grass: [0.012, 0.1],
  "wild-flowers": [0.01, 0.06],
  flowerbed: [0.004, 0.07],
  hedge: [0, 0.1],
  veg: [0.003, 0.09],
};

const WIND = /* glsl */ `
attribute float aSway;
uniform float uTime;
`;

/**
 * The groves' model with each vertex's sway: how far it moves in the wind, from the plant it belongs to (the nearest
 * foot) and its height over that foot.
 */
function withSway(geometry: THREE.BufferGeometry, plants: Plant[], owner: Int32Array): THREE.BufferGeometry {
  const pos = geometry.getAttribute("position");
  const sway = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    let best: Plant | null = null;
    let d = Infinity;
    plants.forEach((p, k) => {
      const e = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (e < d) {
        [d, best] = [e, p];
        owner[i] = k;
      }
    });
    if (!best) continue;
    const plant = best as Plant;
    const [amp, h] = SWAYS[plant.name.replace("life-plant-", "")] ?? [0.01, 0.1];
    const k = Math.min(1, Math.max(0, (y - plant.y) / (h * plant.scale)));
    sway[i] = amp * plant.scale * k * k;
  }
  geometry.setAttribute("aSway", new THREE.BufferAttribute(sway, 1));
  return geometry;
}

/** A plant gives way to the city fabric (city/fabric) when its foot is on a plot it takes: within the plot's hexagon. */
export const TAKEN_REACH = 0.95;
const hexReach = (x: number, z: number) => Math.max(Math.abs(x), Math.abs(x / 2 + z * 0.866), Math.abs(-x / 2 + z * 0.866));

export function createPlants(add: (o: THREE.Object3D) => void) {
  const time = { value: 0 };
  const drawn: THREE.Object3D[] = [];
  let look: Look | null = null;
  let mesh: THREE.Mesh | null = null;
  // Each vertex's plant, the full index of the groves, and the plots the fabric takes: their plants are not drawn.
  let shown: { plants: Plant[]; owner: Int32Array; index: ArrayLike<number> } | null = null;
  let taken: readonly { x: number; z: number }[] = [];
  const clear = () => {
    if (!mesh || !shown) return;
    const gone = shown.plants.map((p) => taken.some((t) => hexReach(p.x - t.x, p.z - t.z) < TAKEN_REACH));
    const kept: number[] = [];
    const { index, owner } = shown;
    for (let i = 0; i + 2 < index.length; i += 3) if (!gone[owner[index[i]!]!]) kept.push(index[i]!, index[i + 1]!, index[i + 2]!);
    mesh.geometry.setIndex(kept);
  };
  return {
    meshes: drawn,
    /** The groves of the look the Lighthouse's level gives, fetched the first time. */
    show(lighthouse: number) {
      const next = plantLook(lighthouse);
      if (next === look) return;
      look = next;
      const plants = plantsFor(lighthouse);
      void loadStage(`groves-${next}`).then((model) => {
        if (look !== next) return;
        const { geometry, material } = bakeModel(model);
        const m = (material as THREE.MeshStandardMaterial).clone();
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = time;
          shader.vertexShader = (WIND + shader.vertexShader).replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
float a = uTime * 1.6 + position.x * .8 + position.z * .5;
transformed.xz += vec2(sin(a), cos(a * .7) * .5) * aSway;`,
          );
        };
        m.customProgramCacheKey = () => "brinelight-wind";
        const owner = new Int32Array(geometry.getAttribute("position").count);
        const next_ = new THREE.Mesh(withSway(geometry, plants, owner), m);
        if (!geometry.index) geometry.setIndex(Array.from({ length: owner.length }, (_, i) => i));
        shown = { plants, owner, index: Array.from(geometry.index!.array) };
        next_.name = `groves-${next}`;
        // Their shade on the meadow, as the buildings'.
        next_.castShadow = true;
        next_.receiveShadow = true;
        if (mesh) {
          mesh.removeFromParent();
          drawn.splice(drawn.indexOf(mesh), 1);
        }
        mesh = next_;
        drawn.push(mesh);
        add(mesh);
        clear();
      });
    },
    /** The plots the city fabric takes (city/fabric/plan.ts): their wild plants give way. */
    giveWay(plots: readonly { x: number; z: number }[]) {
      taken = plots;
      clear();
    },
    animate(now: number, still: boolean) {
      time.value = still ? 0 : now;
    },
  };
}
