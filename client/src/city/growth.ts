/**
 * Buildings that change with every level (week 8, task 1; docs/tasks/week-8.md). Display only: the client reads the
 * levels the server sends, nothing else.
 *
 * - At every level that is not a transformation, a building gets the next small detail of its own list of six kinds,
 *   at the next of its fixed spots: after the sixth kind, the first again (a second barrel, then a third).
 * - At levels 5, 10, 15, 20, 25 and 30, a transformation: a larger piece that changes the building's silhouette.
 *
 * Everything is made of a few shapes built in code (boxes, cylinders, cones), colored per vertex: the details of every
 * building are merged into one mesh, and what glows (lamps, flames) into a second one. Two draw calls in all, whatever
 * the levels. Nothing is drawn at random, and a detail never moves once it is there.
 *
 * The buildings without a growth here keep the three tiers of week 6 (city/tiers.ts) until they get theirs.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BUILDING_IDS, type BuildingId, type Buildings } from "@brinelight/shared";

/** The colors of the details: the art direction's palette (docs/art-direction.md). */
export const PAINT = {
  wood: "#8C6B4A",
  plank: "#C9A77A",
  copper: "#5E9E8C",
  brass: "#E09A12",
  navy: "#163A63",
  stone: "#B9B2A6",
  brick: "#E2572F",
  /** What glows, drawn without light: the lamps' warm gold, and a flame. */
  lamp: "#FFC83A",
  flame: "#FF8A2A",
} as const;
export type Paint = keyof typeof PAINT;
const GLOWING: ReadonlySet<Paint> = new Set<Paint>(["lamp", "flame"]);

/**
 * One shape of a detail, in its own frame: a box, a cylinder or a cone of `size` (width, height, depth; for the round
 * ones, the diameter is the width), at `at`, turned by `turn` around the vertical, and tipped over by `lie` (the
 * cylinder then lies along x). A round one has `sides` sides (8 unless said), and no ends when `open` (a band).
 */
export type Part = {
  shape: "box" | "cyl" | "cone";
  at: readonly [number, number, number];
  size: readonly [number, number, number];
  paint: Paint;
  turn?: number;
  lie?: boolean;
  sides?: number;
  open?: boolean;
};

/** What a level adds to a building: a small detail, or a transformation. */
export type Piece = { level: number; name: string; transformation: boolean; parts: Part[] };

/**
 * Where a small detail stands on its plot (the plot's center at 0, 0; the camera looks from +z), at the building's full
 * size: on the ground, on a roof at height `y`, or on a `wall` at height `y`. It is turned by `turn`: its own +z then
 * faces away from the plot's center, or out of the wall.
 */
export type Spot = { x: number; z: number; y?: number; turn?: number; wall?: boolean };

/**
 * A kind of small detail: its name, and its shapes for its n-th copy (1, 2, 3…). One that stands is drawn on the ground
 * at the origin; one `on` a wall is drawn against the wall at z = 0, centered at y = 0, sticking out toward +z.
 */
export type Kind = { name: string; on?: "wall"; parts: (copy: number) => Part[] };

export type Growth = { kinds: readonly Kind[]; spots: readonly Spot[]; transformations: Readonly<Record<Transformation, { name: string; parts: Part[] }>> };

/** The levels of the transformations. */
export const TRANSFORMATIONS = [5, 10, 15, 20, 25, 30] as const;
export type Transformation = (typeof TRANSFORMATIONS)[number];
const isTransformation = (level: number): level is Transformation => (TRANSFORMATIONS as readonly number[]).includes(level);

/** The highest level a building's look follows: the Lighthouse's, which caps the others. */
export const GROWTH_MAX = 30;
/** The levels that add a small detail, up to 30: 2 to 4, 6 to 9 and so on. */
export const DETAIL_LEVELS = Array.from({ length: GROWTH_MAX }, (_, i) => i + 1).filter((l) => l > 1 && !isTransformation(l));

/* ---------- The shapes ---------- */

const barrel = (paint: Paint, band: Paint, h = 0.3, r = 0.13, sides = 8): Part[] => [
  { shape: "cyl", at: [0, h / 2, 0], size: [r * 2, h, r * 2], paint, sides },
  { shape: "cyl", at: [0, h * 0.72, 0], size: [r * 2.08, h * 0.12, r * 2.08], paint: band, sides, open: true },
];
const post = (h: number, paint: Paint = "wood", w = 0.06): Part => ({ shape: "box", at: [0, h / 2, 0], size: [w, h, w], paint });
const lamp = (y: number, s = 0.14): Part => ({ shape: "box", at: [0, y, 0], size: [s, s * 1.3, s], paint: "lamp" });
/** Moves shapes by (x, y, z). */
const shift = (parts: Part[], x: number, y: number, z: number): Part[] => parts.map((p) => ({ ...p, at: [p.at[0] + x, p.at[1] + y, p.at[2] + z] }));

