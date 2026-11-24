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

/** The waves of each Night, from Night 1: Night 1 is short (about 3 minutes). */
export const NIGHT_WAVES: readonly number[] = [5, 8, 9, 10, 12];
/** A wave's Raiders: 4 in Night 1's first wave, 2 more each wave, 2 more each Night. */
export const WAVE_FIRST = 4;
export const WAVE_GROWTH = 2;
export const NIGHT_GROWTH = 2;
/** Between two enemies of a wave, in seconds. */
export const SPAWN_SPACING = 1.5;
/** The pause after a wave, in seconds: the cards will be chosen in it (step 3). */
export const WAVE_PAUSE = 6;
/** Night 1's first waves cannot put the Lighthouse out: a new player learns the beam before they can lose. */
export const NIGHT1_GRACE_WAVES = 2;

/** What a Night brings back at dawn, won or lost. */
export const LOOT_PER_WAVE = { wood: 40, fish: 30 } as const;
export const LOOT_PER_BURNED = { wood: 2 } as const;
export const LOOT_DAWN_PEARLS = 10;
/** A lost Night still pays at least this, so the next one starts a little stronger. */
export const LOOT_FLOOR = { wood: 60 } as const;

/** The most steps a frame may run: a slow frame slows the Night rather than jumping it ahead. */
export const MAX_STEPS_PER_FEED = 8;
