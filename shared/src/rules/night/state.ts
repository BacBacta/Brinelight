/**
 * A Night's state (Hold the Light): everything needed to go on from here or to replay it, as plain data. The rules
 * change it by whole steps only (step.ts, task 1.3 onward); the client gives intentions (the beam's angle), never results.
 */
import { seedRng, type Rng } from "./random.js";
import { FAMILIES, NIGHTS, START_OIL, type Family } from "./values.js";

/** The shape of a Night's data: raised when it changes, so that an old save or replay is read knowingly. */
export const NIGHT_SHAPE = 1;

export type Enemy = {
  /** Whole, from 1, never reused in a Night. */
  id: number;
  family: Family;
  /** Where it comes from, in degrees: 0 is north, clockwise, [0, 360). */
  bearing: number;
  /** From the Lighthouse, in sea units. */
  distance: number;
  /** Above 0: at 0 it is gone. */
  health: number;
};

export type NightPhase = "wave" | "pause" | "won" | "lost";

export type NightState = {
  v: typeof NIGHT_SHAPE;
  /** Which Night: 1 to NIGHTS. */
  night: number;
  /** The seed it was started with: with the inputs, it is the whole Night. */
  seed: number;
  /** The generator's state now. */
  rng: Rng;
  /** Steps since the Night began. */
  step: number;
  oil: number;
  /** The wave under way or coming, from 1. */
  wave: number;
  phase: NightPhase;
  /** In a pause, the step it ends at; otherwise -1. */
  pauseEnd: number;
  /** Enemies the current wave has sent so far. */
  spawned: number;
  /** The step the current wave sends its next enemy at. */
  nextSpawn: number;
  enemies: Enemy[];
  nextId: number;
  /** Enemies burned by the beam in this Night. */
  burned: number;
  /** Where the beam points, in degrees, [0, 360). */
  beam: number;
};

const isUint32 = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) < 2 ** 32;
const isWhole = (x: unknown, min = 0): x is number => Number.isSafeInteger(x) && (x as number) >= min;
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isAngle = (x: unknown): x is number => isNum(x) && x >= 0 && x < 360;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const exactKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean => {
  const k = Object.keys(o);
  return k.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(o, key));
};

/** A Night about to begin. The seed is a whole 32-bit number; the Night, 1 to NIGHTS. */
export function newNight(seed: number, night: number): NightState {
  if (!isUint32(seed)) throw new RangeError(`A Night's seed is a whole 32-bit number, not ${seed}`);
  if (!Number.isInteger(night) || night < 1 || night > NIGHTS) throw new RangeError(`There is no Night ${night}`);
  return { v: NIGHT_SHAPE, night, seed, rng: seedRng(seed), step: 0, oil: START_OIL, wave: 1, phase: "wave", pauseEnd: -1, spawned: 0, nextSpawn: 0, enemies: [], nextId: 1, burned: 0, beam: 0 };
}

const ENEMY_KEYS = ["id", "family", "bearing", "distance", "health"] as const;
const NIGHT_KEYS = ["v", "night", "seed", "rng", "step", "oil", "wave", "phase", "pauseEnd", "spawned", "nextSpawn", "enemies", "nextId", "burned", "beam"] as const;
const PHASES: readonly string[] = ["wave", "pause", "won", "lost"];

function parseEnemy(raw: unknown): Enemy | null {
  if (!isObj(raw) || !exactKeys(raw, ENEMY_KEYS)) return null;
  const { id, family, bearing, distance, health } = raw;
  if (!isWhole(id, 1) || typeof family !== "string" || !(FAMILIES as readonly string[]).includes(family)) return null;
  if (!isAngle(bearing) || !isNum(distance) || distance < 0 || !isNum(health) || health <= 0) return null;
  return { id, family: family as Family, bearing, distance, health };
}

/** A Night read back from a save or a replay: exactly its fields, each in its range, or null. Never throws. */
export function parseNight(raw: unknown): NightState | null {
  try {
    if (!isObj(raw) || !exactKeys(raw, NIGHT_KEYS)) return null;
    const o = raw;
    if (o.v !== NIGHT_SHAPE || !Number.isInteger(o.night) || (o.night as number) < 1 || (o.night as number) > NIGHTS) return null;
    if (!isUint32(o.seed) || !isUint32(o.rng) || !isWhole(o.step) || !isNum(o.oil) || o.oil < 0 || !isWhole(o.wave, 1)) return null;
    if (typeof o.phase !== "string" || !PHASES.includes(o.phase) || !isWhole(o.pauseEnd, -1) || !isWhole(o.spawned) || !isWhole(o.nextSpawn)) return null;
    if (!isAngle(o.beam) || !isWhole(o.nextId, 1) || !isWhole(o.burned) || !Array.isArray(o.enemies)) return null;
    const enemies: Enemy[] = [];
    const ids = new Set<number>();
    for (const e of o.enemies) {
      const enemy = parseEnemy(e);
      if (!enemy || ids.has(enemy.id) || enemy.id >= (o.nextId as number)) return null;
      ids.add(enemy.id);
      enemies.push(enemy);
    }
    return {
      v: NIGHT_SHAPE,
      night: o.night as number,
      seed: o.seed,
      rng: o.rng,
      step: o.step,
      oil: o.oil,
      wave: o.wave,
      phase: o.phase as NightPhase,
      pauseEnd: o.pauseEnd,
      spawned: o.spawned,
      nextSpawn: o.nextSpawn,
      enemies,
      nextId: o.nextId,
      burned: o.burned,
      beam: o.beam,
    };
  } catch {
    return null;
  }
}
