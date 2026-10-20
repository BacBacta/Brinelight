/**
 * The city remade in Blender (week 8): the models made by the scripts of assets/blender/ and served by
 * assets/blender/serve.py in client/public/city/, with their measures in city-models.json. Until the owner approves
 * them, they show only with ?blender in the address.
 */
import * as THREE from "three";
import CITY_MODELS from "./city-models.json";

/**
 * A model's measures, written by serve.py: for each level where something appears, the indices to draw, and the height and
 * reach (hex distance on its plot) of what is drawn; the Lighthouse's lantern and radar; the lamps the game lights.
 */
export type CityModel = { kB: number; triangles: number; levels: { level: number; indices: number; height: number; reach: number }[]; lantern?: number; radar?: number[]; lamps?: number[][] };
export const CITY_MANIFEST = CITY_MODELS as Record<string, CityModel>;

/** The new look is on (?blender), until it replaces the old one. */
export const blenderLook = (search: string = typeof location === "undefined" ? "" : location.search): boolean => new URLSearchParams(search).has("blender");

export const cityModelUrl = (name: string): string => `${import.meta.env.BASE_URL}city/${name}.glb`;

/** The island as made: already in the game's units, its meadow at y = 0 on the grid; nothing to fit or reshape. */
export function gridIsland(model: THREE.Object3D): THREE.Object3D {
  model.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return model;
}
