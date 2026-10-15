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

/** The empty island: grass tiles on rings 0 to 2, a ring of sand and foam on ring 3. */
export function createIsland(kit: Kit): THREE.Group {
  const island = new THREE.Group();
  const sandM = new THREE.MeshStandardMaterial({ color: "#E9D9A6", roughness: 1 });
  const foamM = new THREE.MeshBasicMaterial({ color: "#fff", transparent: true, opacity: 0.5, depthWrite: false });
  const foamG = hexGeometry(1.4);
  const sandG = hexGeometry(1.2);
  for (let q = -3; q <= 3; q++)
    for (let r = -3; r <= 3; r++) {
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
      if (ring > 3) continue;
      const x = hexX(q, r);
      const z = hexZ(r);
      if (ring <= 2) {
        const tile = kitModel(kit, "hex_grass");
        tile.position.set(x, 0, z);
        island.add(tile);
      } else {
        const foam = new THREE.Mesh(foamG, foamM);
        foam.position.set(x, -0.36, z);
        island.add(foam);
        const sand = new THREE.Mesh(sandG, sandM);
        sand.position.set(x, -0.38, z);
        sand.receiveShadow = true;
        island.add(sand);
      }
    }
  return island;
}
