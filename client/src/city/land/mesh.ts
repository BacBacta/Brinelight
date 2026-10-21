/**
 * The land's mesh as a geometry (meshData.ts builds its arrays, in the land's worker or here when there is none).
 */
import * as THREE from "three";
import type { LandSlots } from "./field.js";
import { landData, type CoastSegment, type LandData } from "./meshData.js";

export { SPAN, STEP, aboveSea, coastLines, landData, type CoastSegment, type LandData } from "./meshData.js";

export type LandMesh = { geometry: THREE.BufferGeometry; coast: CoastSegment[]; triangles: number };

/** A geometry from the land's arrays: nothing is computed again (its normals come with them). */
export function landGeometry(d: LandData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(d.position, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(d.normal, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(d.uv, 2));
  geometry.setAttribute("aShore", new THREE.BufferAttribute(d.shore, 4));
  geometry.setAttribute("aMarks", new THREE.BufferAttribute(d.marks, 2));
  geometry.setIndex(new THREE.BufferAttribute(d.index, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** The land of these slots, built here at once: its mesh, its coast, its triangles. */
export function buildLand(L: LandSlots): LandMesh {
  const d = landData(L);
  return { geometry: landGeometry(d), coast: d.coast, triangles: d.triangles };
}
