/** The player's city and what changes it: pure, with no clock, no randomness and no DOM. */
import { STARTING_BUILDINGS, advanceQueue, startUpgrade } from "../rules/buildings.js";
import { advanceStock, netRates, storeCap } from "../rules/economy.js";
import { advanceResearch, startResearch, type TechId } from "../rules/research.js";
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
    research: null,
    lead: STARTING_LEAD,
    fleets: [],
    world: startingSeaWorld(),
    wounded: emptyTroops(),
    reports: [],
    reportSeq: 0,
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

/** Puts the sea back into the city. New reports get the next ids, in the order they arrive: no clock, no randomness. */
function withSea(s: PlayerState, sea: SeaState, reports: CombatReport[] = []): PlayerState {
  let seq = s.reportSeq;
  const added = reports.map((r) => ({ ...r, id: `r${++seq}`, read: false }));
  return {
    ...s,
    troops: sea.troops,
    stock: sea.stock,
    pearls: sea.pearls,
    wounded: sea.wounded,
    fleets: sea.fleets,
    world: sea.world,
    reports: added.length ? [...s.reports, ...added].slice(-MAX_REPORTS) : s.reports,
    reportSeq: seq,
  };
}

/**
 * Advances the city by `seconds` of game time. Time is cut at each finished upgrade, at the end of the research
 * and at each step of a fleet, so production, storage and fleets follow the new state from the exact moment it changes.
 */
export function advance(state: PlayerState, seconds: number): PlayerState {
  let s = state;
  let rest = seconds;
  while (rest > 0) {
    const ends = [...s.queue.map((j) => j.left), ...(s.research ? [s.research.left] : []), ...s.fleets.map((f) => f.left)];
    const next = Math.min(rest, ...ends.map((left) => Math.max(0, left)));
    s = produce(s, next);
    const q = advanceQueue(s.buildings, s.queue, next);
    const r = advanceResearch(s.techs, s.research, next);
    s = { ...s, buildings: q.buildings, queue: q.queue, techs: r.techs, research: r.research };
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

/**
 * Marks the report you read. A report that is gone (only the last ones are kept) or already read
 * changes nothing: it is not a mistake of the player.
 */
export function readReport(state: PlayerState, reportId: string): PlayerState {
  const i = state.reports.findIndex((r) => r.id === reportId && !r.read);
  if (i < 0) return state;
  return { ...state, reports: state.reports.map((r, j) => (j === i ? { ...r, read: true } : r)) };
}

export type UpgradeResult = ActionResult;

/** Starts an upgrade with the shared rule; a refusal comes with its reason. */
export function upgrade(state: PlayerState, id: BuildingId): UpgradeResult {
  const r = startUpgrade(id, state);
  return r.ok ? { ok: true, state: { ...state, stock: r.stock, queue: r.queue } } : r;
}

/** Starts the next level of a research at the Observatory with the shared rule; a refusal comes with its reason. */
export function research(state: PlayerState, id: TechId): ActionResult {
  const r = startResearch(id, { techs: state.techs, observatory: state.buildings.observatory, stock: state.stock, research: state.research });
  return r.ok ? { ok: true, state: { ...state, stock: r.stock, research: r.research } } : r;
}

/**
 * Time away: real seconds, never sped up, counted in full. Upgrades and fleets run the whole time;
 * production stops at storage (and a falling resource at 0). A negative time counts as none.
 * Used by the client on load and by the server.
 */
export const catchUp = (state: PlayerState, realSeconds: number): PlayerState => advance(state, Math.max(0, realSeconds));
