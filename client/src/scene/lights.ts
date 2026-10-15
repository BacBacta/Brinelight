import * as THREE from "three";

export function addCityLights(scene: THREE.Scene): { hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight } {
  const hemi = new THREE.HemisphereLight("#EAF6FF", "#4F6B3A", 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#FFF1D6", 2.6);
  sun.position.set(-7, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  return { hemi, sun };
}
