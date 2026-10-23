import type { CaptainId, CaptainState } from "./captains.js";
import type { Stock, Troops } from "./types.js";

/**
 * Starting values of a new city, taken from the prototype, except its stock.
 *
 * The richer start (owner's decision, 23 October; `docs/tasks/early-start.md`): enough for the Lighthouse's levels 3
 * to 5 and a few buildings. It was 380 oil, 420 fish and 520 wood. Only a new city gets it: a stored city keeps its own.
 */
export const STARTING_STOCK: Stock = { oil: 1400, fish: 800, wood: 2000, rope: 3 };
export const STARTING_TROOPS: Troops = { boarders: 25, harpooners: 25, crossbowmen: 25 };
export const STARTING_SURVIVORS = 8;
export const STARTING_MORALE = 84;
/** Pearls are earned by playing; they are not stored in the warehouses, so storage does not cap them. */
export const STARTING_PEARLS = 200;

/** A captain the player owns. */
export type OwnedCaptain = CaptainState;

/** Every new city starts with Old Tom, level 1, 1 star. */
export const STARTING_CAPTAIN: { id: CaptainId } & OwnedCaptain = { id: "tom", level: 1, xp: 0, stars: 1 };

/** The captain at the head of your fleets at the start: Old Tom. */
export const STARTING_LEAD: CaptainId = STARTING_CAPTAIN.id;
