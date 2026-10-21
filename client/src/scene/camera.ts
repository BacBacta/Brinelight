import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CITY_ANGLE, CITY_FOV } from "./framing.js";

/** Below this width / height ratio the screen counts as portrait (prototype: W/H < .8). */
export const PORTRAIT_ASPECT = 0.8;

export function createCamera(): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(CITY_FOV, 1, 0.1, 400);
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

/** Puts the camera on the city's normal view (framing.ts) for this screen: its distance and the point it looks at. */
export function frameCity(camera: THREE.PerspectiveCamera, ctl: OrbitControls, aspect: number, framing: { distance: number; target: THREE.Vector3 }): void {
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  ctl.target.copy(framing.target);
  camera.position.copy(framing.target).addScaledVector(CITY_ANGLE, framing.distance);
  // Zooming out stops at the normal view (or at 40 where the prototype stopped, if that is farther).
  ctl.maxDistance = Math.max(40, framing.distance);
  ctl.update();
}
