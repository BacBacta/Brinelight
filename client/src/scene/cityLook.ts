/**
 * The city remade in Blender (week 8): the models made by the scripts of assets/blender/ and served by
 * assets/blender/serve.py in client/public/city/, with their measures in city-models.json: the city's look (the old
 * look and its code were removed at step B of the last visual step).
 */
import * as THREE from "three";
import CITY_MODELS from "./city-models.json";
import { paintGround } from "../city/fabric/paint.js";

/**
 * A model's measures, written by serve.py: for each level where something appears, the indices to draw, and the height and
 * reach (hex distance on its plot) of what is drawn; the Lighthouse's lantern and radar; the lamps the game lights.
 */
export type CityModel = { kB: number; triangles: number; levels: { level: number; indices: number; height: number; reach: number }[]; lantern?: number; radar?: number[]; lamps?: number[][] };
export const CITY_MANIFEST = CITY_MODELS as Record<string, CityModel>;

/**
 * How much higher the city's sea stands than the prototype's (owner, after the style pass: the island's cliffs half as
 * high), the rafts with it; the sea map's water stays where it is. Every model keeps its own height: the island at y = 0.
 */
export const SEA_RISE = 0.2;

export const cityModelUrl = (name: string): string => `${import.meta.env.BASE_URL}city/${name}.glb`;

/** The island as made: already in the game's units, its meadow at y = 0 on the grid; nothing to fit or reshape. */
export function gridIsland(model: THREE.Object3D, casts = true): THREE.Object3D {
  model.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (mesh.isMesh) {
      m.castShadow = casts;
      m.receiveShadow = true;
      // The city fabric's streets, yards, square and fields, painted on it (city/fabric/paint.ts).
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) paintGround(material);
    }
  });
  return model;
}
