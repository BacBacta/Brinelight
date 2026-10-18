/**
 * The Mist (week 7, task 1). It comes at fixed hours, the same for every city, read on the city's clock: no
 * randomness. While it is on, it hides the sea beyond the Lighthouse's light and slows the city unless the
 * Lighthouse is stoked; a Mist the Lighthouse held to its end gives Pearls, one it did not damages the rafts.
 * Stoking is an order that stays (on for a new city): the Mist punishes a lack of oil, never an absence.
 */
import { HOUR } from "./time.js";

/**
 * The hours a Mist starts, in UTC. Provisional: they become hours per server with multiplayer (docs/decisions.md).
 */
export const MIST_HOURS_UTC = [4, 12, 20] as const;
/** How long a Mist lasts, in real seconds. */
export const MIST_DURATION = 2 * HOUR;
/** How long before a Mist the city is warned, in real seconds. */
export const MIST_WARNING = HOUR;
/** Pearls for a Mist the Lighthouse held to its end. */
export const MIST_HELD_PEARLS = 30;

/** The Lighthouse's light, in map units from your city: its base, what each level adds, what stoking adds. */
export const LIGHT_BASE = 15;
export const LIGHT_PER_LEVEL = 2;
export const LIGHT_STOKED = 10;

const DAY = 24 * HOUR;

/** A Mist: on now (`start` ≤ clock < `end`), or the next one. Times are on the city's clock, in seconds (UTC). */
export type MistWindow = { on: boolean; start: number; end: number };

/**
 * A daily event at `clock`, starting at the same `hours` (UTC) every day and lasting `duration`: the one going on, or
 * else the next one. The Mist's calendar, and the Leviathan's.
 */
export function dailyWindow(clock: number, hours: readonly number[], duration: number): MistWindow {
  const day = Math.floor(clock / DAY) * DAY;
  let next: MistWindow | null = null;
  // Yesterday's last one may still be on after midnight; tomorrow's first may be the next one.
  for (const d of [day - DAY, day, day + DAY]) {
    for (const h of hours) {
      const start = d + h * HOUR;
      const end = start + duration;
      if (start <= clock && clock < end) return { on: true, start, end };
      if (start > clock && (!next || start < next.start)) next = { on: false, start, end };
    }
  }
  return next!;
}

/** The Mist at `clock`: the one going on, or else the next one. */
export const mistAt = (clock: number): MistWindow => dailyWindow(clock, MIST_HOURS_UTC, MIST_DURATION);

/** Seconds from `clock` to the next time the Mist starts or lifts: always more than 0. */
export function untilMistChange(clock: number): number {
  const w = mistAt(clock);
  return (w.on ? w.end : w.start) - clock;
}

/** Is the city warned of a coming Mist? From MIST_WARNING before it starts, until it does. */
export function mistWarned(clock: number): boolean {
  const w = mistAt(clock);
  return !w.on && w.start - clock <= MIST_WARNING;
}

/** How far the Lighthouse's light reaches into the Mist, in map units from your city. */
export function lightReach(lighthouse: number, stoked: boolean): number {
  return LIGHT_BASE + LIGHT_PER_LEVEL * lighthouse + (stoked ? LIGHT_STOKED : 0);
}

/**
 * What the city knows of the Mist. `stoke`: the order to stoke the Lighthouse in the Mist, which stays until you
 * change it. `dark`: the Lighthouse went dark during the Mist going on (not stoked at its start, the order turned
 * off, or out of oil); it stays dark until the Mist lifts, and that Mist is not held. `held` and `missed`: the Mists
 * held and not held so far. `damaged`: the rafts the last Mist not held damaged.
 */
export type MistState = { stoke: boolean; dark: boolean; held: number; missed: number; damaged: number };

/** A new city: the order to stoke is on. */
export const startingMist = (): MistState => ({ stoke: true, dark: false, held: 0, missed: 0, damaged: 0 });

/** Is the Lighthouse stoked right now? Only during a Mist, with the order on, while it has not gone dark. */
export const isLit = (clock: number, mist: MistState): boolean => mistAt(clock).on && mist.stoke && !mist.dark;

/** The sea a fleet can reach right now: everywhere in calm weather, the Lighthouse's light in the Mist. */
export function seaReach(clock: number, lighthouse: number, mist: MistState): number {
  return mistAt(clock).on ? lightReach(lighthouse, isLit(clock, mist)) : Infinity;
}
