/**
 * Every number of the portal edition's Night (Hold the Light, docs/design/hold-the-light.md). Starting values, to be
 * tuned at gates A and B with real players; none is balance yet. Nothing here is a value of the Brinelight on Solana.
 * Times are in real seconds, the Night's own clock counted in steps of 1/30 s; distances are in sea units, the
 * Lighthouse at 0.
 */

/** Steps in a real second: the Night advances by 1/30 s, whatever the screen's rate. */
export const STEPS_PER_SECOND = 30;
/** A step, in real seconds. */
export const STEP = 1 / STEPS_PER_SECOND;

/** Where the enemies come from: the edge of the sea you can see. */
export const SEA_RADIUS = 30;
/** The coast: an enemy that reaches it steals its oil and is gone. */
export const COAST_RADIUS = 6;

/** The oil a Night starts with: the Lighthouse's life. */
export const START_OIL = 100;

/** The beam's width, in degrees (half on each side of where it points). */
export const BEAM_WIDTH = 40;
/** The damage the beam does in a second to each enemy it lights. */
export const BEAM_DPS = 60;

/** The enemies' families. Raiders first; Beasts and Wraiths come with step 3 of the plan. */
export const FAMILIES = ["raider"] as const;
export type Family = (typeof FAMILIES)[number];

export const FAMILY: Readonly<Record<Family, { speed: number; health: number; oil: number }>> = {
  /** Pirate skiffs: quick, straight to the coast. 8 s from the edge, half a second in the beam. */
  raider: { speed: 3, health: 30, oil: 5 },
};

/** The Nights there are: Nights 1 to 5 first (step 4), then the chart (step 5). */
export const NIGHTS = 5;
