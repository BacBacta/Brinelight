/**
 * What the city and the sea share about a building's room: how far it may reach on its plot, the tier of its
 * Lighthouse's lantern, and the fitting of a model to a given room (the sea's wreck, camp and boat).
 */
import * as THREE from "three";

/** The room a model may take: its widest side on the ground, and its height (world units; a tile is 2 wide). */
export type BuildingFit = { width: number; height: number };

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

/** A model ready for its room; `height` is its height once fitted. */
export type BuildingModel = { object: THREE.Object3D; height: number };

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
