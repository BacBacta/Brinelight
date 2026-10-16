/** The player's city and what changes it: pure, with no clock, no randomness and no DOM. */
import { STARTING_BUILDINGS, advanceQueue, startUpgrade } from "../rules/buildings.js";
import { advanceStock, netRates, storeCap } from "../rules/economy.js";
import { advanceFleets, leadOf, sendFleet, startingSeaWorld, type CombatReport, type SeaState } from "../rules/sea.js";
import { STARTING_CAPTAIN, STARTING_LEAD, STARTING_MORALE, STARTING_PEARLS, STARTING_STOCK, STARTING_SURVIVORS, STARTING_TROOPS } from "../rules/start.js";
import { emptyTroops, type BuildingId } from "../rules/types.js";
import type { PlayerState } from "./types.js";

/** Reports kept in the city; older ones are dropped. */
export const MAX_REPORTS = 20;

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
    lead: STARTING_LEAD,
    fleets: [],
    world: startingSeaWorld(),
    wounded: emptyTroops(),
    reports: [],
  };
}

/** Production at constant levels, with the shared rules (calm weather). */
function produce(state: PlayerState, seconds: number): PlayerState {
  const cap = storeCap(state.buildings.lighthouse, state.techs);
  return { ...state, stock: advanceStock(state.stock, netRates(state), seconds, cap) };
}

/** The part of the city the sea rules read and change. */
const seaState = (s: PlayerState): SeaState => ({
  buildings: s.buildings,
  troops: s.troops,
  stock: s.stock,
  pearls: s.pearls,
  wounded: s.wounded,
  techs: s.techs,
  rafts: s.rafts,
  lead: leadOf(s.lead, s.captains),
  fleets: s.fleets,
  world: s.world,
});

const withSea = (s: PlayerState, sea: SeaState, reports: CombatReport[] = []): PlayerState => ({
  ...s,
  troops: sea.troops,
  stock: sea.stock,
  pearls: sea.pearls,
  wounded: sea.wounded,
  fleets: sea.fleets,
  world: sea.world,
  reports: reports.length ? [...s.reports, ...reports.map((r) => ({ ...r, read: false }))].slice(-MAX_REPORTS) : s.reports,
});

/**
 * Advances the city by `seconds` of game time. Time is cut at each finished upgrade and at each step
 * of a fleet, so production, storage and fleets follow the new state from the exact moment it changes.
 */
export function advance(state: PlayerState, seconds: number): PlayerState {
  let s = state;
  let rest = seconds;
  while (rest > 0) {
    const next = Math.min(rest, ...s.queue.map((j) => Math.max(0, j.left)), ...s.fleets.map((f) => Math.max(0, f.left)));
    s = produce(s, next);
    const q = advanceQueue(s.buildings, s.queue, next);
    s = { ...s, buildings: q.buildings, queue: q.queue };
    const f = advanceFleets(seaState(s), next);
    s = withSea(s, f.state, f.reports);
    rest -= next;
  }
  return s;
}

export type ActionResult = { ok: true; state: PlayerState } | { ok: false; reason: string };

/** Sends a fleet with the shared rule; a refusal comes with its reason. */
export function sail(state: PlayerState, siteId: string): ActionResult {
  const r = sendFleet(siteId, seaState(state));
  return r.ok ? { ok: true, state: withSea(state, r.state) } : r;
}

/** Marks the oldest unread report as read. */
export function readReport(state: PlayerState): PlayerState {
  const i = state.reports.findIndex((r) => !r.read);
  if (i < 0) return state;
  return { ...state, reports: state.reports.map((r, j) => (j === i ? { ...r, read: true } : r)) };
}

export type UpgradeResult = ActionResult;

/** Starts an upgrade with the shared rule; a refusal comes with its reason. */
export function upgrade(state: PlayerState, id: BuildingId): UpgradeResult {
  const r = startUpgrade(id, state);
  return r.ok ? { ok: true, state: { ...state, stock: r.stock, queue: r.queue } } : r;
}

/**
 * Time away: real seconds, never sped up, counted in full. Upgrades and fleets run the whole time;
 * production stops at storage (and a falling resource at 0). A negative time counts as none.
 * Used by the client on load and by the server.
 */
export const catchUp = (state: PlayerState, realSeconds: number): PlayerState => advance(state, Math.max(0, realSeconds));
