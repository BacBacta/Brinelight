import { BUILDERS, BUILDING_IDS, LIGHTHOUSE_MAX, type UpgradeJob } from "../rules/buildings.js";
import { CAPTAINS, CAPTAIN_MAX_LEVEL, CAPTAIN_MAX_STARS, xpNeeded, type CaptainId } from "../rules/captains.js";
import type { HealingJob } from "../rules/healing.js";
import { RAFT_BUILDINGS, RAFT_BUILDING_MAX_COPIES, RAFT_BUILDING_MAX_LEVEL, RAFT_MAX_HP, RAFT_SLOTS, raftBuildingCopies, type RaftBuildingId, type Rafts, type YardJob } from "../rules/rafts.js";
import { TECHS, techLevel, type ResearchJob, type TechId, type Techs } from "../rules/research.js";
import { ATTACK_STAY, COLLECT_STAY, SEA_SITES, fleetsMax, hospitalCapacity, seaSite, type Fleet, type SeaWorld } from "../rules/sea.js";
import { PROMOTE_BARRACKS, PROMOTE_COUNT, TRAIN_PER_LEVEL, type TrainingJob } from "../rules/training.js";
import type { Troops } from "../rules/types.js";
import { MAX_REPORTS } from "./state.js";
import type { PlayerState, Report } from "./types.js";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hasNums = (o: unknown, keys: readonly string[]) => isObj(o) && keys.every((k) => isNum(o[k]));
/** A whole number from `min` to `max`: levels, troops, Pearls. */
const isWhole = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
/** Resources can hold decimals (production runs by the second), never less than 0. */
const isAmounts = (o: unknown, keys: readonly string[]) => hasNums(o, keys) && keys.every((k) => (o as Record<string, number>)[k]! >= 0);
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

const TROOPS = ["boarders", "harpooners", "crossbowmen"] as const;
const RESOURCES = ["oil", "fish", "wood", "rope"] as const;
const RARITIES = ["officer", "commander", "admiral"];
const isTroops = (t: unknown): t is Troops => isObj(t) && TROOPS.every((k) => isWhole(t[k]));
const isLevel = (v: unknown, max: number) => isWhole(v, 0, max);

/**
 * Research, captains, shards and rafts: a missing id means level 0, not owned yet or no shard, as the rules read them,
 * so a city saved before a new research or captain existed stays readable. An unknown id, or a value out of bounds,
 * is refused. A captain below the highest level holds less experience than its next level needs.
 */
const isTechs = (t: unknown) => isObj(t) && Object.entries(t).every(([id, v]) => has(TECHS, id) && isLevel(v, TECHS[id as keyof typeof TECHS].max));
const isCaptains = (c: unknown) =>
  isObj(c) &&
  Object.entries(c).every(
    ([id, v]) =>
      has(CAPTAINS, id) &&
      isObj(v) &&
      isWhole(v.level, 1, CAPTAIN_MAX_LEVEL) &&
      isWhole(v.stars, 1, CAPTAIN_MAX_STARS) &&
      isNum(v.xp) &&
      v.xp >= 0 &&
      (v.level === CAPTAIN_MAX_LEVEL || v.xp < xpNeeded(v.level)),
  );
const isShards = (c: unknown) => isObj(c) && Object.entries(c).every(([id, v]) => has(CAPTAINS, id) && isWhole(v));
const SLOTS = new Set(RAFT_SLOTS.map((s) => s.key));
/** A raft on a known slot: with no building at level 0, or with a known building at level 1 to RAFT_BUILDING_MAX_LEVEL. */
const isRafts = (r: unknown) =>
  isObj(r) &&
  Object.entries(r).every(
    ([slot, v]) =>
      SLOTS.has(slot) &&
      isObj(v) &&
      isNum(v.hp) &&
      v.hp >= 0 &&
      v.hp <= RAFT_MAX_HP &&
      (v.building === null ? v.level === 0 : typeof v.building === "string" && has(RAFT_BUILDINGS, v.building) && isWhole(v.level, 1, RAFT_BUILDING_MAX_LEVEL)),
  );

const isJob = (j: unknown): j is UpgradeJob =>
  isObj(j) && typeof j.id === "string" && (BUILDING_IDS as string[]).includes(j.id) && isNum(j.left) && isNum(j.duration) && j.duration > 0;

/**
 * The build queue of a city being read. A bad job is dropped; at most one job per building and BUILDERS jobs
 * (the first ones), with `left` brought back between 0 and `duration`. This can only make the player lose a job, never gain.
 */
