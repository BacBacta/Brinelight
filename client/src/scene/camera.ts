import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/** Below this width / height ratio the screen counts as portrait (prototype: W/H < .8). */
export const PORTRAIT_ASPECT = 0.8;

/**
 * Distance from the camera to the city, as in the prototype:
 * further back in portrait, and further again from Lighthouse level 4 and level 8.
 */
export function cameraDistance(aspect: number, lighthouseLevel: number): number {
  const portrait = aspect < PORTRAIT_ASPECT;
  const far = lighthouseLevel >= 8 ? (portrait ? 1.6 : 1.35) : lighthouseLevel >= 4 ? (portrait ? 1.4 : 1.2) : 1;
  return (portrait ? 24.5 : 17) * far;
}

export function createCamera(): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(40, 1, 0.1, 200);
}

export function createControls(camera: THREE.PerspectiveCamera, dom: HTMLElement): OrbitControls {
  const ctl = new OrbitControls(camera, dom);
  ctl.enableDamping = true;
  ctl.enablePan = false;
  ctl.minDistance = 9;
  ctl.maxDistance = 40;
  ctl.minPolarAngle = 0.5;
  ctl.maxPolarAngle = 1.1;
  ctl.target.set(0, 0, 0.6);
  ctl.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  ctl.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
  return ctl;
}

/** Puts the camera back on its starting view for this screen and Lighthouse level. */
export function frameCity(camera: THREE.PerspectiveCamera, ctl: OrbitControls, aspect: number, lighthouseLevel: number): void {
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  const d = cameraDistance(aspect, lighthouseLevel);
  camera.position.set(0, d * 0.72, d * 0.69 + 0.6);
  ctl.target.set(0, 0, aspect < PORTRAIT_ASPECT ? -0.2 : 0.6);
  ctl.update();
}