/* ---------- The buildings ---------- */

/**
 * The Refinery (oil): barrels, pipes, valves, a warning lamp, drums and hoses; its transformations a second tank, a
 * chimney, a stone floor, a flare tower, brass and lit gauges, and a gantry. Its spots: the camera's side first (+z),
 * then the right (+x), the roof, the left and the back; the Lighthouse hides part of its left from the camera.
 */
const REFINERY: Growth = {
  kinds: [
    { name: "an oil barrel", parts: () => barrel("navy", "brass") },
    {
      name: "a length of pipe on the ground",
      parts: () => [
        { shape: "box", at: [-0.08, 0.04, 0], size: [0.06, 0.08, 0.17], paint: "wood" },
        { shape: "box", at: [0.08, 0.04, 0], size: [0.06, 0.08, 0.17], paint: "wood" },
        { shape: "cyl", at: [0, 0.14, 0], size: [0.13, 0.28, 0.13], paint: "brass", lie: true },
      ],
    },
    {
      name: "a valve wheel",
      on: "wall",
      parts: () => [
        { shape: "cyl", at: [0, 0, 0.035], size: [0.07, 0.4, 0.07], paint: "copper", sides: 6 },
        { shape: "cyl", at: [0, 0.02, 0.1], size: [0.26, 0.04, 0.26], paint: "brick", lie: true, turn: Math.PI / 2 },
      ],
    },
    {
      name: "a lit warning lamp",
      parts: () => [post(0.5), lamp(0.56, 0.15), { shape: "box", at: [0, 0.67, 0], size: [0.17, 0.04, 0.17], paint: "navy" }],
    },
    {
      name: "a stack of two drums",
      parts: () => [
        { shape: "cyl", at: [0, 0.12, 0], size: [0.24, 0.24, 0.24], paint: "brick", sides: 6 },
        { shape: "cyl", at: [0, 0.36, 0], size: [0.24, 0.24, 0.24], paint: "brick", sides: 6 },
        { shape: "cyl", at: [0, 0.24, 0], size: [0.25, 0.04, 0.25], paint: "navy", sides: 6, open: true },
      ],
    },
    {
      name: "a coiled hose",
      on: "wall",
      parts: () => [
        { shape: "box", at: [0, 0.12, 0.03], size: [0.05, 0.05, 0.06], paint: "wood" },
        { shape: "cyl", at: [0, 0, 0.05], size: [0.3, 0.07, 0.3], paint: "navy", lie: true, turn: Math.PI / 2 },
        { shape: "box", at: [0, 0, 0.09], size: [0.1, 0.1, 0.02], paint: "copper" },
      ],
    },
  ],
  // Measured once from the model (the ring between it and the plot's edge, the walls the camera sees, the roofs),
  // around the transformations' pieces, the camera's side first.
  spots: [
    { x: 0, z: 0.94 },
    { x: -0.41, z: 0.71, turn: -0.52 },
    { x: 0.34, y: 0.55, z: 0.43, wall: true },
    { x: 0.11, z: 0.72, turn: 0.16 },
    { x: -0.13, z: 0.69, turn: -0.19 },
    { x: 0.34, y: 0.3, z: 0.44, turn: 0.11, wall: true },
    { x: 0.63, z: 0.57, turn: 0.84 },
    { x: -0.81, z: 0.47, turn: -1.05 },
    { x: 0.1, y: 0.68, z: 0.46, turn: 0.03, wall: true },
    { x: 0.83, z: 0.44, turn: 1.08 },
    { x: -0.82, z: 0.19, turn: -1.34 },
    { x: 0.06, y: 0.42, z: 0.4, turn: 0.1, wall: true },
    { x: 0.76, z: 0.22, turn: 1.29 },
    { x: -0.81, z: -0.1, turn: -1.69 },
    { x: -0.24, y: 0.68, z: 0.45, turn: 0.09, wall: true },
    { x: 0.85, z: -0.01, turn: 1.59 },
    { x: -0.82, z: -0.38, turn: -2.01 },
    { x: -0.26, y: 0.42, z: 0.44, turn: -0.13, wall: true },
    { x: 0.14, z: -0.86, turn: 2.98 },
    { x: -0.33, z: -0.74, turn: -2.72 },
    { x: 0.47, y: 0.55, z: -0.15, turn: -0.82, wall: true },
    { x: 0.1, z: -0.62, turn: 2.98 },
    { x: 0.16, y: 1.28, z: -0.1 },
  ],
  transformations: {
    5: {
      name: "a second tank beside the first, joined by a pipe",
      parts: [
        { shape: "cyl", at: [0.66, 0.36, -0.36], size: [0.44, 0.72, 0.44], paint: "copper" },
        { shape: "cone", at: [0.66, 0.82, -0.36], size: [0.46, 0.2, 0.46], paint: "wood" },
        { shape: "cyl", at: [0.5, 0.56, -0.36], size: [0.1, 0.36, 0.1], paint: "brass", lie: true },
      ],
    },
    10: {
      name: "a chimney with a metal band",
      parts: [
        { shape: "cyl", at: [0.35, 0.75, -0.68], size: [0.2, 1.5, 0.2], paint: "brick" },
        { shape: "cyl", at: [0.35, 1.3, -0.68], size: [0.24, 0.08, 0.24], paint: "navy" },
        { shape: "cyl", at: [0.35, 1.52, -0.68], size: [0.24, 0.06, 0.24], paint: "navy" },
      ],
    },
    15: {
      name: "a stone floor under the whole works, with a drain",
      parts: [
        { shape: "cyl", at: [0, 0.025, 0], size: [1.8, 0.05, 1.8], paint: "stone", turn: Math.PI / 8 },
        { shape: "box", at: [0, 0.055, 0.7], size: [0.5, 0.02, 0.1], paint: "navy" },
      ],
    },
    20: {
      name: "a tall flare tower with a small flame at its top",
      parts: [
        { shape: "box", at: [-0.5, 1.0, -0.5], size: [0.12, 2.0, 0.12], paint: "navy" },
        { shape: "box", at: [-0.5, 1.0, -0.5], size: [0.26, 0.05, 0.26], paint: "brass" },
        { shape: "box", at: [-0.5, 1.6, -0.5], size: [0.26, 0.05, 0.26], paint: "brass" },
        { shape: "cone", at: [-0.5, 2.15, -0.5], size: [0.22, 0.32, 0.22], paint: "flame" },
      ],
    },
    25: {
      name: "brass pipes and lit gauges on the tanks",
      parts: [
        { shape: "cyl", at: [0.66, 0.2, -0.36], size: [0.48, 0.05, 0.48], paint: "brass" },
        { shape: "cyl", at: [0.66, 0.5, -0.36], size: [0.48, 0.05, 0.48], paint: "brass" },
        { shape: "cyl", at: [0.83, 0.4, -0.22], size: [0.06, 0.8, 0.06], paint: "brass" },
        { shape: "box", at: [0.66, 0.36, -0.12], size: [0.14, 0.14, 0.04], paint: "lamp" },
        { shape: "box", at: [0.49, 0.64, -0.19], size: [0.14, 0.14, 0.04], paint: "lamp", turn: -Math.PI / 4 },
        { shape: "box", at: [0.89, 0.6, -0.36], size: [0.04, 0.14, 0.14], paint: "lamp" },
      ],
    },
    30: {
      name: "a gantry over the tanks, with lamps along it",
      parts: [
        { shape: "box", at: [0.62, 0.65, -0.64], size: [0.08, 1.3, 0.08], paint: "navy" },
        { shape: "box", at: [0.62, 0.65, -0.06], size: [0.08, 1.3, 0.08], paint: "navy" },
        { shape: "box", at: [0.62, 1.3, -0.35], size: [0.1, 0.1, 0.7], paint: "brass" },
        { shape: "box", at: [0.31, 1.3, -0.35], size: [0.62, 0.08, 0.08], paint: "brass" },
        ...[-0.56, -0.35, -0.14].map((z): Part => ({ ...lamp(0, 0.13), at: [0.62, 1.16, z] })),
      ],
    },
  },
};

