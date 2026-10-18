/** The player's city and what changes it: pure, with no system clock, no randomness and no DOM (the city keeps its own clock). */
import { STARTING_BUILDINGS, advanceQueue, startUpgrade } from "../rules/buildings.js";
import { canSetLead, starWithShards, unlockWithShards, useLogbook, type CaptainId } from "../rules/captains.js";
import { advanceStock, netRates, storeCap, type Weather } from "../rules/economy.js";
import { CHESTS, canOpenChest, chestReward, countDaily, dailyOn, dayOf, startingDaily, untilMidnight, type Chest, type DailyTaskId } from "../rules/daily.js";
import { advanceHealing, startHealing } from "../rules/healing.js";
import { startingLeviathan } from "../rules/leviathan.js";
import { OBJECTIVES, startingProgress, type Reward } from "../rules/objectives.js";
import { MIST_HELD_PEARLS, isLit, mistAt, seaReach, startingMist } from "../rules/mist.js";
import { advanceYard, applyMistDamage, startInstall, startRaft, startRaftUpgrade, startRepair, type RaftBuildingId } from "../rules/rafts.js";
import { advanceResearch, startResearch, type TechId } from "../rules/research.js";
import { advanceFleets, canSendFleet, leadOf, seaSite, sendFleet, startingSeaWorld, type CombatReport, type SeaState, type Sight } from "../rules/sea.js";
import type { Check } from "../rules/types.js";
import { STARTING_CAPTAIN, STARTING_LEAD, STARTING_MORALE, STARTING_PEARLS, STARTING_STOCK, STARTING_SURVIVORS, STARTING_TROOPS } from "../rules/start.js";
import { advanceTraining, startPromotion, startTraining } from "../rules/training.js";
import { emptyTroops, type BuildingId, type TroopType } from "../rules/types.js";
import type { PlayerState } from "./types.js";

/** Reports kept in the city; older ones are dropped. */
export const MAX_REPORTS = 20;

/**
 * A new city, built only from the starting values of the shared rules, at `clock` (seconds since 1 January 1970, UTC:
 * the server gives its time; 0 by default, for tests).
 */
export function newPlayerState(clock = 0): PlayerState {
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
    clock,
    mist: startingMist(),
    leviathan: startingLeviathan(),
    objective: 0,
    progress: startingProgress(),
    daily: startingDaily(clock),
  };
}

/** The weather now: the Mist on or not, and the Lighthouse stoked or not. */
const weatherOf = (s: PlayerState): Weather => ({ mist: mistAt(s.clock).on, stoked: isLit(s.clock, s.mist) });

/** Production at constant levels, with the shared rules, in the weather of the moment. */
function produce(state: PlayerState, seconds: number): PlayerState {
  const cap = storeCap(state.buildings.lighthouse, state.techs);
  return { ...state, stock: advanceStock(state.stock, netRates(state, weatherOf(state)), seconds, cap) };
}

/** Seconds until a stoked Lighthouse burns its last oil; Infinity when it is not stoked or the oil does not go down. */
function untilOutOfOil(s: PlayerState): number {
  if (!isLit(s.clock, s.mist)) return Infinity;
  const rate = netRates(s, weatherOf(s)).oil;
  return rate < 0 ? (s.stock.oil / -rate) * 3600 : Infinity;
}

/**
 * The Mist lifts: held (the Lighthouse never went dark), +MIST_HELD_PEARLS; not held, every raft loses
 * MIST_RAFT_DAMAGE, never below RAFT_MIN_HP. The Lighthouse is ready for the next one.
 */
function mistLifts(s: PlayerState): PlayerState {
  if (!s.mist.dark) return { ...s, pearls: s.pearls + MIST_HELD_PEARLS, mist: { ...s.mist, held: s.mist.held + 1 }, daily: countDaily(s.daily, s.clock, "mists") };
  const rafts = applyMistDamage(s.rafts, false);
  const damaged = Object.keys(rafts).filter((k) => rafts[k]!.hp < s.rafts[k]!.hp).length;
  return { ...s, rafts, mist: { ...s.mist, dark: false, missed: s.mist.missed + 1, damaged } };
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
  clock: s.clock,
  leviathan: s.leviathan,
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
    leviathan: sea.leviathan,
    reports: added.length ? [...s.reports, ...added].slice(-MAX_REPORTS) : s.reports,
    reportSeq: seq,
  };
}

/**
 * Advances the city by `seconds` of game time. Time is cut at each finished upgrade, at the end of the research,
 * at the end of the shipyard's work, at the end of a training or a healing, at each step of a fleet, when a Mist
 * starts or lifts and when a stoked Lighthouse runs out of oil, so production, storage and fleets follow the new
 * state from the exact moment it changes.
 */
