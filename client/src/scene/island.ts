import * as THREE from "three";

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
