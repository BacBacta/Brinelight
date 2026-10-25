/**
 * The population (owner's decision, 24 October; docs/studies/population.md, step 1): survivors come with time while
 * the city has room in its Shelters and fish, faster at a higher Lighthouse and a higher morale; the fleets bring some
 * home. Each eats fish every hour (`economy.ts`). Out of fish, no one comes and the morale falls: no one ever dies or
 * leaves. Nothing here is for sale.
 *
 * It is applied on the clock's whole hours (`state.ts`), so a city is the same whatever the moments it is computed.
 */
import { survivorCap } from "./economy.js";
import { seaSite, type Fleet } from "./sea.js";
import { STARTING_MORALE } from "./start.js";
import type { Buildings } from "./types.js";

/** Survivors who come per real hour, at the morale of a fed city: ARRIVALS_BASE + ARRIVALS_PER_LEVEL × the Lighthouse's level. */
export const ARRIVALS_BASE = 0.1;
export const ARRIVALS_PER_LEVEL = 0.02;
/** The morale a fed city moves toward (a new city's), the one a city without fish moves toward, and how fast. */
export const MORALE_FED = STARTING_MORALE;
export const MORALE_HUNGRY = 40;
export const MORALE_PER_HOUR = 1;
/** What a Mist does to the morale when it lifts: held, it rises; not held, it falls. */
export const MORALE_MIST_HELD = 2;
export const MORALE_MIST_MISSED = 5;
/** Survivors a fleet brings home: from a wreck it salvaged, from a camp it beat. */
export const RESCUE_WRECK = 1;
export const RESCUE_CAMP = 2;

/** The room for survivors: the Shelters' (6 + 4 a level). */
export const survivorRoom = (buildings: Buildings): number => survivorCap(buildings.shelters);

/** Survivors who come per real hour, at this Lighthouse level and morale. */
export const arrivalsPerHour = (lighthouse: number, morale: number): number => (ARRIVALS_BASE + ARRIVALS_PER_LEVEL * lighthouse) * (morale / MORALE_FED);

/** The morale an hour later: a point toward MORALE_FED with fish, toward MORALE_HUNGRY without, never past it. */
export function moraleAfterHour(morale: number, fed: boolean): number {
  const target = fed ? MORALE_FED : MORALE_HUNGRY;
  return morale < target ? Math.min(target, morale + MORALE_PER_HOUR) : Math.max(target, morale - MORALE_PER_HOUR);
}

/** The morale once a Mist lifts, held or not, between 0 and 100. */
export const moraleAfterMist = (morale: number, held: boolean): number => Math.min(100, Math.max(0, morale + (held ? MORALE_MIST_HELD : -MORALE_MIST_MISSED)));

/** The survivors, the morale, and the survivors on their way (a fraction of one, until one comes). */
export type Population = { survivors: number; morale: number; coming: number };

/**
 * An hour of the population, at the clock's whole hour: the morale moves, then the hour's arrivals are added to those
 * on their way, and every whole one comes, within the room. Without fish, no one comes. With no room, no one waits on
 * the way. Never fewer survivors.
 */
export function populationHour(p: Population, ctx: { lighthouse: number; room: number; fed: boolean }): Population {
  const morale = moraleAfterHour(p.morale, ctx.fed);
  if (!ctx.fed) return { ...p, morale };
  const space = ctx.room - p.survivors;
  if (space <= 0) return { survivors: p.survivors, morale, coming: 0 };
  const coming = p.coming + arrivalsPerHour(ctx.lighthouse, morale);
  const come = Math.min(space, Math.floor(coming));
  return come === space ? { survivors: ctx.room, morale, coming: 0 } : { survivors: p.survivors + come, morale, coming: coming - come };
}

/** The survivors a fleet home brings: RESCUE_WRECK from a wreck it salvaged, RESCUE_CAMP from a camp it beat (its loot). */
export function rescuedBy(fleet: Fleet): number {
  const brought = Object.values(fleet.cargo).some((v) => (v ?? 0) > 0) || fleet.pearls > 0;
  if (!brought) return 0;
  const kind = seaSite(fleet.site)?.kind;
  if (fleet.kind === "collect" && kind === "wreck") return RESCUE_WRECK;
  if (fleet.kind === "attack" && kind === "camp") return RESCUE_CAMP;
  return 0;
}

/** The survivors once `rescued` more come home, within the room; never fewer than before. */
export const withRescued = (survivors: number, room: number, rescued: number): number => Math.max(survivors, Math.min(room, survivors + rescued));
