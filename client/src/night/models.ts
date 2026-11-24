/**
 * The Night's enemies made in Blender (assets/blender/night_enemies.py, served by serve_night.py): one model a family
 * and a boss, each one mesh and one texture, drawn by one InstancedMesh. Fetched once the Night has begun; until they are
 * there, plain shapes stand in.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { bakeModel } from "../scene/models.js";

export const NIGHT_MODELS = { raider: "night-raider", beast: "night-beast", wraith: "night-wraith", galleon: "night-galleon", kraken: "night-kraken", leviathan: "night-leviathan" } as const;
export type NightModel = keyof typeof NIGHT_MODELS;

export const nightModelUrl = (m: NightModel): string => `${import.meta.env.BASE_URL}night/${NIGHT_MODELS[m]}.glb`;

/** The six models, baked for instancing. */
export async function loadNightModels(): Promise<Record<NightModel, { geometry: THREE.BufferGeometry; material: THREE.Material }>> {
  const loader = new GLTFLoader();
  const names = Object.keys(NIGHT_MODELS) as NightModel[];
  const loaded = await Promise.all(names.map((m) => loader.loadAsync(nightModelUrl(m))));
  return Object.fromEntries(names.map((m, i) => [m, bakeModel(loaded[i]!.scene)])) as Record<NightModel, { geometry: THREE.BufferGeometry; material: THREE.Material }>;
}