const ORDINALS = ["", "", "second", "third", "fourth"];
/** "an oil barrel", then "a second oil barrel", "a third oil barrel": the name of a kind's n-th copy, as in the plan. */
export function copyName(name: string, copy: number): string {
  if (copy <= 1) return name;
  const bare = name.replace(/^(a|an) /, "");
  return `a ${ORDINALS[copy] ?? "further"} ${bare}`;
}

/** The buildings that already change with every level. The others keep the three tiers of week 6 for now. */
export const GROWTH: Partial<Record<BuildingId, Growth>> = { refinery: REFINERY };

/**
 * What a building shows at a level, in the order it was added: each detail level adds the next kind at the next spot,
 * each transformation its piece. Pure: the same level always gives the same pieces.
 */
export function piecesAt(id: BuildingId, level: number): Piece[] {
  const g = GROWTH[id];
  if (!g) return [];
  const out: Piece[] = [];
  let k = 0;
  for (let l = 2; l <= Math.min(level, GROWTH_MAX); l++) {
    if (isTransformation(l)) {
      const t = g.transformations[l];
      out.push({ level: l, name: t.name, transformation: true, parts: t.parts });
      continue;
    }
    const kind = g.kinds[k % g.kinds.length]!;
    const spot = g.spots[k]!;
    const copy = Math.floor(k / g.kinds.length) + 1;
    const turn = spot.turn ?? 0;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    // The kind's shapes, turned with the spot, then set on it.
    const parts = kind.parts(copy).map((p) => ({
      ...p,
      at: [spot.x + p.at[0] * c + p.at[2] * s, (spot.y ?? 0) + p.at[1], spot.z - p.at[0] * s + p.at[2] * c] as const,
      turn: (p.turn ?? 0) + turn,
    }));
    out.push({ level: l, name: copyName(kind.name, copy), transformation: false, parts });
    k++;
  }
  return out;
}

