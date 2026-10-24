/**
 * Cities stored in an older shape are brought up to the current one, step by step, instead of being refused.
 * Pure: no system clock (the time of the last save is given), no randomness. Used by the server for the stored cities, and by the client for old local saves.
 */
import { startingDaily } from "../rules/daily.js";
import { startingLeviathan } from "../rules/leviathan.js";
import { startingProgress } from "../rules/objectives.js";
import { startingMist } from "../rules/mist.js";
import { DEFAULT_SERVER } from "../rules/servers.js";
import { emptyTroops } from "../rules/types.js";
import { parseState } from "./parse.js";
import type { PlayerState } from "./types.js";

/**
 * The current shape of a city. Shape 4: the city of week 4. Shape 5: week 5 (training, healing, veterans, shards).
 * Shape 6: week 7, the Mist (the city's clock, the order to stoke). Shape 7: week 7, the Leviathan (its level, the hunt).
 * Shape 8: week 7, the objectives and the daily tasks. Shape 9: week 7, the wrecks that wait before they fill again.
 * Shape 10: week 8, the city's server (its Mist and Leviathan hours). Shape 11: week 10, the Mist's objective moved
 * from the eleventh to the nineteenth (owner's decision, 23 October). Shape 12: week 10, the Wooded Isles and Fish
 * Shoals the fleets harvest.
 */
export const CITY_SHAPE = 12;
/** The oldest shape a stored city can have: nothing was stored before week 4. */
export const MIN_CITY_SHAPE = 4;

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * What each step adds to a city of shape `n` to make it shape `n + 1`. A step only adds a field that is missing:
 * it never changes a value, so running it again changes nothing.
 */
/** What a step may need beyond the city: `clock`, the time the city was last saved (seconds since 1970, UTC). */
export type MigrationContext = { clock: number };

const STEPS: Record<number, (s: Raw, ctx: MigrationContext) => Raw> = {
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
  // Week 7: the city's clock starts at its last save; the order to stoke the Lighthouse is on, as for a new city.
  5: (s, ctx) => {
    const out = { ...s };
    if (!("clock" in out)) out.clock = ctx.clock;
    if (!("mist" in out)) out.mist = startingMist();
    return out;
  },
  // Week 7: the Leviathan at level 1, never hunted.
  6: (s) => ("leviathan" in s ? s : { ...s, leviathan: startingLeviathan() }),
  // Week 7: the first objective, nothing counted yet, today's daily tasks on the city's clock (its last save before 7).
  7: (s, ctx) => {
    const out = { ...s };
    if (!("objective" in out)) out.objective = 0;
    if (!("progress" in out)) out.progress = startingProgress();
    if (!("daily" in out)) out.daily = startingDaily(typeof out.clock === "number" ? out.clock : ctx.clock, DEFAULT_SERVER);
    return out;
  },
  // Week 7: no wreck waits to fill again (until now, an emptied wreck filled again at once).
  8: (s) => (isObj(s.world) && !("refill" in s.world) ? { ...s, world: { ...s.world, refill: {} } } : s),
  // Week 8: every city stored before belongs to the only server, s1.
  9: (s) => ("server" in s ? s : { ...s, server: DEFAULT_SERVER }),
  // Week 10: the eleventh objective was the Mist's, now the nineteenth. A city past it has claimed it: never twice.
  // A city that had claimed all 18 has nothing left; the only step that changes a value, once.
  10: (s) => {
    if (typeof s.objective !== "number" || s.objective < 11 || "claimedAhead" in s) return s;
    return s.objective >= 18 ? { ...s, objective: 19 } : { ...s, claimedAhead: [18] };
  },
  // Week 10: no isle or shoal harvested yet: every one of them full.
  11: (s) => (isObj(s.world) && !("harvest" in s.world) ? { ...s, world: { ...s.world, harvest: {} } } : s),
};

/** Adds the fields of every step from `shape` to the current shape. Does not check the city: parseState does. */
export function upgradeShape(raw: Raw, shape: number, ctx: MigrationContext): Raw {
  let s = raw;
  for (let n = shape; n < CITY_SHAPE; n++) s = STEPS[n]?.(s, ctx) ?? s;
  return s;
}

/**
 * A stored city of shape `shape`, brought up to CITY_SHAPE and read with parseState. Null when it cannot be read:
 * a shape older than MIN_CITY_SHAPE or newer than this code knows (never brought down), or a city parseState
 * refuses once its missing fields are added. `ctx.clock` is the time of its last save, for the cities before the
 * Mist. Never throws.
 */
export function migrateCity(raw: unknown, shape: number, ctx: MigrationContext): PlayerState | null {
  if (!Number.isInteger(shape) || shape < MIN_CITY_SHAPE || shape > CITY_SHAPE || !isObj(raw)) return null;
  return parseState(upgradeShape(raw, shape, ctx));
}
