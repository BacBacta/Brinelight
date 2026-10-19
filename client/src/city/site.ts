/**
 * The building site of a building at work, or not built yet (week 8, task 1): scaffolding built in code around it, a
 * pile of planks, and a small crane whose arm swings slowly. It replaces the prototype kit's scaffolding. Display only:
 * it follows the works the server sends.
 *
 * Every site's scaffolding is one merged mesh, and the cranes one InstancedMesh: two draw calls in all, whatever the
 * number of sites. The cranes stand still with reduced motion.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PAINT, partGeometry, type Part } from "./growth.js";

/** The room a site goes around: how far the building reaches on its plot (in hex distance, the plot's edge at 1), and its height. */
export type SiteBox = { reach: number; height: number };

/** How far the arm of a crane swings each way, in radians, and how long a swing takes, in seconds. */
export const CRANE_SWING = (25 * Math.PI) / 180;
export const CRANE_PERIOD = 6;

/** How far outside the building the scaffolding stands, and the farthest it may stand: its poles and the crane's mast stay on the plot. */
export const SITE_GAP = 0.02;
export const SITE_ROOM = 0.9;

/** The scaffolding's radius around a building: its corners' hex distance from the plot's center. */
export const siteRadius = (box: SiteBox): number => Math.min(box.reach + SITE_GAP, SITE_ROOM);

/**
 * The corners of the scaffolding, a hexagon like the plot: right front, front, left front, left back, back, right back.
 * The camera looks from +z.
 */
function corners(r: number): [number, number][] {
  const s = r / Math.sqrt(3);
  return [
    [r, s],
    [0, 2 * s],
    [-r, s],
    [-r, -s],
    [0, -2 * s],
    [r, -s],
  ];
}

/** A plank of `depth` along the side from a to b, at height y, its outer face on that side. */
function deck(a: readonly [number, number], b: readonly [number, number], y: number, depth = 0.16): Part {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
  const length = Math.hypot(dx, dz);
  // The side's inward normal: toward the plot's center.
  const [nx, nz] = [-dz / length, dx / length];
  const inward = nx * -a[0] + nz * -a[1] > 0 ? 1 : -1;
  return {
    shape: "box",
    at: [(a[0] + b[0]) / 2 + nx * inward * (depth / 2), y, (a[1] + b[1]) / 2 + nz * inward * (depth / 2)],
    size: [length, 0.04, depth],
    paint: "plank",
    turn: -Math.atan2(dz, dx),
  };
}

/**
 * The scaffolding around a building: four poles at the corners of the sides the camera sees, two decks of planks on the
 * two right ones (the front right side and the right side), a ladder up the front left side, a pulley hanging from the
 * front pole, and a pile of planks at the ladder's foot.
 */
export function scaffoldParts(box: SiteBox): Part[] {
  const c = corners(siteRadius(box));
  const h = Math.max(0.6, box.height * 0.7);
  const parts: Part[] = [c[2]!, c[1]!, c[0]!, c[5]!].map(([x, z]) => ({ shape: "box", at: [x * 0.97, h / 2, z * 0.97], size: [0.06, h, 0.06], paint: "wood" }));
  for (const y of [h * 0.45, h * 0.9]) parts.push(deck(c[1]!, c[0]!, y), deck(c[0]!, c[5]!, y));
  // The ladder, along the front left side, a little inside it: two rails and four rungs.
  const [a, b] = [c[1]!, c[2]!];
  const along = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  const at = (t: number, inset: number): [number, number] => [(a[0] + (b[0] - a[0]) * t) * (1 - inset), (a[1] + (b[1] - a[1]) * t) * (1 - inset)];
  for (const t of [0.4, 0.6]) {
    const [x, z] = at(t, 0.06);
    parts.push({ shape: "box", at: [x, h * 0.45, z], size: [0.03, h * 0.9, 0.03], paint: "wood" });
  }
  for (let i = 1; i <= 4; i++) {
    const [x, z] = at(0.5, 0.06);
    parts.push({ shape: "box", at: [x, (h * 0.9 * i) / 5, z], size: [0.2, 0.025, 0.025], paint: "wood", turn: along });
  }
  // The pulley, under the top of the front pole, and its rope.
  const [px, pz] = [a[0] * 0.9, a[1] * 0.9];
  parts.push({ shape: "cyl", at: [px, h - 0.12, pz], size: [0.14, 0.04, 0.14], paint: "brass", lie: true, turn: Math.PI / 2 });
  parts.push({ shape: "box", at: [px, h * 0.5 - 0.1, pz], size: [0.015, h - 0.2, 0.015], paint: "navy" });
  // The pile of planks, at the foot of the ladder, inside the scaffolding.
  for (let i = 0; i < 3; i++) {
    const [x, z] = at(0.75, 0.2);
    parts.push({ shape: "box", at: [x, 0.03 + i * 0.05, z], size: [0.3, 0.04, 0.09], paint: "plank", turn: along + 0.2 + i * 0.12 });
  }
  return parts;
}

