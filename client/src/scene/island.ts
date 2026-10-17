import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** The models of phare.glb, one scene per name ("hex_grass", "building_…"). */
export type Kit = Record<string, THREE.Object3D>;

/** Hex grid to world position (prototype: hx, hz). */
export const hexX = (q: number, r: number) => 2 * (q + r / 2);
export const hexZ = (r: number) => 1.732 * r;

export function hexGeometry(radius: number): THREE.CircleGeometry {
  const g = new THREE.CircleGeometry(radius, 6);
  g.rotateX(-Math.PI / 2);
  g.rotateY(Math.PI / 6);
  return g;
}

export function kitModel(kit: Kit, name: string): THREE.Object3D {
  const source = kit[name];
  if (!source) return new THREE.Group();
  const o = source.clone(true);
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return o;
}

/** The outline of each building plot on the island: cream, half transparent, readable on sand as on rock. */
export const PLOT_OUTLINE = { color: "#FFF4DA", opacity: 0.55, inner: 0.98, outer: 1.08 } as const;

/**
 * The empty island: the island model (fitted by fitIsland: shore on ring 3, meadow at y = 0) and the outlines of the
 * 19 plots of rings 0 to 2 (one mesh). The prototype's foam hexagons on ring 3 are gone: the model has its own shore,
 * and at y = -0.36 they lay inside the waves (-0.59 to -0.25), which crossed them on every frame.
 */
export function createIsland(model: THREE.Object3D): THREE.Group {
  const island = new THREE.Group();
  island.add(model);
  const outlines: THREE.BufferGeometry[] = [];
  for (let q = -2; q <= 2; q++)
    for (let r = -2; r <= 2; r++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) > 2) continue;
      const g = new THREE.RingGeometry(PLOT_OUTLINE.inner, PLOT_OUTLINE.outer, 6, 1);
      g.rotateX(-Math.PI / 2);
      g.rotateY(Math.PI / 6);
      g.translate(hexX(q, r), 0.015, hexZ(r));
      outlines.push(g);
    }
  const outline = new THREE.Mesh(
    mergeGeometries(outlines),
    new THREE.MeshBasicMaterial({ color: PLOT_OUTLINE.color, transparent: true, opacity: PLOT_OUTLINE.opacity, depthWrite: false }),
  );
  outline.name = "plot-outlines";
  island.add(outline);
  return island;
}
