import { BUILDERS, BUILDING_IDS, STARTING_PEARLS, type UpgradeJob } from "@brinelight/shared";
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
