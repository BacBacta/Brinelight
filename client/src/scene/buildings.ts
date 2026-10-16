/**
 * The nine building models of the city (client/public/buildings, made by assets/buildings/make-buildings.py from
 * the art direction's concepts). One visual tier for now: the same model at every level.
 * Each model is brought to its tile when it loads: centered, standing on y = 0, scaled to fit, turned to the camera.
 */
import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BUILDING_IDS, type BuildingId } from "@brinelight/shared";

export const buildingUrl = (id: BuildingId): string => `${import.meta.env.BASE_URL}buildings/${id}.glb`;

/** The room a building may take: its widest side on the ground, and its height (world units; a tile is 2 wide). */
export type BuildingFit = { width: number; height: number };

/** About the size of the prototype kit's buildings on their tile. */
export const TILE_FIT: BuildingFit = { width: 1.6, height: 1.7 };
/**
 * The Lighthouse stands above the others: its model sits on a rock with a small pier, so it may take a little more
 * than its tile. It still grows with its level (lighthouseScale), as the tower built in code did.
 */
export const LIGHTHOUSE_FIT: BuildingFit = { width: 1.8, height: 3.2 };

/**
 * Corrections by hand, per building: `scale` multiplies the fitted size, `turn` turns the model around its vertical
 * axis (radians) so its front faces the camera. The camera looks from +z toward -z.
 * For the Lighthouse, `lantern` is the height of its lantern room as a share of its height: the beams and the light go there.
 */
export const BUILDING_FIX: Record<BuildingId, { scale: number; turn: number; lantern?: number }> = {
  lighthouse: { scale: 1, turn: 0, lantern: 0.82 },
  refinery: { scale: 1, turn: 0 },
  fishery: { scale: 1, turn: 0 },
  lumberyard: { scale: 1, turn: 0 },
  shelters: { scale: 1, turn: 0 },
  barracks: { scale: 1, turn: 0 },
  harbor: { scale: 1, turn: 0 },
  observatory: { scale: 1, turn: 0 },
  // Boxy, it looked larger than the others at the same size.
  infirmary: { scale: 0.85, turn: 0 },
};

/** A building ready for its tile; `height` is its height once fitted, for its label and its tap shape. */
export type BuildingModel = { object: THREE.Object3D; height: number };
export type BuildingModels = Record<BuildingId, BuildingModel>;

/**
 * Centers a model on its tile, stands it on y = 0, scales it to fit `fit` (keeping its proportions), then applies
 * the hand corrections. The model is wrapped, never changed: it can be loaded in any position or size.
 */
export function normalizeBuilding(model: THREE.Object3D, fit: BuildingFit, fix: { scale: number; turn: number }): BuildingModel {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = Math.min(fit.width / Math.max(size.x, size.z), fit.height / size.y) * fix.scale;
  const fitted = new THREE.Group();
  fitted.add(model);
  model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  fitted.scale.setScalar(s);
  const object = new THREE.Group();
  object.add(fitted);
  object.rotation.y = fix.turn;
  object.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return { object, height: size.y * s };
}

/** Loads the nine models in parallel with the scene's loader, each fitted to its tile. */
export async function loadBuildings(loader: GLTFLoader): Promise<BuildingModels> {
  const loaded = await Promise.all(BUILDING_IDS.map((id) => loader.loadAsync(buildingUrl(id))));
  const out = {} as BuildingModels;
  BUILDING_IDS.forEach((id, i) => (out[id] = normalizeBuilding(loaded[i]!.scene, id === "lighthouse" ? LIGHTHOUSE_FIT : TILE_FIT, BUILDING_FIX[id])));
  return out;
}
