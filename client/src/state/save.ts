import { STARTING_LEAD, STARTING_PEARLS, catchUp, emptyTroops, newPlayerState, parseState, startingSeaWorld, type PlayerState } from "@brinelight/shared";

/** Temporary local save, for players who are not signed in. */
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

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Brings an old local save up to date, then reads it with the strict parseState of the shared rules.
 * Only fields that did not exist in older saves are filled in: the Pearls (week 2, task 4), the build queue
 * (task 3) and the sea (task 5). A field that exists but is invalid is not repaired: parseState refuses it.
 * These repairs live only in the client; the server never fills anything in.
 */
export function migrateSave(raw: unknown): PlayerState | null {
  if (!isObj(raw)) return null;
  const s = { ...raw };
  if (!("pearls" in s)) s.pearls = STARTING_PEARLS;
  if (!("queue" in s)) s.queue = [];
  if (!("lead" in s)) s.lead = STARTING_LEAD;
  if (!("fleets" in s)) s.fleets = [];
  if (!("world" in s)) s.world = startingSeaWorld();
  if (!("wounded" in s)) s.wounded = emptyTroops();
  if (!("reports" in s)) s.reports = [];
  return parseState(s);
}

function readSave(store: KeyValueStore | null): SaveFile | null {
  if (!store) return null;
  try {
    const o: unknown = JSON.parse(store.getItem(SAVE_KEY) ?? "null");
    if (!isObj(o) || o.v !== VERSION || typeof o.savedAt !== "number" || !Number.isFinite(o.savedAt)) return null;
    const state = migrateSave(o.state);
    return state ? { v: VERSION, savedAt: o.savedAt, state } : null;
  } catch {
    return null;
  }
}
