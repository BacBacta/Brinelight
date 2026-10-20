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
/** How far a raft's deck reaches from its slot's center (its room, RAFT_FILL in coast.ts). */
const RAFT_DECK = 0.82;
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

/**
 * The points that must stay on screen: the island's shore with its foam, the pier's slots, the hexagon of each raft at
 * `rafts`, and the `tops` of the tallest buildings (the Lighthouse's).
 */
export function cityPoints(rafts: readonly { x: number; z: number }[], tops: readonly { x: number; y: number; z: number }[] = []): THREE.Vector3[] {
  const points: THREE.Vector3[] = tops.map((t) => new THREE.Vector3(t.x, t.y, t.z));
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

/** How much of the screen's width the city spans in a framing (its coast and its rafts' decks), from 0 to 1. */
export function cityWidthShare(view: View, rafts: readonly { x: number; z: number }[], framing: { distance: number; target: THREE.Vector3 }, coast: Coast = coastAt): number {
  const b = bounds(view, cityExtent(rafts, coast), framing.distance, framing.target);
  return (b.right - b.left) / view.width;
}

/** How far the land reaches from the island's center in a direction (x = cos, z = sin). */
export type Coast = (angle: number) => number;

/** The middles of the 19 plots of rings 0 to 2: the buildings stand there. */
const PLOT_CENTERS: THREE.Vector3[] = [];
for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2) PLOT_CENTERS.push(new THREE.Vector3(hexX(q, r), 0, hexZ(r)));

/** What the city shows across the screen: its coast and its rafts' decks (no foam, no pier). */
export function cityExtent(rafts: readonly { x: number; z: number }[], coast: Coast = coastAt): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * coast(a), 0, Math.sin(a) * coast(a)));
  }
  for (const { x, z } of rafts)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      points.push(new THREE.Vector3(x + Math.cos(a) * RAFT_DECK, 0, z + Math.sin(a) * RAFT_DECK));
    }
  return points;
}

/** Where the points land on screen, in pixels, with the camera at `distance` from `target` (on the ground), from `angle`. */
function bounds(view: View, points: readonly THREE.Vector3[], distance: number, target: THREE.Vector3, angle: THREE.Vector3 = CITY_ANGLE) {
  const camera = new THREE.PerspectiveCamera(CITY_FOV, view.width / view.height, 0.1, 400);
  camera.position.copy(target).addScaledVector(angle, distance);
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

/**
 * The point the camera looks at that puts the points in the middle of the band, at this distance: `origin` moved on
 * the ground toward the camera or away from it.
 */
function centered(view: View, points: readonly THREE.Vector3[], distance: number, origin: THREE.Vector3 = new THREE.Vector3(), angle: THREE.Vector3 = CITY_ANGLE): THREE.Vector3 {
  const middle = (view.top + view.bottom) / 2;
  const toward = new THREE.Vector3(angle.x, 0, angle.z).normalize();
  const at = (s: number) => origin.clone().addScaledVector(toward, s);
  const off = (s: number) => {
    const b = bounds(view, points, distance, at(s), angle);
    return (b.top + b.bottom) / 2 - middle;
  };
  // The secant method: the points move on screen almost in proportion to the target.
  let [s0, s1] = [0, -1];
  let [f0, f1] = [off(s0), off(s1)];
  for (let i = 0; i < 8 && Math.abs(f1) > 0.25 && f1 !== f0; i++) {
    const s2 = s1 - (f1 * (s1 - s0)) / (f1 - f0);
    [s0, f0] = [s1, f1];
    [s1, f1] = [s2, off(s2)];
  }
  return at(s1);
}

/** With ?blender (owner, after the style pass): the city never spans less of the screen's width in the normal view. */
export const CITY_FILL = 0.75;

/** A framing by the city's width (?blender): the share of the screen's width its coast and rafts span, and its coast. */
export type Fill = { share: number; coast: Coast };

/**
 * The city's normal view on this screen: the shortest distance at which the island, the pier and the rafts fit in the band (to a hundredth), and the point it looks at, which centers them in it.
 * With `fill` (owner, after the style pass), the city's coast and rafts never span less than that share of the screen's
 * width: when the band is too short for the whole city (works under way over the screen's top), the camera comes closer,
 * only the buildings (their plots' middles and the tallest tops) still in the band; the shore, a raft or the pier may
 * then pass under a panel. Otherwise the framing is the one above.
 */
export function cityFraming(view: View, rafts: readonly { x: number; z: number }[], tops: readonly { x: number; y: number; z: number }[] = [], fill?: Fill): { distance: number; target: THREE.Vector3 } {
  const extent = fill ? cityExtent(rafts, fill.coast) : [];
  const plots = fill ? [...PLOT_CENTERS, ...tops.map((t) => new THREE.Vector3(t.x, t.y, t.z))] : [];
  const points = fill ? plots : cityPoints(rafts, tops);
  const fits = (distance: number) => {
    const target = centered(view, points, distance);
    const b = bounds(view, points, distance, target);
    if (b.top < view.top || b.bottom > view.bottom) return false;
    if (!fill) return b.left >= SIDE_MARGIN && b.right <= view.width - SIDE_MARGIN;
    const e = bounds(view, extent, distance, target);
    return e.right - e.left <= fill.share * view.width;
  };
  let [near, far] = [5, 200];
  while (far - near > 0.01) {
    const mid = (near + far) / 2;
    if (fits(mid)) far = mid;
    else near = mid;
  }
  if (!fill) return { distance: far, target: centered(view, points, far) };
  // The whole city's framing, unless it shows the city smaller than `fill`.
  const whole = cityFraming(view, rafts, tops);
  return whole.distance <= far ? whole : { distance: far, target: centered(view, points, far) };
}

/** The pinch zoom's closest distance: the close view never goes nearer. */
export const CLOSE_MIN = 9;

/** A building's room, for the close view: its plot's center, its height and its reach (hex distance) on its plot. */
export type Volume = { x: number; z: number; height: number; reach: number };

/**
 * The close view of a building (week 8): the camera at the normal view's height above the ground, from `angle` (the
 * normal view's, or turned around the building, `turned`), as close as the building allows while its foot (its reach on
 * its plot) and its top stay in the band (between the top panels and the sheet's top), never nearer than CLOSE_MIN; the
 * building centered in the band.
 */
export function closeFraming(view: View, b: Volume, angle: THREE.Vector3 = CITY_ANGLE): { distance: number; target: THREE.Vector3 } {
  const points: THREE.Vector3[] = [new THREE.Vector3(b.x, b.height, b.z)];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    points.push(new THREE.Vector3(b.x + Math.cos(a) * b.reach, 0, b.z + Math.sin(a) * b.reach));
    points.push(new THREE.Vector3(b.x + Math.cos(a) * b.reach * 0.7, b.height * 0.8, b.z + Math.sin(a) * b.reach * 0.7));
  }
  const origin = new THREE.Vector3(b.x, 0, b.z);
  const fits = (distance: number) => {
    const r = bounds(view, points, distance, centered(view, points, distance, origin, angle), angle);
    return r.left >= SIDE_MARGIN && r.right <= view.width - SIDE_MARGIN && r.top >= view.top && r.bottom <= view.bottom;
  };
  let [near, far] = [CLOSE_MIN, 60];
  if (!fits(near)) {
    while (far - near > 0.01) {
      const mid = (near + far) / 2;
      if (fits(mid)) far = mid;
      else near = mid;
    }
  } else far = near;
  return { distance: far, target: centered(view, points, far, origin, angle) };
}

