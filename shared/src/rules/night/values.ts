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

/** The enemies' families. */
export const FAMILIES = ["raider", "beast", "wraith", "galleon"] as const;
export type Family = (typeof FAMILIES)[number];

export const FAMILY: Readonly<Record<Family, { speed: number; health: number; oil: number }>> = {
  /** Pirate skiffs: quick, straight to the coast. 8 s from the edge, half a second in the beam. */
  raider: { speed: 4, health: 60, oil: 5 },
  /** Beasts of the Mist: few, slow, tough; 11 s from the edge, 4 s in the beam. */
  beast: { speed: 2, health: 240, oil: 20 },
  /** Wraiths: they fade out of the beam (below); 8 s from the edge, 1.5 s in the beam, in strokes. */
  wraith: { speed: 3, health: 90, oil: 10 },
  /** The Mist Galleon, wave 10's boss: 24 s from the edge, 25 s in the beam alone. */
  galleon: { speed: 1, health: 1500, oil: 50 },
};

/** The wave a boss comes with, in the Nights that have it. */
export const BOSS_WAVE = 10;
/** Raiders the Galleon sends around it at two thirds of its health. */
export const BOSS_SUMMON = 3;
/** How much faster it comes at a third of its health. */
export const BOSS_RAGE = 1.6;

/** A Wraith lit this long (seconds, without a break) fades… */
export const WRAITH_FADE_AFTER = 0.6;
/** …for this long: the beam goes through it, and it comes on. */
export const WRAITH_HIDDEN = 1.5;

/** Which family each newcomer is, in Nights 1 to 5: Raiders only in Night 1, Beasts from Night 2, Wraiths from Night 4. */
export const NIGHT_MIX: readonly Readonly<Partial<Record<Family, number>>>[] = [
  { raider: 1, beast: 0, wraith: 0 },
  { raider: 0.8, beast: 0.2, wraith: 0 },
  { raider: 0.8, beast: 0.2, wraith: 0 },
  { raider: 0.6, beast: 0.2, wraith: 0.2 },
  { raider: 0.6, beast: 0.2, wraith: 0.2 },
];

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
/** How many Raiders come at once, each at its own bearing, in Nights 1 to 5: later Nights make the beam choose. */
export const SPAWN_BURST: readonly number[] = [1, 1, 2, 2, 3];
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

/** What an upgrade of the portal's city costs to reach its next level from level 1 (the Infirmary: to build it). */
export const UPGRADE_BASE = {
  // A lost Night 1 pays it even with no boat burned: its first two waves are always held (80 wood, 60 fish).
  lighthouse: { wood: 80, fish: 60 },
  refinery: { wood: 60, fish: 20 },
  infirmary: { wood: 120, fish: 80 },
} as const;
/** Each level costs this much more than the one before. */
export const UPGRADE_GROWTH = 1.6;

/** The Lighthouse's level: the beam burns this much harder for each level above 1. */
export const BEAM_PER_LEVEL = 0.15;
/** The Refinery's level: this much more oil to start a Night with, for each level above 1. */
export const OIL_PER_REFINERY = 15;
/** The Infirmary: once a Night, when the oil runs out, the Lighthouse lights again with this share of its oil… */
export const RESCUE_BASE = 0.3;
/** …and this much more for each level above 1. */
export const RESCUE_PER_LEVEL = 0.05;

/** The posts on the rafts: how many a city has before its Harbor (task 3.9), and what each one does. */
export const POSTS_BASE = 2;
/** A post's damage a second, to one enemy at a time (the nearest to the coast in its reach). */
export const POST_DPS = 20;
/** How far out a post reaches, from the Lighthouse, in sea units… */
export const POST_RANGE = 16;
/** …and how wide, in degrees around its own bearing. */
export const POST_ARC = 60;

/** The lead captain's power, the flare: it lights the whole sea this long (seconds)… */
export const FLARE_SECONDS = 2;
/** …burning every enemy at this share of the beam's strength… */
export const FLARE_SHARE = 0.5;
/** …then waits this long to be fired again. */
export const FLARE_COOLDOWN = 20;
