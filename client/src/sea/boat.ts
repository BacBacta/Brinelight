import * as THREE from "three";

/** A small sailing boat, built in code as in the prototype. */
export function createBoat(color: THREE.ColorRepresentation, big = false): THREE.Group {
  const g = new THREE.Group();
  const hullM = new THREE.MeshStandardMaterial({ color: "#8A5A34", roughness: 0.8 });
  const sailM = new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide });
  const s = big ? 1.3 : 1;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.42 * s, 0.2 * s, 1 * s), hullM);
  hull.position.y = 0.06;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.21 * s, 0.36 * s, 4), hullM);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.06, 0.66 * s);
  bow.scale.set(1, 1, 0.6);
  g.add(bow);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.03 * s, 0.95 * s, 6), hullM);
  mast.position.set(0, 0.55 * s, 0);
  g.add(mast);
  const sailGeo = new THREE.PlaneGeometry(0.55 * s, 0.55 * s, 4, 4);
  const p = sailGeo.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, (1 - (x / (0.28 * s)) ** 2) * 0.08 * s);
  }
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, sailM);
  sail.position.set(0, 0.6 * s, 0.04);
  g.add(sail);
  return g;
}
