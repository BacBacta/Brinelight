import {
  OFFLINE_CAP,
  STARTING_BUILDINGS,
  STARTING_CAPTAIN,
  STARTING_MORALE,
  STARTING_PEARLS,
  STARTING_STOCK,
  STARTING_SURVIVORS,
  STARTING_TROOPS,
  advanceQueue,
  advanceStock,
  netRates,
  startUpgrade,
  storeCap,
  type BuildingId,
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
    pearls: STARTING_PEARLS,
    queue: [],
  };
}

/** Production at constant levels, with the shared rules (calm weather). */
function produce(state: PlayerState, seconds: number): PlayerState {
  const cap = storeCap(state.buildings.lighthouse, state.techs);
  return { ...state, stock: advanceStock(state.stock, netRates(state), seconds, cap) };
}

/**
 * Advances the city by `seconds` of game time. Time is cut at each finished upgrade,
 * so production and storage follow the new levels from the exact moment they are reached.
 */
export function advance(state: PlayerState, seconds: number): PlayerState {
  let s = state;
  let rest = seconds;
  while (rest > 0) {
    const next = Math.min(rest, ...s.queue.map((j) => Math.max(0, j.left)));
    s = produce(s, next);
    const q = advanceQueue(s.buildings, s.queue, next);
    s = { ...s, buildings: q.buildings, queue: q.queue };
    rest -= next;
  }
  return s;
}

export type UpgradeResult = { ok: true; state: PlayerState } | { ok: false; reason: string };

/** Starts an upgrade with the shared rule; a refusal comes with its reason. */
export function upgrade(state: PlayerState, id: BuildingId): UpgradeResult {
  const r = startUpgrade(id, state);
  return r.ok ? { ok: true, state: { ...state, stock: r.stock, queue: r.queue } } : r;
}

/** Live time: real seconds sped up by `speed` (DEV_SPEED in development). */
export const tick = (state: PlayerState, realSeconds: number, speed: number): PlayerState => advance(state, realSeconds * speed);

/** Time away: real seconds, never sped up, counted up to OFFLINE_CAP. */
export const catchUp = (state: PlayerState, realSeconds: number): PlayerState =>
  advance(state, Math.min(Math.max(0, realSeconds), OFFLINE_CAP));

/** A gap between two frames longer than this (real seconds) means the tab was hidden: it counts as time away. */
export const AWAY_AFTER = 1;

/** Advances the city by the real time since the last frame: live time when short, time away when longer than AWAY_AFTER. */
export const elapse = (state: PlayerState, realSeconds: number, speed: number): PlayerState =>
  realSeconds > AWAY_AFTER ? catchUp(state, realSeconds) : tick(state, realSeconds, speed);
