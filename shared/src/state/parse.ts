import { BUILDERS, BUILDING_IDS, type UpgradeJob } from "../rules/buildings.js";
import { CAPTAINS, type CaptainId } from "../rules/captains.js";
import { ATTACK_STAY, COLLECT_STAY, SEA_SITES, fleetsMax, seaSite, type Fleet, type SeaWorld } from "../rules/sea.js";
import type { Troops } from "../rules/types.js";
import { MAX_REPORTS } from "./state.js";
import type { PlayerState, Report } from "./types.js";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hasNums = (o: unknown, keys: readonly string[]) => isObj(o) && keys.every((k) => isNum(o[k]));

const TROOPS = ["boarders", "harpooners", "crossbowmen"] as const;
const isTroops = (t: unknown): t is Troops => hasNums(t, TROOPS) && TROOPS.every((k) => (t as Troops)[k] >= 0);

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
  const leadOk = lead === null || (isObj(lead) && typeof lead.id === "string" && lead.id in CAPTAINS && isNum(lead.level) && typeof lead.rarity === "string");
  const cargoOk = isObj(f.cargo) && Object.entries(f.cargo).every(([k, v]) => ["oil", "fish", "wood", "rope"].includes(k) && isNum(v) && v >= 0);
  return (
    kind !== null &&
    f.kind === kind &&
    (f.phase === "out" || f.phase === "stay" || f.phase === "back") &&
    isNum(f.left) &&
    isNum(f.travel) &&
    f.travel > 0 &&
    isTroops(f.troops) &&
    isObj(f.techs) &&
    leadOk &&
    isNum(f.watchtowers) &&
    isNum(f.hold) &&
    cargoOk &&
    isNum(f.pearls) &&
    f.pearls >= 0
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
  isNum(r.level) &&
  isNum(r.attack) &&
  isNum(r.defense) &&
  isTroops(r.sent) &&
  isTroops(r.losses) &&
  isTroops(r.wounded) &&
  isTroops(r.enemy) &&
  (r.loot === null || hasNums(r.loot, ["oil", "wood", "pearls", "rope"]));

/**
 * Reads a city sent or stored as JSON. Strict: a missing or invalid field gives null, and nothing is filled in,
 * so a city sent without Pearls or without its sea is refused instead of getting starting values back.
 * The only tolerance: bad jobs and fleets are dropped and their time left is brought within bounds
 * (cleanQueue, cleanFleets), which can only make the player lose something, never gain. Never throws.
 */
export function parseState(raw: unknown): PlayerState | null {
  try {
    if (!isObj(raw)) return null;
    const s = raw;
    if (
      !hasNums(s.buildings, BUILDING_IDS) ||
      !hasNums(s.stock, ["oil", "fish", "wood", "rope"]) ||
      !hasNums(s.troops, TROOPS) ||
      !isObj(s.techs) ||
      !isObj(s.rafts) ||
      !isObj(s.captains) ||
      !isNum(s.survivors) ||
      !isNum(s.morale) ||
      !isNum(s.pearls) ||
      s.pearls < 0 ||
      !Array.isArray(s.queue) ||
      !(s.lead === null || (typeof s.lead === "string" && s.lead in CAPTAINS)) ||
      !Array.isArray(s.fleets) ||
      !isTroops(s.wounded) ||
      !Array.isArray(s.reports) ||
      s.reports.length > MAX_REPORTS ||
      !s.reports.every(isReport) ||
      !isNum(s.reportSeq) ||
      !Number.isInteger(s.reportSeq) ||
      s.reportSeq < 0 ||
      s.reportSeq > MAX_REPORT_SEQ
    ) {
      return null;
    }
    // Report ids are all different, and none is above the counter.
    const ids = (s.reports as Report[]).map((r) => r.id);
    if (new Set(ids).size !== ids.length || ids.some((id) => reportNumber(id) > (s.reportSeq as number))) return null;
    const world = parseWorld(s.world);
    if (!world) return null;
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
