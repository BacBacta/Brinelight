import {
  OFFLINE_CAP,
  STARTING_BUILDINGS,
  STARTING_CAPTAIN,
  STARTING_MORALE,
  STARTING_STOCK,
  STARTING_SURVIVORS,
  STARTING_TROOPS,
  advanceStock,
  netRates,
  storeCap,
} from "@brinelight/shared";
import type { PlayerState } from "./types.js";

/** A new city, built only from the starting values of the shared rules. */
export function newPlayerState(): PlayerState {
  const { id, ...captain } = STARTING_CAPTAIN;
  return {
    buildings: { ...STARTING_BUILDINGS },
    stock: { ...STARTING_STOCK },
    troops: { ...STARTING_TROOPS },
    techs: {},
    rafts: {},
    captains: { [id]: captain },
    survivors: STARTING_SURVIVORS,
    morale: STARTING_MORALE,
  };
}

/** Advances production by `seconds` of game time, with the shared rules (calm weather). */
export function advance(state: PlayerState, seconds: number): PlayerState {
  if (seconds <= 0) return state;
  const rates = netRates(state);
  const cap = storeCap(state.buildings.lighthouse, state.techs);
  return { ...state, stock: advanceStock(state.stock, rates, seconds, cap) };
}

/** Live time: real seconds sped up by `speed` (DEV_SPEED in development). */
export const tick = (state: PlayerState, realSeconds: number, speed: number): PlayerState => advance(state, realSeconds * speed);

/** Time away: real seconds, never sped up, counted up to OFFLINE_CAP. */
export const catchUp = (state: PlayerState, realSeconds: number): PlayerState =>
  advance(state, Math.min(Math.max(0, realSeconds), OFFLINE_CAP));
