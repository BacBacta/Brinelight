import { BUILDERS, BUILDING_IDS, LIGHTHOUSE_MAX, type UpgradeJob } from "../rules/buildings.js";
import { CAPTAINS, CAPTAIN_MAX_LEVEL, type CaptainId } from "../rules/captains.js";
import { RAFT_BUILDINGS, RAFT_BUILDING_MAX_LEVEL, RAFT_MAX_HP, RAFT_SLOTS, type Rafts, type YardJob } from "../rules/rafts.js";
import { TECHS, techLevel, type ResearchJob, type TechId, type Techs } from "../rules/research.js";
import { ATTACK_STAY, COLLECT_STAY, SEA_SITES, fleetsMax, seaSite, type Fleet, type SeaWorld } from "../rules/sea.js";
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
 * Research, captains and rafts: a missing id means level 0 or not owned yet, as the rules read them, so a city
 * saved before a new research or captain existed stays readable. An unknown id, or a level out of bounds, is refused.
 */
const isTechs = (t: unknown) => isObj(t) && Object.entries(t).every(([id, v]) => has(TECHS, id) && isLevel(v, TECHS[id as keyof typeof TECHS].max));
const isCaptains = (c: unknown) =>
  isObj(c) &&
  Object.entries(c).every(
    ([id, v]) => has(CAPTAINS, id) && isObj(v) && isWhole(v.level, 1, CAPTAIN_MAX_LEVEL) && isWhole(v.stars, 1) && isNum(v.xp) && v.xp >= 0,
  );
const SLOTS = new Set(RAFT_SLOTS.map((s) => s.key));
const isRafts = (r: unknown) =>
  isObj(r) &&
  Object.entries(r).every(
    ([slot, v]) =>
      SLOTS.has(slot) &&
      isObj(v) &&
      isNum(v.hp) &&
      v.hp >= 0 &&
      v.hp <= RAFT_MAX_HP &&
      (v.building === null || (typeof v.building === "string" && has(RAFT_BUILDINGS, v.building))) &&
      isLevel(v.level, RAFT_BUILDING_MAX_LEVEL),
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
 * The work at the shipyard: none (null), or a new raft (the only kind today) on a known slot with no raft yet,
 * with its time left brought back between 0 and its duration. Anything else refuses the city.
 */
function parseYard(raw: unknown, rafts: Rafts): YardJob | null | undefined {
  if (raw === null) return null;
  if (!isObj(raw) || Object.keys(raw).sort().join() !== "duration,kind,left,slot") return undefined;
  const { slot, kind, left, duration } = raw;
  if (kind !== "raft" || typeof slot !== "string" || !SLOTS.has(slot) || has(rafts, slot)) return undefined;
  if (!isNum(left) || !isNum(duration) || duration <= 0) return undefined;
  return { slot, kind, left: Math.min(Math.max(0, left), duration), duration };
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
  (r.loot === null || (isAmounts(r.loot, ["oil", "wood", "rope"]) && isWhole((r.loot as Record<string, unknown>).pearls)));

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
      !isTechs(s.techs) ||
      !isRafts(s.rafts) ||
      !isCaptains(s.captains) ||
      !isWhole(s.survivors) ||
      !isNum(s.morale) ||
      s.morale < 0 ||
      !isWhole(s.pearls) ||
      !Array.isArray(s.queue) ||
      !(s.lead === null || (typeof s.lead === "string" && has(CAPTAINS, s.lead))) ||
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
    const buildings = s.buildings as PlayerState["buildings"];
    return {
      buildings: { ...buildings },
      stock: { ...(s.stock as PlayerState["stock"]) },
      troops: { ...(s.troops as PlayerState["troops"]) },
      techs: { ...(s.techs as PlayerState["techs"]) },
      rafts: { ...(s.rafts as PlayerState["rafts"]) },
      captains: { ...(s.captains as PlayerState["captains"]) },
      survivors: s.survivors,
      morale: s.morale,
      pearls: s.pearls,
      queue: cleanQueue(s.queue),
      research,
      yard,
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