/** The geometry of one shape, in its color, at its place (non-indexed, so every part merges with every other). */
export function partGeometry(p: Part): THREE.BufferGeometry {
  const [w, h, d] = p.size;
  const g =
    p.shape === "box"
      ? new THREE.BoxGeometry(w, h, d)
      : p.shape === "cyl"
        ? new THREE.CylinderGeometry(w / 2, w / 2, h, p.sides ?? 8, 1, p.open)
        : new THREE.ConeGeometry(w / 2, h, p.sides ?? 8, 1, p.open);
  if (p.shape !== "box" && d !== w) g.scale(1, 1, d / w);
  if (p.lie) g.rotateZ(Math.PI / 2);
  if (p.turn) g.rotateY(p.turn);
  g.translate(p.at[0], p.at[1], p.at[2]);
  const flat = g.toNonIndexed();
  g.dispose();
  flat.deleteAttribute("uv");
  const c = new THREE.Color(PAINT[p.paint]);
  const n = flat.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return flat;
}

/**
 * The pieces' shapes, in the solid ones and the glowing ones, at the building's `scale` (they grow with it, from its
 * plot's center) and moved by (x, z): null when there are none.
 */
export function piecesGeometry(pieces: readonly Piece[], x = 0, z = 0, scale = 1): { solid: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null } {
  const solid: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  for (const piece of pieces) for (const p of piece.parts) (GLOWING.has(p.paint) ? glow : solid).push(partGeometry(p).scale(scale, scale, scale).translate(x, 0, z));
  const merge = (list: THREE.BufferGeometry[]) => (list.length ? mergeGeometries(list) : null);
  return { solid: merge(solid), glow: merge(glow) };
}

/** Triangles of a list of pieces, as drawn. */
export const trianglesOf = (pieces: readonly Piece[]): number => {
  const { solid, glow } = piecesGeometry(pieces);
  return [solid, glow].reduce((n, g) => n + (g ? g.getAttribute("position").count / 3 : 0), 0);
};

/**
 * The growth of every building that has one, in two meshes: the solid shapes (lit, they cast and catch shadows) and the
 * glowing ones (drawn without light), each building's at its model's scale for its level. Rebuilt only when one of their
 * levels changes.
 */
export function createGrowth(positionOf: (id: BuildingId) => { x: number; z: number }, add: (o: THREE.Object3D) => void, scaleOf: (level: number) => number = () => 1) {
  const solid = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }));
  solid.name = "growth";
  solid.castShadow = true;
  solid.receiveShadow = true;
  const glow = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  glow.name = "growth-glow";
  for (const m of [solid, glow]) {
    m.visible = false;
    add(m);
  }
  let key = "";
  return {
    refresh(buildings: Buildings) {
      const ids = BUILDING_IDS.filter((id) => GROWTH[id]);
      const next = ids.map((id) => buildings[id]).join();
      if (next === key) return;
      key = next;
      const pieces = ids.map((id) => {
        const { x, z } = positionOf(id);
        return piecesGeometry(piecesAt(id, buildings[id]), x, z, scaleOf(buildings[id]));
      });
      for (const [mesh, which] of [
        [solid, "solid"],
        [glow, "glow"],
      ] as const) {
        const parts = pieces.map((p) => p[which]).filter((g): g is THREE.BufferGeometry => g !== null);
        mesh.geometry.dispose();
        mesh.geometry = parts.length ? mergeGeometries(parts) : new THREE.BufferGeometry();
        mesh.visible = parts.length > 0;
        parts.forEach((g) => g.dispose());
      }
    },
  };
}
