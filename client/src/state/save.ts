import {
  ATTACK_STAY,
  BUILDERS,
  COLLECT_STAY,
  BUILDING_IDS,
  CAPTAINS,
  STARTING_LEAD,
  STARTING_PEARLS,
  emptyTroops,
  fleetsMax,
  seaSite,
  startingSeaWorld,
  type CaptainId,
  type Fleet,
  type SeaWorld,
  type Troops,
  type UpgradeJob,
} from "@brinelight/shared";
import { MAX_REPORTS } from "./state.js";
import type { Report } from "./types.js";
import { catchUp, newPlayerState } from "./state.js";
import type { PlayerState } from "./types.js";

/** Temporary local save, until the server takes over in week 4. */
export const SAVE_KEY = "brinelight-client-v1";
const VERSION = 1;

type SaveFile = { v: typeof VERSION; savedAt: number; state: PlayerState };
export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

/** The browser storage, or null when it is blocked (private mode, disabled site data). */
export function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveGame(store: KeyValueStore | null, state: PlayerState, nowMs: number): void {
  if (!store) return;
  const file: SaveFile = { v: VERSION, savedAt: nowMs, state };
  try {
    store.setItem(SAVE_KEY, JSON.stringify(file));
  } catch {
    // Storage full or blocked: the game goes on without saving.
  }
}

/** The saved city caught up to `nowMs`, or a new city when there is no readable save. */
export function loadGame(store: KeyValueStore | null, nowMs: number): PlayerState {
  const file = readSave(store);
  if (!file) return newPlayerState();
  return catchUp(file.state, (nowMs - file.savedAt) / 1000);
}

function readSave(store: KeyValueStore | null): SaveFile | null {
  if (!store) return null;
  try {
    const o: unknown = JSON.parse(store.getItem(SAVE_KEY) ?? "null");
    if (!isSaveFile(o)) return null;
    o.state.queue = cleanQueue((o.state as { queue?: unknown }).queue);
    // A save from before the Pearls has none: it gets the starting Pearls.
    if (!isNum(o.state.pearls) || o.state.pearls < 0) o.state.pearls = STARTING_PEARLS;
    // A save from before the sea has none of it: it gets the starting sea; bad parts are dropped.
    const st = o.state as unknown as Record<string, unknown>;
    o.state.lead = st.lead === null ? null : typeof st.lead === "string" && st.lead in CAPTAINS ? (st.lead as CaptainId) : STARTING_LEAD;
    o.state.fleets = cleanFleets(st.fleets, o.state.buildings.harbor);
    o.state.world = cleanWorld(st.world);
    o.state.wounded = isTroops(st.wounded) ? st.wounded : emptyTroops();
    o.state.reports = Array.isArray(st.reports) ? st.reports.filter(isReport).slice(-MAX_REPORTS) : [];
    return o;
  } catch {
    return null;
  }
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hasNums = (o: unknown, keys: readonly string[]) => isObj(o) && keys.every((k) => isNum(o[k]));

/**
 * The build queue read from a save. A save from before the queue has none; a bad job is dropped,
 * the rest of the city is kept. At most one job per building and BUILDERS jobs (the first ones),
 * with `left` brought back between 0 and `duration`.
 */
export function cleanQueue(raw: unknown): UpgradeJob[] {
  if (!Array.isArray(raw)) return [];
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

const TROOPS = ["boarders", "harpooners", "crossbowmen"] as const;
const isTroops = (t: unknown): t is Troops => hasNums(t, TROOPS) && TROOPS.every((k) => (t as Troops)[k] >= 0);

/**
 * Fleets read from a save: a bad fleet is dropped (its troops are lost, as a fleet lost at sea),
 * the rest of the city is kept. At most as many fleets as the Harbor allows, the first ones.
 */
export function cleanFleets(raw: unknown, harbor: number): Fleet[] {
  if (!Array.isArray(raw)) return [];
  const longest = (f: Fleet) => (f.phase === "stay" ? (f.kind === "attack" ? ATTACK_STAY : COLLECT_STAY) : f.travel);
  return raw
    .filter(isFleet)
    .slice(0, fleetsMax(harbor))
    .map((f) => ({ ...f, left: Math.min(Math.max(0, f.left), longest(f)) }));
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

/** Camp levels and wrecks read from a save; a missing or bad value gets its starting value. */
function cleanWorld(raw: unknown): SeaWorld {
  const world = startingSeaWorld();
  if (!isObj(raw)) return world;
  const camps = isObj(raw.camps) ? raw.camps : {};
  const wrecks = isObj(raw.wrecks) ? raw.wrecks : {};
  for (const id of Object.keys(world.camps)) {
    const v = camps[id];
    if (isNum(v) && Number.isInteger(v) && v >= 1) world.camps[id] = v;
  }
  for (const id of Object.keys(world.wrecks)) {
    const v = wrecks[id];
    if (isNum(v) && v > 0 && v <= world.wrecks[id]!) world.wrecks[id] = v;
  }
  return world;
}

const isReport = (r: unknown): r is Report =>
  isObj(r) && typeof r.site === "string" && !!seaSite(r.site) && typeof r.win === "boolean" && typeof r.read === "boolean" && isNum(r.level) && isNum(r.attack) && isNum(r.defense) &&
  isTroops(r.sent) && isTroops(r.losses) && isTroops(r.wounded) && isTroops(r.enemy) && (r.loot === null || hasNums(r.loot, ["oil", "wood", "pearls", "rope"]));

const isJob = (j: unknown): j is UpgradeJob =>
  isObj(j) && typeof j.id === "string" && (BUILDING_IDS as string[]).includes(j.id) && isNum(j.left) && isNum(j.duration) && j.duration > 0;

function isSaveFile(o: unknown): o is SaveFile {
  if (!isObj(o) || o.v !== VERSION || !isNum(o.savedAt) || !isObj(o.state)) return false;
  const s = o.state;
  return (
    hasNums(s.buildings, BUILDING_IDS) &&
    hasNums(s.stock, ["oil", "fish", "wood", "rope"]) &&
    hasNums(s.troops, ["boarders", "harpooners", "crossbowmen"]) &&
    isObj(s.techs) &&
    isObj(s.rafts) &&
    isObj(s.captains) &&
    isNum(s.survivors) &&
    isNum(s.morale)
  );
}