export function cleanQueue(raw: readonly unknown[]): UpgradeJob[] {
  const seen = new Set<string>();
  const out: UpgradeJob[] = [];
  for (const j of raw) {
    if (out.length >= BUILDERS) break;
    if (!isJob(j) || seen.has(j.id)) continue;
    seen.add(j.id);
    out.push({ id: j.id, left: Math.min(Math.max(0, j.left), j.duration), duration: j.duration });
  }
  return out;
}

function isFleet(f: unknown): f is Fleet {
  if (!isObj(f) || typeof f.site !== "string") return false;
  const site = seaSite(f.site);
  const kind = site?.kind === "camp" ? "attack" : site?.kind === "wreck" ? "collect" : null;
  const lead = f.lead;
  const leadOk =
    lead === null ||
    (isObj(lead) && typeof lead.id === "string" && has(CAPTAINS, lead.id) && isWhole(lead.level, 1, CAPTAIN_MAX_LEVEL) && RARITIES.includes(lead.rarity as string));
  const cargoOk = isObj(f.cargo) && Object.entries(f.cargo).every(([k, v]) => (RESOURCES as readonly string[]).includes(k) && isNum(v) && v >= 0);
  return (
    kind !== null &&
    f.kind === kind &&
    (f.phase === "out" || f.phase === "stay" || f.phase === "back") &&
    isNum(f.left) &&
    isNum(f.travel) &&
    f.travel > 0 &&
    isTroops(f.troops) &&
    isTroops(f.veterans) &&
    isTechs(f.techs) &&
    leadOk &&
    isNum(f.watchtowers) &&
    f.watchtowers >= 0 &&
    isNum(f.hold) &&
    f.hold >= 0 &&
    cargoOk &&
    isWhole(f.pearls)
  );
}

/**
 * The fleets of a city being read. A bad fleet is dropped (its troops are lost, as a fleet lost at sea);
 * at most as many fleets as the Harbor allows, the first ones, with `left` brought back within its phase.
 * This can only make the player lose a fleet, never gain.
 */
export function cleanFleets(raw: readonly unknown[], harbor: number): Fleet[] {
  const longest = (f: Fleet) => (f.phase === "stay" ? (f.kind === "attack" ? ATTACK_STAY : COLLECT_STAY) : f.travel);
  return raw
    .filter(isFleet)
    .slice(0, fleetsMax(harbor))
    .map((f) => ({ ...f, left: Math.min(Math.max(0, f.left), longest(f)) }));
}

/**
 * The research in progress: none (null), or a known research below its maximum, with its time left brought
 * back between 0 and its duration (as for the build queue). Anything else refuses the city.
 */
function parseResearch(raw: unknown, techs: Techs): ResearchJob | null | undefined {
  if (raw === null) return null;
  if (!isObj(raw) || Object.keys(raw).sort().join() !== "duration,id,left") return undefined;
  const { id, left, duration } = raw;
  if (typeof id !== "string" || !has(TECHS, id) || !isNum(left) || !isNum(duration) || duration <= 0) return undefined;
  if (techLevel(techs, id as TechId) >= TECHS[id as TechId].max) return undefined;
  return { id: id as TechId, left: Math.min(Math.max(0, left), duration), duration };
}

/**
 * The work at the shipyard: none (null), a new raft on a known slot with no raft yet, a building put on a free raft,
 * or a raft building below its highest level taken one level up; with its time left brought back between 0 and its
 * duration. Anything else refuses the city.
 */
function parseYard(raw: unknown, rafts: Rafts): YardJob | null | undefined {
  if (raw === null) return null;
  if (!isObj(raw)) return undefined;
  const { slot, kind, left, duration } = raw;
  if (typeof slot !== "string" || !SLOTS.has(slot) || !isNum(left) || !isNum(duration) || duration <= 0) return undefined;
  const time = { left: Math.min(Math.max(0, left), duration), duration };
  const keys = Object.keys(raw).sort().join();
  const raft = has(rafts, slot) ? rafts[slot]! : null;
  if (kind === "raft") return keys === "duration,kind,left,slot" && !raft ? { slot, kind, ...time } : undefined;
  if (kind === "install") {
    const b = raw.building;
    if (keys !== "building,duration,kind,left,slot" || typeof b !== "string" || !has(RAFT_BUILDINGS, b) || !raft || raft.building) return undefined;
    return { slot, kind, building: b as RaftBuildingId, ...time };
  }
  if (kind === "upgrade") return keys === "duration,kind,left,slot" && raft?.building && raft.level < RAFT_BUILDING_MAX_LEVEL ? { slot, kind, ...time } : undefined;
  return undefined;
}

