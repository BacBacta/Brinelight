/**
 * The city's normal view (week 8, task 1): the camera as close as it can be while the island and every raft slot open
 * at this Lighthouse level stay on screen, between the panels at the top and the tab bar at the bottom. The camera's
 * angle is the prototype's; only its distance and the point it looks at change with the screen.
 */
import * as THREE from "three";
import { RAFT_SLOTS, slotOpen } from "@brinelight/shared";
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

/**
 * The island's shore, where its land meets the water, every 10° from +x (measured once on its model, as fitted by
 * fitIsland; a test checks it against the model), and the foam's width beyond it.
 */
export const SHORE_LINE: readonly (readonly [number, number])[] = [[4.85,0],[4.78,0.84],[4.79,1.74],[4.72,2.73],[4.21,3.54],[3.57,4.25],[2.75,4.76],[1.85,5.07],[0.89,5.02],[0,5.15],[-0.89,5.02],[-1.88,5.17],[-2.63,4.55],[-3.57,4.25],[-4.25,3.57],[-4.81,2.78],[-5.22,1.9],[-5.42,0.96],[-5.3,0],[-5.02,-0.89],[-4.93,-1.8],[-4.59,-2.65],[-3.95,-3.31],[-3.28,-3.91],[-2.65,-4.59],[-1.86,-5.12],[-0.99,-5.61],[0,-5.2],[0.89,-5.02],[1.76,-4.84],[2.55,-4.42],[3.31,-3.95],[3.95,-3.31],[4.37,-2.53],[4.75,-1.73],[4.97,-0.88]];
export const FOAM = 0.4;

/** The points that must stay on screen: the island's shore with its foam, the pier's slots, and the hexagon of each raft at `rafts`. */
export function cityPoints(rafts: readonly { x: number; z: number }[]): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (const [x, z] of SHORE_LINE) {
    const r = Math.hypot(x, z);
    points.push(new THREE.Vector3((x * (r + FOAM)) / r, 0, (z * (r + FOAM)) / r));
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
