/**
 * The buildings remade in Blender (week 8): seven models a building, its tiers at levels 1, 10, 20 and 30 and its
 * transformations at 5, 15 and 25; each model carries the details of its own levels, its triangles ordered by the
 * level they appear at (assets/blender/serve.py). A level is drawn as one range of its stage's mesh: one draw call a
 * building, whatever its level. Only the model of a building's current stage is loaded (the city waits for it before its
 * first image), and the next one while the upgrade toward it runs.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BUILDING_IDS, type BuildingId } from "@brinelight/shared";
import { CITY_MANIFEST, cityModelUrl, type CityModel } from "../scene/cityLook.js";

export const STAGES = [1, 5, 10, 15, 20, 25, 30] as const;

/** The stage a level shows: the highest stage at or under it (level 0, not built, shows nothing). */
export const stageOf = (level: number): number => Math.max(...STAGES.filter((s) => s <= Math.max(1, level)));

export const stageName = (id: BuildingId, level: number): string => `${id}-${stageOf(level)}`;

/** The buildings made in Blender so far: those whose seven stages are in the manifest. */
export const isStaged = (id: BuildingId): boolean => STAGES.every((s) => CITY_MANIFEST[`${id}-${s}`]);

/** What a level draws of its stage's model: the indices, and the height and reach (hex distance) of what is drawn. */
export function levelShape(id: BuildingId, level: number): { indices: number; height: number; reach: number } {
  const model: CityModel | undefined = CITY_MANIFEST[stageName(id, level)];
  if (!model) throw new Error(`No model for ${id} at level ${level}`);
  const steps = model.levels.filter((s) => s.level <= level);
  return steps.at(-1) ?? model.levels[0]!;
}

/**
 * The island after the style pass (owner, after meeting 4; assets/blender/terrain.py): one continuous land in the
 * Lighthouse's look (wild to 9, gardens to 24, the Modern era's from 25), its ground painted on it.
 */
export const terrainName = (lighthouse: number): string => `terrain-${lighthouse >= 25 ? "modern" : lighthouse >= 10 ? "garden" : "wild"}`;

/**
 * The buildings remade stand a little larger on their plots after the style pass (owner, after meeting 4), on the
 * same places: all but the Lighthouse, already the tallest, and the Barracks and the Observatory, side by side: larger,
 * the Workshop era's Barracks would hide half of a young Observatory behind them (client/test/visible.test.ts, 70 %).
 */
export const BUILDING_SCALE = 1.15;
const KEEP_SIZE: readonly BuildingId[] = ["lighthouse", "barracks", "observatory"];
export const buildingScale = (id: BuildingId): number => (KEEP_SIZE.includes(id) ? 1 : BUILDING_SCALE);

/** A building's shape at a level as shown: its model's, at its size on its plot. */
export function shownShape(id: BuildingId, level: number): { indices: number; height: number; reach: number } {
  const shape = levelShape(id, level);
  const k = buildingScale(id);
  return { indices: shape.indices, height: shape.height * k, reach: shape.reach * k };
}

/** The tallest a building stands at any level: its height before its model is there. */
export const tallestHeight = (id: BuildingId): number => buildingScale(id) * Math.max(...STAGES.flatMap((s) => CITY_MANIFEST[`${id}-${s}`]!.levels.map((l) => l.height)));

/** The parts of the building sites made in Blender. */
export const SITE_PARTS = ["site-frame", "site-mast", "site-arm", "site-crate"] as const;

/**
 * The models a city shows at once: the current stage of each building (the terrain is fetched by the scene), and the
 * building sites' parts when a site shows (a building at work, or not built yet). Nothing of the eras to
 * come.
 */
export function shownModels(state: { buildings: Record<BuildingId, number>; queue: readonly { id: string }[] }): string[] {
  const out = BUILDING_IDS.filter((id) => isStaged(id) && state.buildings[id] > 0).flatMap((id) => [stageName(id, state.buildings[id]), extraName(id, state.buildings[id]) ?? []].flat());
  if (isStaged("lighthouse") && radarAt(state.buildings.lighthouse)) out.push("lighthouse-radar");
  const sites = state.queue.some((j) => (BUILDING_IDS as readonly string[]).includes(j.id)) || BUILDING_IDS.some((id) => state.buildings[id] === 0);
  return sites ? [...out, ...SITE_PARTS] : out;
}

/**
 * Models laid with a building's stage, from its plot's center: the Harbor's pier and boat, on the water past its plot
 * (assets/blender/harbor.py). Their name at a level, if the building has one.
 */
const STAGE_EXTRAS: Partial<Record<BuildingId, string>> = { harbor: "harbor-pier" };
export function extraName(id: BuildingId, level: number): string | null {
  const extra = STAGE_EXTRAS[id];
  const name = extra ? `${extra}-${stageOf(level)}` : null;
  return name && CITY_MANIFEST[name] ? name : null;
}

/** Where the Lighthouse's radar turns at this level (its Modern era), if it has one. */
export function radarAt(level: number): [number, number, number] | undefined {
  const at = CITY_MANIFEST[stageName("lighthouse", level)]?.radar;
  return at ? [at[0]!, at[1]!, at[2]!] : undefined;
}

/** The lantern's height of the Lighthouse at this level (the beams and the light go there). */
export const lanternHeight = (level: number): number => CITY_MANIFEST[stageName("lighthouse", level)]?.lantern ?? 2;

const loader = new GLTFLoader();
const loaded = new Map<string, Promise<THREE.Object3D>>();

/** A stage's model, loaded once. */
export function loadStage(name: string): Promise<THREE.Object3D> {
  let p = loaded.get(name);
  if (!p) {
    p = loader.loadAsync(cityModelUrl(name)).then((g) => {
      g.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      return g.scene;
    });
    loaded.set(name, p);
  }
  return p;
}

/** Shows `level` on a stage's model: its range of triangles. */
export function showLevel(model: THREE.Object3D, id: BuildingId, level: number): void {
  const { indices } = levelShape(id, level);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) mesh.geometry.setDrawRange(0, indices);
  });
}