/**
 * The work at the Barracks: none (null), or for a known troop type either a batch (`train`, a whole number of
 * soldiers no larger than the Barracks' batch) or a promotion (`promote`, exactly 10 soldiers, with the Veteran
 * Doctrine and the Barracks at level 3), with its time left brought back between 0 and its duration.
 * Anything else refuses the city.
 */
function parseTraining(raw: unknown, barracks: number, techs: Techs): TrainingJob | null | undefined {
  if (raw === null) return null;
  if (!isObj(raw) || Object.keys(raw).sort().join() !== "count,duration,kind,left,troop") return undefined;
  const { kind, troop, count, left, duration } = raw;
  if (typeof troop !== "string" || !(TROOPS as readonly string[]).includes(troop)) return undefined;
  if (kind === "train") {
    if (!isWhole(count, 1, barracks * TRAIN_PER_LEVEL)) return undefined;
  } else if (kind === "promote") {
    if (count !== PROMOTE_COUNT || barracks < PROMOTE_BARRACKS || techLevel(techs, "veterans") < 1) return undefined;
  } else return undefined;
  if (!isNum(left) || !isNum(duration) || duration <= 0) return undefined;
  return { kind, troop: troop as TrainingJob["troop"], count: count as number, left: Math.min(Math.max(0, left), duration), duration };
}

/**
 * The healing at the Infirmary: none (null), or wounded by type (whole numbers, at least one, no more than the
 * Infirmary's beds), with its time left brought back between 0 and its duration. Anything else refuses the city.
 */
function parseHealing(raw: unknown, infirmary: number): HealingJob | null | undefined {
  if (raw === null) return null;
  if (!isObj(raw) || Object.keys(raw).sort().join() !== "duration,left,wounded") return undefined;
  const { wounded, left, duration } = raw;
  if (!isTroops(wounded) || Object.keys(wounded).length !== TROOPS.length) return undefined;
  const count = TROOPS.reduce((a, k) => a + wounded[k], 0);
  if (count < 1 || count > hospitalCapacity(infirmary) || !isNum(left) || !isNum(duration) || duration <= 0) return undefined;
  return { wounded: { ...wounded }, left: Math.min(Math.max(0, left), duration), duration };
}

/** Camp levels and wrecks: every camp and every wreck of the map, each with a valid value. */
function parseWorld(raw: unknown): SeaWorld | null {
  if (!isObj(raw) || !isObj(raw.camps) || !isObj(raw.wrecks)) return null;
  const world: SeaWorld = { camps: {}, wrecks: {} };
  for (const s of SEA_SITES) {
    if (s.kind === "camp") {
      const v = raw.camps[s.id];
      if (!isNum(v) || !Number.isInteger(v) || v < 1) return null;
      world.camps[s.id] = v;
    }
    if (s.kind === "wreck") {
      const v = raw.wrecks[s.id];
      if (!isNum(v) || v <= 0 || v > (s.amount ?? 0)) return null;
      world.wrecks[s.id] = v;
    }
  }
  return world;
}

/** "r1", "r2"…: the id a report gets when it arrives (at most 9 digits). */
export const REPORT_ID = /^r[1-9][0-9]{0,8}$/;
/** The highest report counter: one more report would need a 10-digit id. */
export const MAX_REPORT_SEQ = 999_999_999;
const reportNumber = (id: string): number => Number(id.slice(1));

const isReport = (r: unknown): r is Report =>
  isObj(r) &&
  typeof r.id === "string" &&
  REPORT_ID.test(r.id) &&
  typeof r.site === "string" &&
  !!seaSite(r.site) &&
  typeof r.win === "boolean" &&
  typeof r.read === "boolean" &&
  isWhole(r.level) &&
  isNum(r.attack) &&
  isNum(r.defense) &&
  isTroops(r.sent) &&
  isTroops(r.losses) &&
  isTroops(r.wounded) &&
  isTroops(r.enemy) &&
  (r.loot === null || (isAmounts(r.loot, ["oil", "wood", "rope"]) && isWhole((r.loot as Record<string, unknown>).pearls))) &&
  // Reports from before the veterans have none of these three.
  (r.veteranSent === undefined || isTroops(r.veteranSent)) &&
  (r.veteranLosses === undefined || isTroops(r.veteranLosses)) &&
  (r.infirmary === undefined || typeof r.infirmary === "boolean") &&
  // Reports from before the captains' experience and shards have neither.
  (r.captainXp === undefined ||
    (isObj(r.captainXp) && typeof r.captainXp.id === "string" && has(CAPTAINS, r.captainXp.id) && isWhole(r.captainXp.xp) && isWhole(r.captainXp.levels))) &&
  (r.shards === undefined || (isObj(r.shards) && typeof r.shards.id === "string" && has(CAPTAINS, r.shards.id) && isWhole(r.shards.count, 1)));

