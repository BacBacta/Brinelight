/**
 * Time scale.
 *
 * The prototype ran in "prototype seconds". The real game converts them:
 * 1 prototype second = 6 real minutes (TIME_SCALE = 360).
 * All rule durations are expressed in REAL seconds, and all rates PER real HOUR.
 * For development, the server can apply a speedup factor (DEV_SPEED) without touching the rules.
 */
export const TIME_SCALE = 360;

/** Converts a prototype duration (s) to real seconds. */
export const protoSeconds = (s: number): number => s * TIME_SCALE;

/** Converts a prototype rate (per second) to a rate per real hour. */
export const protoRatePerHour = (perProtoSecond: number): number => (perProtoSecond * 3600) / TIME_SCALE;

export const HOUR = 3600;
export const DAY = 24 * HOUR;
