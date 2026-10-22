/**
 * The Leviathan (week 7, task 3). It rises at sea at fixed hours, the same for every city of a server, read on the city's clock:
 * no randomness. You hunt it alone this week (the alliance's hunt comes with multiplayer): a fleet sails to it with
 * all your troops and veterans, stays until the hunt ends and deals its attack, as against a camp, every hour on
 * site. The Leviathan dives; it never sinks a fleet, so no troop is lost. Rewards are fixed and published, and
 * never anything for sale.
 */
import { dailyWindow, type MistWindow } from "./mist.js";
import { calendarOf, type ServerId } from "./servers.js";
import { HOUR } from "./time.js";

/** How long a hunt lasts, in real seconds, unless the Leviathan is killed sooner. */
export const HUNT_DURATION = 2 * HOUR;
/** The Leviathan's health at level 1, and how much each level multiplies it. */
export const LEVIATHAN_HEALTH = 4000;
export const LEVIATHAN_GROWTH = 1.5;
/** Pearls for taking part, and for the whole of its health: 10 + 90 × your share (the owner's decision; was 20 + 180). */
export const HUNT_PEARLS = 10;
export const HUNT_SHARE_PEARLS = 90;
/** Shards of the captain who led the hunt, when the Leviathan is killed. */
export const HUNT_SHARDS = 3;
/** Experience for the captain who led the hunt, killed or not. */
export const HUNT_XP = 30;
/** Its place on the sea map (`SEA_SITES`). */
export const LEVIATHAN_SITE = "leviathan";

/** The hunt at `clock` on a server: the one going on (`start` ≤ clock < `end`), or else the next one (servers.ts). */
export const huntAt = (clock: number, server: ServerId): MistWindow => dailyWindow(clock, calendarOf(server).huntHours, HUNT_DURATION);

/** The Leviathan's health at a level: 4,000, then ×1.5 a level. */
export const leviathanHealth = (level: number): number => Math.round(LEVIATHAN_HEALTH * LEVIATHAN_GROWTH ** (level - 1));

/**
 * The Leviathan as your city knows it: its level (one more after each kill), and the hunt your fleets took part in
 * (`hunt`, the time it started; 0 for none yet), the damage they dealt in it, and whether it is over for you
 * (killed, or the Leviathan dived and the rewards were given).
 */
export type LeviathanState = { level: number; hunt: number; damage: number; over: boolean };

export const startingLeviathan = (): LeviathanState => ({ level: 1, hunt: 0, damage: 0, over: false });

/** Your share of its health: the damage dealt, from 0 to 1. */
export const huntShare = (damage: number, level: number): number => Math.min(1, Math.max(0, damage / leviathanHealth(level)));

/** Pearls at the end of a hunt you took part in: 10 + 90 × your share, rounded. */
export const huntPearls = (share: number): number => Math.round(HUNT_PEARLS + HUNT_SHARE_PEARLS * Math.min(1, Math.max(0, share)));

/** Is the Leviathan at sea for your city: a hunt going on, and not yet killed or dived for you? */
export function leviathanUp(clock: number, server: ServerId, l: LeviathanState): boolean {
  const w = huntAt(clock, server);
  return w.on && !(l.hunt === w.start && l.over);
}
