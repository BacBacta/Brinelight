/** The player's city and what changes it: pure, with no clock, no randomness and no DOM. */
import { STARTING_BUILDINGS, advanceQueue, startUpgrade } from "../rules/buildings.js";
import { canSetLead, starWithShards, unlockWithShards, useLogbook, type CaptainId } from "../rules/captains.js";
import { advanceStock, netRates, storeCap } from "../rules/economy.js";
import { advanceHealing, startHealing } from "../rules/healing.js";
import { advanceYard, startInstall, startRaft, startRaftUpgrade, type RaftBuildingId } from "../rules/rafts.js";
import { advanceResearch, startResearch, type TechId } from "../rules/research.js";
import { advanceFleets, leadOf, sendFleet, startingSeaWorld, type CombatReport, type SeaState } from "../rules/sea.js";
import { STARTING_CAPTAIN, STARTING_LEAD, STARTING_MORALE, STARTING_PEARLS, STARTING_STOCK, STARTING_SURVIVORS, STARTING_TROOPS } from "../rules/start.js";
import { advanceTraining, startPromotion, startTraining } from "../rules/training.js";
import { emptyTroops, type BuildingId, type TroopType } from "../rules/types.js";
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
    veterans: emptyTroops(),
    techs: {},
    rafts: {},
    captains: { [id]: captain },
    shards: {},
    survivors: STARTING_SURVIVORS,
    morale: STARTING_MORALE,
    pearls: STARTING_PEARLS,
    queue: [],
    research: null,
    yard: null,
    training: null,
    healing: null,
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
  veterans: s.veterans,
  stock: s.stock,
  pearls: s.pearls,
  wounded: s.wounded,
  techs: s.techs,
  rafts: s.rafts,
  lead: leadOf(s.lead, s.captains),
  captains: s.captains,
  shards: s.shards,
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
    veterans: sea.veterans,
    stock: sea.stock,
    pearls: sea.pearls,
    wounded: sea.wounded,
    captains: sea.captains,
    shards: sea.shards,
    fleets: sea.fleets,
    world: sea.world,
    reports: added.length ? [...s.reports, ...added].slice(-MAX_REPORTS) : s.reports,
    reportSeq: seq,
  };
}

/**
 * Advances the city by `seconds` of game time. Time is cut at each finished upgrade, at the end of the research,
 * at the end of the shipyard's work, at the end of a training or a healing, and at each step of a fleet, so production, storage and fleets follow the new state from the exact moment it changes.
 */