/** Where the crane stands for a site: at the scaffolding's right front corner. */
export const cranePlace = (box: SiteBox): { x: number; z: number } => {
  const [x, z] = corners(siteRadius(box))[0]!;
  return { x: x * 0.97, z: z * 0.97 };
};

/** The crane's size for a site: 1 for a building 1.7 high (as tall as the tile allows), smaller for a lower one. */
export const craneScale = (box: SiteBox): number => Math.max(0.6, box.height * 0.7) / (1.7 * 0.7);

/** How far the crate goes up and down under the crane's arm, at size 1. */
export const CRATE_LIFT = 0.15;

/**
 * The crane at size 1, standing at the origin, its arm turned by `angle` and its crate lifted by `lift` (from -1 to 1):
 * its mast, its arm reaching back over the building, the rope and the crate. All boxes: one instanced box draws them.
 */
export function craneParts(angle = 0, lift = 0): Part[] {
  const h = 1.7 * 0.7 + 0.35;
  const reach = 0.55;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // A point at (x, z) of the unturned arm, turned with it.
  const turn = (x: number, z: number): [number, number] => [x * c + z * s, -x * s + z * c];
  const [ax, az] = turn(-reach / 2, -reach / 2);
  const [tx, tz] = turn(-reach, -reach);
  const crate = h - 0.42 + lift * CRATE_LIFT;
  const rope = h - (crate + 0.06);
  return [
    { shape: "box", at: [0, h / 2, 0], size: [0.07, h, 0.07], paint: "navy" },
    { shape: "box", at: [ax, h, az], size: [0.06, 0.06, reach * 1.42], paint: "brass", turn: Math.PI / 4 + angle },
    { shape: "box", at: [tx, h - rope / 2, tz], size: [0.015, rope, 0.015], paint: "navy" },
    { shape: "box", at: [tx, crate, tz], size: [0.16, 0.12, 0.16], paint: "wood", turn: angle },
  ];
}

/** Merges shapes into one geometry. */
export const partsGeometry = (parts: readonly Part[]): THREE.BufferGeometry => mergeGeometries(parts.map(partGeometry));

/**
 * The building sites of the city: `show` sets them, one per plot at work or not built yet, each with its box; a crane
 * swings on each one at work, its crate going up and down.
 */
export function createSites(add: (o: THREE.Object3D) => void, max: number) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const scaffold = new THREE.Mesh(new THREE.BufferGeometry(), material);
  scaffold.name = "sites";
  scaffold.castShadow = true;
  scaffold.receiveShadow = true;
  scaffold.visible = false;
  add(scaffold);
  // Every part of every crane is this one box, moved, sized and colored per instance.
  const box = new THREE.BoxGeometry(1, 1, 1);
  const PER_CRANE = craneParts().length;
  const cranes = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), max * PER_CRANE);
  cranes.name = "cranes";
  cranes.castShadow = true;
  cranes.frustumCulled = false;
  cranes.count = 0;
  cranes.visible = false;
  add(cranes);
  let shown: { x: number; z: number; scale: number; moving: boolean; phase: number }[] = [];
  const m4 = new THREE.Matrix4();
  const site = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const size = new THREE.Vector3();
  const p = new THREE.Vector3();
  const color = new THREE.Color();
  let key = "";
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const place = (now: number, paint = false) => {
    shown.forEach((s, i) => {
      const t = s.moving && !still ? (now / CRANE_PERIOD) * Math.PI * 2 + s.phase : 0;
      site.compose(p.set(s.x, 0, s.z), q.identity(), size.setScalar(s.scale));
      craneParts(Math.sin(t) * CRANE_SWING, s.moving && !still ? Math.sin(t * 2) : 0).forEach((part, j) => {
        m4.compose(p.set(...part.at), q.setFromAxisAngle(up, part.turn ?? 0), size.set(...part.size)).premultiply(site);
        cranes.setMatrixAt(i * PER_CRANE + j, m4);
        if (paint) cranes.setColorAt(i * PER_CRANE + j, color.set(PAINT[part.paint]));
      });
    });
    cranes.instanceMatrix.needsUpdate = true;
    if (paint && cranes.instanceColor) cranes.instanceColor.needsUpdate = true;
  };

  return {
    /** The sites to show: each at its plot's center (x, z), around its box; `moving` for a work in progress. */
    show(sites: readonly { x: number; z: number; box: SiteBox; moving: boolean }[]) {
      const next = JSON.stringify(sites);
      if (next === key) return;
      key = next;
      scaffold.geometry.dispose();
      scaffold.geometry = sites.length ? mergeGeometries(sites.map((s) => partsGeometry(scaffoldParts(s.box)).translate(s.x, 0, s.z))) : new THREE.BufferGeometry();
      scaffold.visible = sites.length > 0;
      shown = sites.map((s, i) => {
        const at = cranePlace(s.box);
        return { x: s.x + at.x, z: s.z + at.z, scale: craneScale(s.box), moving: s.moving, phase: i * 1.7 };
      });
      cranes.count = shown.length * PER_CRANE;
      cranes.visible = shown.length > 0;
      place(0, true);
    },
    animate(now: number) {
      if (shown.some((s) => s.moving) && !still) place(now);
    },
  };
}