const UP = new THREE.Vector3(0, 1, 0);
/** The normal view's angle turned by `turn` radians around the vertical (the camera going around the island). */
export const turned = (turn: number): THREE.Vector3 => CITY_ANGLE.clone().applyAxisAngle(UP, turn);

/** The others are taken as upright cylinders this wide, for their reach: a building fills its plot's middle, not its corners. */
const BODY = 0.8;

/**
 * The share of a building a camera at `eye` does not see because the `others` hide it: points over the building's side
 * turned to the camera (five across, five up), each hidden when the line from it to the camera goes through another
 * building's body (an upright cylinder) below its top.
 */
export function hiddenShare(b: Volume, others: readonly Volume[], eye: THREE.Vector3): number {
  const toEye = new THREE.Vector2(eye.x - b.x, eye.z - b.z).normalize();
  const across = new THREE.Vector2(-toEye.y, toEye.x);
  let hidden = 0;
  let count = 0;
  for (let i = -2; i <= 2; i++)
    for (let j = 0; j < 5; j++) {
      const side = (i / 2) * b.reach * 0.75;
      const p = new THREE.Vector3(b.x + across.x * side + toEye.x * b.reach * 0.5, b.height * ((j + 0.5) / 5), b.z + across.y * side + toEye.y * b.reach * 0.5);
      count++;
      if (others.some((o) => blocks(p, eye, o))) hidden++;
    }
  return hidden / count;
}

/** Whether the line from `p` to `eye` goes through `o`'s body below its top. */
function blocks(p: THREE.Vector3, eye: THREE.Vector3, o: Volume): boolean {
  const r = o.reach * BODY;
  const dx = eye.x - p.x;
  const dz = eye.z - p.z;
  const fx = p.x - o.x;
  const fz = p.z - o.z;
  const a = dx * dx + dz * dz;
  const bb = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - r * r;
  const disc = bb * bb - 4 * a * c;
  if (a === 0 || disc < 0) return false;
  const t0 = (-bb - Math.sqrt(disc)) / (2 * a);
  const t1 = (-bb + Math.sqrt(disc)) / (2 * a);
  if (t1 <= 0 || t0 >= 1) return false;
  // The line climbs toward the camera: it is lowest where it enters the body.
  const y = p.y + (eye.y - p.y) * Math.max(0, t0);
  return y < o.height;
}

/** The turns the close view tries, nearest to the normal view's angle first: every 15° each way, around the island. */
const TURNS = [0, ...Array.from({ length: 12 }, (_, k) => [(k + 1) * 15, -(k + 1) * 15]).flat()].map((d) => (d * Math.PI) / 180);

/**
 * The close view of a building that nothing hides (owner, 19 October): the normal view's angle when nothing hides it
 * from there, else the nearest turn around it from which nothing does (or, failing one, the least hidden).
 */
export function clearView(view: View, b: Volume, others: readonly Volume[]): { distance: number; target: THREE.Vector3; angle: THREE.Vector3; turn: number } {
  let best: { distance: number; target: THREE.Vector3; angle: THREE.Vector3; turn: number; hidden: number } | null = null;
  for (const turn of TURNS) {
    const angle = turned(turn);
    const f = closeFraming(view, b, angle);
    const hidden = hiddenShare(b, others, f.target.clone().addScaledVector(angle, f.distance));
    if (!best || hidden < best.hidden) best = { ...f, angle, turn, hidden };
    if (hidden === 0) break;
  }
  const { hidden: _, ...out } = best!;
  return out;
}
