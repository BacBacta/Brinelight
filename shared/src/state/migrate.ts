/**
 * Cities stored in an older shape are brought up to the current one, step by step, instead of being refused.
 * Pure: no clock, no randomness. Used by the server for the stored cities, and by the client for old local saves.
 */
import { emptyTroops } from "../rules/types.js";
import { parseState } from "./parse.js";
import type { PlayerState } from "./types.js";

/** The current shape of a city. Shape 4: the city of week 4. Shape 5: week 5 (training, healing, veterans, shards). */
export const CITY_SHAPE = 5;
/** The oldest shape a stored city can have: nothing was stored before week 4. */
export const MIN_CITY_SHAPE = 4;

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * What each step adds to a city of shape `n` to make it shape `n + 1`. A step only adds a field that is missing:
 * it never changes a value, so running it again changes nothing.
 */
const STEPS: Record<number, (s: Raw) => Raw> = {
  // Week 5: no training or healing in progress, no veteran in the city or at sea, no shard.
  4: (s) => {
    const out = { ...s };
    if (!("training" in out)) out.training = null;
    if (!("healing" in out)) out.healing = null;
    if (!("veterans" in out)) out.veterans = emptyTroops();
    if (!("shards" in out)) out.shards = {};
    if (Array.isArray(out.fleets)) {
      const fleets: unknown[] = out.fleets;
      out.fleets = fleets.map((f) => (isObj(f) && !("veterans" in f) ? { ...f, veterans: emptyTroops() } : f));
    }
    return out;
  },
};

/** Adds the fields of every step from `shape` to the current shape. Does not check the city: parseState does. */
export function upgradeShape(raw: Raw, shape: number): Raw {
  let s = raw;
  for (let n = shape; n < CITY_SHAPE; n++) s = STEPS[n]?.(s) ?? s;
  return s;
}

/**
 * A stored city of shape `shape`, brought up to CITY_SHAPE and read with parseState. Null when it cannot be read:
 * a shape older than MIN_CITY_SHAPE or newer than this code knows (never brought down), or a city parseState
 * refuses once its missing fields are added. Never throws.
 */
export function migrateCity(raw: unknown, shape: number): PlayerState | null {
  if (!Number.isInteger(shape) || shape < MIN_CITY_SHAPE || shape > CITY_SHAPE || !isObj(raw)) return null;
  return parseState(upgradeShape(raw, shape));
}
