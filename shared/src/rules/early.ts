/**
 * The early start's caps on the works A does not cap (owner's decision, 23 October; `docs/tasks/early-start.md`): for
 * every city, and only while the Lighthouse is below level 6. Real seconds. Never a reward, never for sale.
 */

/** The caps hold while the Lighthouse is below this level. */
export const EARLY_BELOW = 6;
/** The city's first raft. */
export const EARLY_RAFT = 5 * 60;
/** A raft building's first level, put on a raft. */
export const EARLY_INSTALL = 5 * 60;
/** A batch of soldiers at the Barracks. */
export const EARLY_TRAINING = 5 * 60;
/** A fleet's way out to a pirate camp (its way back, the wrecks and the Leviathan keep their trips). */
export const EARLY_CAMP_TRIP = 10 * 60;

export const isEarly = (lighthouse: number): boolean => lighthouse < EARLY_BELOW;

/** A time capped while the Lighthouse is below level 6. */
export const earlyCapped = (seconds: number, cap: number, lighthouse: number): number => (isEarly(lighthouse) ? Math.min(seconds, cap) : seconds);
