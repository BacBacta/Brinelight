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
 * The island's ground in the Lighthouse's era (assets/blender/ground.py): what lies between the plots and along the
 * coast, from earth paths to concrete quays. The Modern era's at 30 too.
 */
export const groundName = (lighthouse: number): string => `ground-${Math.min(25, stageOf(lighthouse))}`;

/** The island's ground is made for each era: shown with the look made in Blender. */
export const hasGround = (): boolean => STAGES.every((s) => s === 30 || CITY_MANIFEST[`ground-${s}`]);

/** The tallest a building stands at any level: its height before its model is there. */
export const tallestHeight = (id: BuildingId): number => Math.max(...STAGES.flatMap((s) => CITY_MANIFEST[`${id}-${s}`]!.levels.map((l) => l.height)));

/** The parts of the building sites made in Blender. */
export const SITE_PARTS = ["site-frame", "site-mast", "site-arm", "site-crate"] as const;

/**
 * The models a city shows at once: the current stage of each building remade, the island's ground in the Lighthouse's
 * era, and the building sites' parts when a site shows (a building at work, or not built yet). Nothing of the eras to
 * come.
 */
export function shownModels(state: { buildings: Record<BuildingId, number>; queue: readonly { id: string }[] }): string[] {
  const out = BUILDING_IDS.filter((id) => isStaged(id) && state.buildings[id] > 0).map((id) => stageName(id, state.buildings[id]));
  if (hasGround()) out.push(groundName(state.buildings.lighthouse));
  const sites = state.queue.some((j) => (BUILDING_IDS as readonly string[]).includes(j.id)) || BUILDING_IDS.some((id) => state.buildings[id] === 0);
  return sites ? [...out, ...SITE_PARTS] : out;
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
