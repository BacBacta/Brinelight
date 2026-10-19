/**
 * The nine building models of the city (client/public/buildings, made by assets/make-models.py from
 * the art direction's concepts). Their three visual tiers are placed by city/tiers.ts.
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
  fishery: { scale: 0.95, turn: 0 },
  lumberyard: { scale: 1, turn: 0 },
  shelters: { scale: 1, turn: 0 },
  // Wide: at full size, the palisade and the pier reached out of their plots (PLOT_ROOM, week 6).
  barracks: { scale: 0.9, turn: 0 },
  harbor: { scale: 1, turn: 0 },
  observatory: { scale: 1, turn: 0 },
  // Boxy, it looked larger than the others at the same size.
  infirmary: { scale: 0.85, turn: 0 },
};

export type Tier = 0 | 1 | 2 | 3;
/** A building's visual tier (docs/art-direction.md): levels 1 to 4, 5 to 9, 10 and up; 0 when not built. */
export const tierOf = (level: number): Tier => (level <= 0 ? 0 : level <= 4 ? 1 : level <= 9 ? 2 : 3);

/**
 * How far from its plot's center a building and its details may reach, in "hex distance": the plot's edge is at 1 (its
 * neighbors' centers are 2 away), its outline starts at 0.98.
 */
export const PLOT_ROOM = 0.95;
/** The hex distance of a point from its plot's center: the farthest of its distances along the three edge directions. */
export const hexReach = (x: number, z: number): number => Math.max(Math.abs(x), Math.abs(x / 2 + z * 0.866), Math.abs(-x / 2 + z * 0.866));

/** The farthest hex distance any vertex of `object` reaches, in the frame of `object`'s parent (its own transform included). */
export function footprintReach(object: THREE.Object3D): number {
  object.updateMatrixWorld(true);
  const toParent = new THREE.Matrix4().copy(object.parent?.matrixWorld ?? new THREE.Matrix4()).invert();
  const v = new THREE.Vector3();
  let reach = 0;
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    const m = new THREE.Matrix4().multiplyMatrices(toParent, mesh.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      reach = Math.max(reach, hexReach(v.x, v.z));
    }
  });
  return reach;
}

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

/**
 * Loads the nine models in parallel with the scene's loader, each fitted to its tile. The buildings in `remade` (made in
 * Blender, week 8) are not fetched: they stand in as an empty model of the height given.
 */
export async function loadBuildings(loader: GLTFLoader, remade: Partial<Record<BuildingId, number>> = {}): Promise<BuildingModels> {
  const loaded = await Promise.all(BUILDING_IDS.map((id) => (remade[id] === undefined ? loader.loadAsync(buildingUrl(id)) : null)));
  const out = {} as BuildingModels;
  BUILDING_IDS.forEach((id, i) => {
    const gltf = loaded[i];
    out[id] = gltf ? normalizeBuilding(gltf.scene, id === "lighthouse" ? LIGHTHOUSE_FIT : TILE_FIT, BUILDING_FIX[id]) : { object: new THREE.Group(), height: remade[id]! };
  });
  return out;
}
