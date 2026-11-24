/**
 * Where the Night's sea (the rules' bearings and distances, shared/src/rules/night) lies on the island's water. Pure,
 * so it is tested without a screen. 0° is north, up the screen (−z); bearings turn clockwise.
 */
import * as THREE from "three";
import { night as N } from "@brinelight/shared";

/** How far from the Lighthouse the edge of the Night's sea is drawn, in world units: the camera keeps it on screen. */
export const NIGHT_REACH = 12;

/** The island's coast at an angle (radians, the scene's own: coast.ts). */
export type CoastAt = (angle: number) => number;

const RAD = Math.PI / 180;

/** The scene's angle (atan2(z, x)) of a bearing. */
const sceneAngle = (bearing: number): number => Math.atan2(-Math.cos(bearing * RAD), Math.sin(bearing * RAD));

/**
 * A point of the Night's sea on the water: the rules' coast on the island's coast, the edge of the sea at NIGHT_REACH,
 * evenly between.
 */
export function seaToWorld(bearing: number, distance: number, coastAt: CoastAt): { x: number; z: number } {
  const coast = coastAt(sceneAngle(bearing));
  const share = (distance - N.COAST_RADIUS) / (N.SEA_RADIUS - N.COAST_RADIUS);
  const r = coast + share * (NIGHT_REACH - coast);
  return { x: Math.sin(bearing * RAD) * r, z: -Math.cos(bearing * RAD) * r };
}

/** The bearing of a point of the water, seen from the Lighthouse; none at the Lighthouse itself. */
export function bearingOf(x: number, z: number): number | null {
  if (Math.hypot(x, z) < 1e-9) return null;
  const b = Math.atan2(x, -z) / RAD;
  return b < 0 ? b + 360 : b;
}

/** How fast the keys turn the beam, in degrees a second: half a turn a second. */
export const KEY_TURN = 180;

/** The beam turned by the keys: `dir` 1 clockwise, −1 the other way, 0 held; for `seconds`. */
export function turnBy(bearing: number, dir: -1 | 0 | 1, seconds: number): number {
  if (dir === 0) return bearing;
  const b = (bearing + dir * KEY_TURN * seconds) % 360;
  return b < 0 ? b + 360 : b;
}

/** The bearing of the water under a point of the screen (client pixels); none if it misses the water or is on the Lighthouse. */
export function pointerBearing(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  camera: THREE.Camera,
  waterY: number,
): number | null {
  pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  water.constant = -waterY;
  const hit = ray.ray.intersectPlane(water, onWater);
  if (!hit || Math.hypot(hit.x, hit.z) < 0.5) return null;
  return bearingOf(hit.x, hit.z);
}

const pointer = new THREE.Vector2();
const ray = new THREE.Raycaster();
const water = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const onWater = new THREE.Vector3();