export function advance(state: PlayerState, seconds: number): PlayerState {
  let s = state;
  let rest = seconds;
  while (rest > 0) {
    // A stoked Lighthouse with no oil left goes dark until the Mist lifts.
    if (isLit(s.clock, s.mist) && s.stock.oil <= 0) s = { ...s, mist: { ...s.mist, dark: true } };
    const outOfOil = untilOutOfOil(s);
    const w = mistAt(s.clock);
    // The next time the Mist starts or lifts: a whole second, which the clock lands on exactly.
    const change = w.on ? w.end : w.start;
    // 00:00 UTC: the daily tasks start again; a day's counts never straddle two days.
    const midnight = s.clock + untilMidnight(s.clock);
    const ends = [...s.queue.map((j) => j.left), ...(s.research ? [s.research.left] : []), ...(s.yard ? [s.yard.left] : []), ...(s.training ? [s.training.left] : []), ...(s.healing ? [s.healing.left] : []), ...s.fleets.map((f) => f.left), change - s.clock, midnight - s.clock, outOfOil];
    const next = Math.min(rest, ...ends.map((left) => Math.max(0, left)));
    const wasOn = w.on;
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
    // The camps beaten in this step count for today and for the objectives.
    const beaten = f.reports.filter((r) => r.win && seaSite(r.site)?.kind === "camp").length;
    if (beaten) s = { ...s, progress: { ...s.progress, camps: s.progress.camps + beaten }, daily: countDaily(s.daily, s.clock, "camps", beaten) };
    s = { ...s, clock: next === change - s.clock ? change : next === midnight - s.clock ? midnight : s.clock + next };
    if (s.daily.day !== dayOf(s.clock)) s = { ...s, daily: dailyOn(s.daily, s.clock) };
    if (next === outOfOil) s = { ...s, mist: { ...s.mist, dark: true } };
    const on = mistAt(s.clock).on;
    // A Mist starts: the Lighthouse is stoked only with the order on and oil to burn.
    if (!wasOn && on) s = { ...s, mist: { ...s.mist, dark: !s.mist.stoke || s.stock.oil <= 0 } };
    if (wasOn && !on) s = mistLifts(s);
    rest -= next;
  }
  return s;
}

export type ActionResult = { ok: true; state: PlayerState } | { ok: false; reason: string };

/** How far your fleets can sail now: the whole sea in calm weather, the Lighthouse's light in the Mist. */
export const fleetSight = (state: PlayerState): Sight => ({ reach: seaReach(state.clock, state.buildings.lighthouse, state.mist), lit: isLit(state.clock, state.mist) });

/** Can you send a fleet to this site now? The rule `sail` applies, for the client to show before you tap. */
export const fleetCheck = (state: PlayerState, siteId: string): Check => canSendFleet(siteId, seaState(state), fleetSight(state));

/** Sends a fleet with the shared rule, within the Lighthouse's light in the Mist; a refusal comes with its reason. */
export function sail(state: PlayerState, siteId: string): ActionResult {
  const r = sendFleet(siteId, seaState(state), fleetSight(state));
  return r.ok ? { ok: true, state: withSea(state, r.state) } : r;
}

/**
 * Gives or takes back the order to stoke the Lighthouse in the Mist. Taken back during a Mist, the Lighthouse goes
 * dark until it lifts, and that Mist is not held; given again, it waits for the next one.
 */
export function stoke(state: PlayerState, on: boolean): ActionResult {
  if (state.mist.stoke === on) return { ok: true, state };
  const dark = state.mist.dark || (!on && mistAt(state.clock).on);
  return { ok: true, state: { ...state, mist: { ...state.mist, stoke: on, dark } } };
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
/** Adds a reward to the city: resources to the stock (no storage cap, as a camp's loot), Pearls to the Pearls. */
function give(state: PlayerState, reward: Reward): PlayerState {
  const stock = { ...state.stock };
  for (const k of ["oil", "fish", "wood", "rope"] as const) stock[k] += reward[k] ?? 0;
  return { ...state, stock, pearls: state.pearls + (reward.pearls ?? 0) };
}

/** Claims the current objective's reward, once its condition is met: the rules read the city, never the client. */
export function claimObjective(state: PlayerState): ActionResult {
  const o = OBJECTIVES[state.objective];
  if (!o) return { ok: false, reason: "You have finished every objective" };
  if (!o.done(state)) return { ok: false, reason: "Finish your current objective first" };
  return { ok: true, state: { ...give(state, o.reward), objective: state.objective + 1 } };
}

/** Opens one of today's chests with today's points, once a day. */
export function openChest(state: PlayerState, chest: Chest): ActionResult {
  if (!(CHESTS as readonly number[]).includes(chest)) return { ok: false, reason: "There is no such chest" };
  const check = canOpenChest(state.daily, state.clock, chest);
  if (!check.ok) return check;
  const today = dailyOn(state.daily, state.clock);
  return { ok: true, state: { ...give(state, chestReward(chest, state.buildings.lighthouse)), daily: { ...today, chests: [...today.chests, chest] } } };
}

/** Counts a task of the day at the city's clock, and what the objectives count since the city was founded. */
export function countDone(state: PlayerState, task: DailyTaskId): PlayerState {
  const progress =
    task === "gathers" ? { ...state.progress, gathers: state.progress.gathers + 1 } : task === "trains" ? { ...state.progress, trained: state.progress.trained + 1 } : state.progress;
  return { ...state, progress, daily: countDaily(state.daily, state.clock, task) };
}

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

/** Repairs every damaged raft at the shipyard with the shared rule; a refusal comes with its reason. */
export function repairRafts(state: PlayerState): ActionResult {
  const r = startRepair({ rafts: state.rafts, lighthouse: state.buildings.lighthouse, stock: state.stock, yard: state.yard });
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
