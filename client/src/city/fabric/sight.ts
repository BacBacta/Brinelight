/**
 * What the normal view sees of the city fabric, roughly, for its plan (owner, 21 October: each house and equipment at
 * least 70 % in sight, and nothing of the fabric over a building). The camera looks down the city from the front (+z)
 * at its angle (scene/framing.ts, CITY_ANGLE): a thing hides what stands behind it, as far up the screen as it rises.
 * Each thing is a box: its half width (x), half depth (z) and height. Rough on purpose; client/test/fabric.test.ts
 * checks the real share with the files the game serves.
 */
import { BUILDING_IDS, type BuildingId } from "@brinelight/shared";
import { hexX, hexZ } from "../../scene/island.js";
import { ERA_PLOTS } from "../eraPlots.js";
import { shownShape } from "../staged.js";

export type Box = { x: number; z: number; w: number; d: number; h: number };

/** Each model's half width, half depth and height, as made (assets/blender/fabric_models.py; a test reads them in the files). */
export const SIZES: Readonly<Record<string, readonly [number, number, number]>> = {
  tent: [0.15, 0.19, 0.2],
  hut: [0.18, 0.16, 0.29],
  wooden: [0.2, 0.17, 0.38],
  brick: [0.21, 0.18, 0.45],
  "lit-house": [0.21, 0.19, 0.46],
  "solar-house": [0.2, 0.17, 0.35],
  row: [0.5, 0.18, 0.46],
  workshop: [0.42, 0.22, 0.77],
  apartments: [0.26, 0.19, 0.7],
  well: [0.29, 0.16, 0.31],
  windmill: [0.37, 0.14, 0.99],
  chimneys: [0.41, 0.33, 0.82],
  "water-tower": [0.18, 0.19, 1.1],
  "solar-field": [0.28, 0.19, 0.12],
};

/** The camera's way up the screen: a point at height y and depth z shows at UP_Y·y − UP_Z·z (CITY_ANGLE, turned up). */
const UP_Y = 0.692;
const UP_Z = 0.722;
/** How much of a building's reach (its plot, scene/staged.ts) stands up and hides: its walls, not its yard. */
const BODY = 0.6;

/** A model's box at (x, z), at a size; a model not listed is too small to hide anything. */
export function boxOf(model: string, x: number, z: number, scale = 1): Box | null {
  const s = SIZES[model];
  if (!s) return null;
  // A turned house shows a little wider: its width and depth, whichever the larger.
  const w = Math.max(s[0], s[1]) * scale;
  return { x, z, w, d: s[1] * scale, h: s[2] * scale };
}

/** The buildings of a city as boxes, at their levels (or, `tallest`, at the tallest their models get). */
export function buildingBoxes(levels: Readonly<Record<BuildingId, number>>, tallest = false): Box[] {
  return BUILDING_IDS.filter((id) => tallest || levels[id] >= 1).map((id) => {
    const shape = tallest ? [1, 5, 10, 15, 20, 25, 30].map((l) => shownShape(id, l)).reduce((a, b) => (b.height > a.height ? b : a)) : shownShape(id, levels[id]);
    const [q, r] = ERA_PLOTS[id];
    return { x: hexX(q, r), z: hexZ(r), w: shape.reach * BODY, d: shape.reach * BODY, h: shape.height };
  });
}

const span = (b: Box): [number, number] => [-UP_Z * (b.z + b.d), UP_Y * b.h - UP_Z * (b.z - b.d)];
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** The share of `target` on screen that `by` hides: only a thing in front hides, as far as it rises on the screen. */
export function hiddenBy(target: Box, by: Box): number {
  if (by.z <= target.z) return 0;
  const across = overlap(target.x - target.w, target.x + target.w, by.x - by.w, by.x + by.w) / (2 * target.w);
  if (!across) return 0;
  const [t0, t1] = span(target);
  const [b0, b1] = span(by);
  return (across * overlap(t0, t1, b0, b1)) / (t1 - t0);
}

/** The most of a thing the plan lets others hide (the test asks 70 % in sight; the boxes are rough). */
export const MOST_HIDDEN = 0.2;

/**
 * The things in the view, as they are put: a new one goes in only if the others hide at most MOST_HIDDEN of it and it
 * hides at most that of each other (with what already hides it).
 */
export function createView(fixed: readonly Box[]) {
  const things: { box: Box; hidden: number; fixed: boolean }[] = fixed.map((box) => ({ box, hidden: 0, fixed: true }));
  for (const t of things) t.hidden = things.reduce((n, o) => n + (o === t ? 0 : hiddenBy(t.box, o.box)), 0);
  return {
    /** Whether `box` would stand in sight and leave the others in sight. */
    fits(box: Box): boolean {
      const own = things.reduce((n, o) => n + hiddenBy(box, o.box), 0);
      if (own > MOST_HIDDEN) return false;
      // The buildings were there first: what they hide of each other is theirs, the fabric must not add to it.
      return things.every((o) => {
        const more = hiddenBy(o.box, box);
        return !more || (o.fixed ? more <= MOST_HIDDEN / 2 : o.hidden + more <= MOST_HIDDEN);
      });
    },
    put(box: Box) {
      for (const o of things) o.hidden += hiddenBy(o.box, box);
      things.push({ box, hidden: things.reduce((n, o) => n + hiddenBy(box, o.box), 0), fixed: false });
    },
  };
}