export function advance(state: PlayerState, seconds: number): PlayerState {
  let s = state;
  let rest = seconds;
  while (rest > 0) {
    const ends = [...s.queue.map((j) => j.left), ...(s.research ? [s.research.left] : []), ...(s.yard ? [s.yard.left] : []), ...(s.training ? [s.training.left] : []), ...(s.healing ? [s.healing.left] : []), ...s.fleets.map((f) => f.left)];
    const next = Math.min(rest, ...ends.map((left) => Math.max(0, left)));
    s = produce(s, next);
    const q = advanceQueue(s.buildings, s.queue, next);
    const r = advanceResearch(s.techs, s.research, next);
    const y = advanceYard(s.rafts, s.yard, next);
    // The new and the healed soldiers join the troops in the city before the fleets move: a fleet at sea never gets them.
    const t = advanceTraining(s, s.training, next);
    const hl = advanceHealing(t.troops, s.healing, next);
    s = { ...s, buildings: q.buildings, queue: q.queue, techs: r.techs, research: r.research, rafts: y.rafts, yard: y.yard, troops: hl.troops, veterans: t.veterans, training: t.training, healing: hl.healing };
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

/** Starts a new raft on a slot around the island with the shared rule; a refusal comes with its reason. */
export function dockRaft(state: PlayerState, slot: string): ActionResult {
  const r = startRaft(slot, { rafts: state.rafts, lighthouse: state.buildings.lighthouse, stock: state.stock, yard: state.yard });
  return r.ok ? { ok: true, state: { ...state, stock: r.stock, yard: r.yard } } : r;
}

/** Puts an owned captain at the head of your fleets; fleets at sea keep the one they left with. */
export function setLead(state: PlayerState, id: CaptainId): ActionResult {
  const check = canSetLead(id, state.captains);
  if (!check.ok) return check;
  return { ok: true, state: state.lead === id ? state : { ...state, lead: id } };
}

/** A Logbook for your lead captain with the shared rule; a refusal comes with its reason. */
export function logbook(state: PlayerState): ActionResult {
  const r = useLogbook({ lead: state.lead, captains: state.captains, pearls: state.pearls });
  return r.ok ? { ok: true, state: { ...state, captains: r.captains, pearls: r.pearls } } : r;
}

/** Unlocks a captain with shards, with the shared rule; a refusal comes with its reason. */
export function unlockCaptain(state: PlayerState, id: CaptainId): ActionResult {
  const r = unlockWithShards(id, { captains: state.captains, shards: state.shards });
  return r.ok ? { ok: true, state: { ...state, captains: r.captains, shards: r.shards } } : r;
}

/** Adds a star to a captain with shards, with the shared rule; a refusal comes with its reason. */
export function addStar(state: PlayerState, id: CaptainId): ActionResult {
  const r = starWithShards(id, { captains: state.captains, shards: state.shards });
  return r.ok ? { ok: true, state: { ...state, captains: r.captains, shards: r.shards } } : r;
}

/** Puts a building on the free raft of a slot with the shared rule; a refusal comes with its reason. */
export function installOnRaft(state: PlayerState, slot: string, building: RaftBuildingId): ActionResult {
  const r = startInstall(building, { rafts: state.rafts, slot, stock: state.stock, yard: state.yard });
  return r.ok ? { ok: true, state: { ...state, stock: r.stock, yard: r.yard } } : r;
}

/** Takes the building on the raft of a slot one level up with the shared rule; a refusal comes with its reason. */
export function upgradeRaft(state: PlayerState, slot: string): ActionResult {
  const r = startRaftUpgrade({ rafts: state.rafts, slot, stock: state.stock, yard: state.yard });
  return r.ok ? { ok: true, state: { ...state, stock: r.stock, yard: r.yard } } : r;
}

/** Starts a batch of soldiers at the Barracks with the shared rule; a refusal comes with its reason. */
export function train(state: PlayerState, troop: TroopType): ActionResult {
  const r = startTraining(troop, { barracks: state.buildings.barracks, stock: state.stock, training: state.training });
  return r.ok ? { ok: true, state: { ...state, stock: r.stock, training: r.training } } : r;
}

/** Promotes 10 soldiers of one type to veterans at the Barracks with the shared rule; a refusal comes with its reason. */
export function promote(state: PlayerState, troop: TroopType): ActionResult {
  const r = startPromotion(troop, { barracks: state.buildings.barracks, techs: state.techs, troops: state.troops, stock: state.stock, training: state.training });
  return r.ok ? { ok: true, state: { ...state, stock: r.stock, troops: r.troops, training: r.training } } : r;
}

/** Starts healing every wounded in the Infirmary with the shared rule; a refusal comes with its reason. */
export function heal(state: PlayerState): ActionResult {
  const r = startHealing({ infirmary: state.buildings.infirmary, wounded: state.wounded, stock: state.stock, healing: state.healing });
  return r.ok ? { ok: true, state: { ...state, stock: r.stock, wounded: r.wounded, healing: r.healing } } : r;
}

/**
 * Time away: real seconds, never sped up, counted in full. Upgrades and fleets run the whole time;
 * production stops at storage (and a falling resource at 0). A negative time counts as none.
 * Used by the client on load and by the server.
 */
export const catchUp = (state: PlayerState, realSeconds: number): PlayerState => advance(state, Math.max(0, realSeconds));
