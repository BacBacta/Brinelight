/**
 * Where the Night's sea (the rules' bearings and distances, shared/src/rules/night) lies on the island's water. Pure,
 * so it is tested without a screen. 0° is north, up the screen (−z); bearings turn clockwise.
 */
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
