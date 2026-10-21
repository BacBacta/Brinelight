/**
 * The city remade in Blender (week 8): the models made by the scripts of assets/blender/ and served by
 * assets/blender/serve.py in client/public/city/, with their measures in city-models.json. They are the city's look
 * (step A of the last visual step); ?legacy shows the old look to compare, until the old code is removed (step B).
 */
import * as THREE from "three";
import CITY_MODELS from "./city-models.json";

/**
 * A model's measures, written by serve.py: for each level where something appears, the indices to draw, and the height and
 * reach (hex distance on its plot) of what is drawn; the Lighthouse's lantern and radar; the lamps the game lights.
 */
export type CityModel = { kB: number; triangles: number; levels: { level: number; indices: number; height: number; reach: number }[]; lantern?: number; radar?: number[]; lamps?: number[][] };
export const CITY_MANIFEST = CITY_MODELS as Record<string, CityModel>;

/** The new look is on unless ?legacy asks for the old one (owner's plan, step A; ?blender is still read, and changes nothing). */
export const blenderLook = (search: string = typeof location === "undefined" ? "" : location.search): boolean => !new URLSearchParams(search).has("legacy");

/**
 * How much higher the city's sea stands with ?blender (owner, after the style pass: the island's cliffs half as high),
 * the rafts with it; the sea map's water stays where it is. Every model keeps its own height: the island at y = 0.
 */
export const SEA_RISE = blenderLook() ? 0.2 : 0;

export const cityModelUrl = (name: string): string => `${import.meta.env.BASE_URL}city/${name}.glb`;

/** The island as made: already in the game's units, its meadow at y = 0 on the grid; nothing to fit or reshape. */
export function gridIsland(model: THREE.Object3D, casts = true): THREE.Object3D {
  model.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = casts;
      m.receiveShadow = true;
    }
  });
  return model;
}
