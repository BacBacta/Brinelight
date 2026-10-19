/**
 * The city's normal view (week 8): the camera as close as it can be while the island, the pier and every raft moored
 * stay on screen, between the panels at the top and the tab bar at the bottom. It moves back a little with each raft:
 * no closer than the island and the pier alone allow, no farther than all 39 rafts need. The camera's angle is the
 * prototype's; only its distance and the point it looks at change.
 */
import * as THREE from "three";
import { RAFT_SLOTS, slotOpen } from "@brinelight/shared";
import { coastAt } from "./coast.js";
import { hexX, hexZ } from "./island.js";

/** The screen in CSS pixels, and the band the city must fit in: below the top panels, above the bottom ones. */
export type View = { width: number; height: number; top: number; bottom: number };

/** Where the camera looks from: the prototype's angle (up 0.72, back 0.69). */
export const CITY_ANGLE = new THREE.Vector3(0, 0.72, 0.69).normalize();
/** The camera's vertical field of view, in degrees. */
export const CITY_FOV = 40;
/** Kept free on the left and right of the screen, in pixels. */
export const SIDE_MARGIN = 4;
/** How far a raft reaches from its slot's center (its hexagon). */
export const RAFT_REACH = 1;
/** Where every raft slot open at this Lighthouse level lies. */
export const openSlots = (lighthouseLevel: number) => RAFT_SLOTS.filter((s) => slotOpen(s.ring, lighthouseLevel)).map((s) => ({ x: hexX(s.q, s.r), z: hexZ(s.r) }));

/** Slots the rules keep for the Harbor's pier: its boats lie there. */
export const PIER_SLOTS: readonly (readonly [number, number])[] = [
  [1, -3],
  [1, -4],
  [2, -4],
];

/** What shows past the coast: the island's rocky sides going down into the water, and the foam around them. */
export const FOAM = 0.8;

/** The points that must stay on screen: the island's shore with its foam, the pier's slots, and the hexagon of each raft at `rafts`. */
export function cityPoints(rafts: readonly { x: number; z: number }[]): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r = coastAt(a) + FOAM;
    points.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  for (const { x, z } of [...rafts, ...PIER_SLOTS.map(([q, r]) => ({ x: hexX(q, r), z: hexZ(r) }))]) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      points.push(new THREE.Vector3(x + Math.cos(a) * RAFT_REACH, 0, z + Math.sin(a) * RAFT_REACH));
    }
  }
  return points;
}

/** Where the points land on screen, in pixels, with the camera at `distance` from `target` (on the ground, at x = 0). */
function bounds(view: View, points: readonly THREE.Vector3[], distance: number, targetZ: number) {
  const camera = new THREE.PerspectiveCamera(CITY_FOV, view.width / view.height, 0.1, 400);
  const target = new THREE.Vector3(0, 0, targetZ);
  camera.position.copy(target).addScaledVector(CITY_ANGLE, distance);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const v = new THREE.Vector3();
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const p of points) {
    v.copy(p).project(camera);
    const x = ((v.x + 1) / 2) * view.width;
    const y = ((1 - v.y) / 2) * view.height;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  return { left, right, top, bottom };
}

/** The point the camera looks at, on the z axis, that puts the points in the middle of the band, at this distance. */
function centered(view: View, points: readonly THREE.Vector3[], distance: number): number {
  const middle = (view.top + view.bottom) / 2;
  const off = (z: number) => {
    const b = bounds(view, points, distance, z);
    return (b.top + b.bottom) / 2 - middle;
  };
  // The secant method: the points move on screen almost in proportion to the target.
  let [z0, z1] = [0, -1];
  let [f0, f1] = [off(z0), off(z1)];
  for (let i = 0; i < 8 && Math.abs(f1) > 0.25 && f1 !== f0; i++) {
    const z2 = z1 - (f1 * (z1 - z0)) / (f1 - f0);
    [z0, f0] = [z1, f1];
    [z1, f1] = [z2, off(z2)];
  }
  return z1;
}

/**
 * The city's normal view on this screen: the shortest distance at which the island, the pier and the rafts fit in the band (to a hundredth), and the point it looks at, which centers them in it.
 */
export function cityFraming(view: View, rafts: readonly { x: number; z: number }[]): { distance: number; target: THREE.Vector3 } {
  const points = cityPoints(rafts);
  const fits = (distance: number) => {
    const z = centered(view, points, distance);
    const b = bounds(view, points, distance, z);
    return b.left >= SIDE_MARGIN && b.right <= view.width - SIDE_MARGIN && b.top >= view.top && b.bottom <= view.bottom;
  };
  let [near, far] = [5, 200];
  while (far - near > 0.01) {
    const mid = (near + far) / 2;
    if (fits(mid)) far = mid;
    else near = mid;
  }
  return { distance: far, target: new THREE.Vector3(0, 0, centered(view, points, far)) };
}
