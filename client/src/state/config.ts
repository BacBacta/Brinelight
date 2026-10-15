/**
 * Client configuration. DEV_SPEED speeds up live time in development only;
 * the rules in shared never know about it, and time away is never sped up.
 */
export const DEV_SPEED = import.meta.env.DEV ? 60 : 1;

/** How often the city is saved while playing, in real milliseconds. */
export const SAVE_EVERY_MS = 5000;
