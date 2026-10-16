import { advance, catchUp, type PlayerState } from "@brinelight/shared";

/** Live time: real seconds sped up by `speed` (DEV_SPEED in development). */
export const tick = (state: PlayerState, realSeconds: number, speed: number): PlayerState => advance(state, realSeconds * speed);

/** A gap between two frames longer than this (real seconds) means the tab was hidden: it counts as time away. */
export const AWAY_AFTER = 1;

/** Advances the city by the real time since the last frame: live time when short, time away when longer than AWAY_AFTER. */
export const elapse = (state: PlayerState, realSeconds: number, speed: number): PlayerState =>
  realSeconds > AWAY_AFTER ? catchUp(state, realSeconds) : tick(state, realSeconds, speed);
