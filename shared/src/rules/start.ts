import type { CaptainId } from "./captains.js";
import { HOUR } from "./time.js";
import type { Stock, Troops } from "./types.js";

/** Starting values of a new city, taken from the prototype. */
export const STARTING_STOCK: Stock = { oil: 380, fish: 420, wood: 520, rope: 3 };
export const STARTING_TROOPS: Troops = { boarders: 25, harpooners: 25, crossbowmen: 25 };
export const STARTING_SURVIVORS = 8;
export const STARTING_MORALE = 84;

/** A captain the player owns. */
export type OwnedCaptain = { level: number; xp: number; stars: number };

/** Every new city starts with Old Tom, level 1, 1 star. */
export const STARTING_CAPTAIN: { id: CaptainId } & OwnedCaptain = { id: "tom", level: 1, xp: 0, stars: 1 };

/** Longest absence counted when the player comes back, in real seconds. */
export const OFFLINE_CAP = 8 * HOUR;