/**
 * Reads a city sent or stored as JSON. Strict: a missing or invalid field gives null, and nothing is filled in,
 * so a city sent without Pearls or without its sea is refused instead of getting starting values back.
 * Levels, troops, survivors and Pearls are whole numbers; resources and morale may hold decimals; nothing is below 0.
 * The only tolerance: bad jobs and fleets are dropped and their time left is brought within bounds
 * (cleanQueue, cleanFleets), which can only make the player lose something, never gain. Never throws.
 */
export function parseState(raw: unknown): PlayerState | null {
  try {
    if (!isObj(raw)) return null;
    const s = raw;
    if (
      !isObj(s.buildings) ||
      !BUILDING_IDS.every((id) => isLevel((s.buildings as Record<string, unknown>)[id], LIGHTHOUSE_MAX)) ||
      !isAmounts(s.stock, RESOURCES) ||
      !isTroops(s.troops) ||
      !isTroops(s.veterans) ||
      !isTechs(s.techs) ||
      !isRafts(s.rafts) ||
      !isCaptains(s.captains) ||
      !isShards(s.shards) ||
      !isWhole(s.survivors) ||
      !isNum(s.morale) ||
      s.morale < 0 ||
      !isWhole(s.pearls) ||
      !Array.isArray(s.queue) ||
      // The lead captain is one you own.
      !(s.lead === null || (typeof s.lead === "string" && has(CAPTAINS, s.lead) && has(s.captains as object, s.lead))) ||
      !Array.isArray(s.fleets) ||
      !isTroops(s.wounded) ||
      !Array.isArray(s.reports) ||
      s.reports.length > MAX_REPORTS ||
      !s.reports.every(isReport) ||
      !isWhole(s.reportSeq, 0, MAX_REPORT_SEQ)
    ) {
      return null;
    }
    // Report ids are all different, and none is above the counter.
    const ids = (s.reports as Report[]).map((r) => r.id);
    if (new Set(ids).size !== ids.length || ids.some((id) => reportNumber(id) > (s.reportSeq as number))) return null;
    const world = parseWorld(s.world);
    if (!world) return null;
    const research = parseResearch(s.research, s.techs as Techs);
    if (research === undefined) return null;
    const yard = parseYard(s.yard, s.rafts as Rafts);
    if (yard === undefined) return null;
    // At most RAFT_BUILDING_MAX_COPIES rafts per building type, the one being put on a raft included.
    if ((Object.keys(RAFT_BUILDINGS) as RaftBuildingId[]).some((id) => raftBuildingCopies(id, s.rafts as Rafts, yard) > RAFT_BUILDING_MAX_COPIES)) return null;
    const buildings = s.buildings as PlayerState["buildings"];
    const training = parseTraining(s.training, buildings.barracks, s.techs as Techs);
    if (training === undefined) return null;
    const healing = parseHealing(s.healing, buildings.infirmary);
    if (healing === undefined) return null;
    return {
      buildings: { ...buildings },
      stock: { ...(s.stock as PlayerState["stock"]) },
      troops: { ...(s.troops as PlayerState["troops"]) },
      veterans: { ...(s.veterans as PlayerState["veterans"]) },
      techs: { ...(s.techs as PlayerState["techs"]) },
      rafts: { ...(s.rafts as PlayerState["rafts"]) },
      captains: { ...(s.captains as PlayerState["captains"]) },
      shards: { ...(s.shards as PlayerState["shards"]) },
      survivors: s.survivors,
      morale: s.morale,
      pearls: s.pearls,
      queue: cleanQueue(s.queue),
      research,
      yard,
      training,
      healing,
      lead: s.lead as CaptainId | null,
      fleets: cleanFleets(s.fleets, buildings.harbor),
      world,
      wounded: { ...s.wounded },
      reports: s.reports.map((r) => ({ ...r })),
      reportSeq: s.reportSeq,
    };
  } catch {
    return null;
  }
}
