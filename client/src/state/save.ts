import { STARTING_LEAD, STARTING_PEARLS, catchUp, emptyTroops, newPlayerState, parseState, startingSeaWorld, type PlayerState } from "@brinelight/shared";

/** Temporary local save, for players who are not signed in. */
export const SAVE_KEY = "brinelight-client-v1";
/** Where a save that could not be read is kept, untouched, so nothing is lost for good. */
export const REJECTED_KEY = "brinelight-client-v1-rejected";
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

export type OpenedSave = {
  state: PlayerState;
  /** A save was there but could not be read: a new city starts, and the save was copied to REJECTED_KEY. */
  rejected: boolean;
};

/**
 * The saved city caught up to `nowMs`, or a new city when there is no save or it cannot be read.
 * A save that cannot be read is copied as it is to REJECTED_KEY, unless a copy is already there:
 * the first rejected save is never overwritten.
 */
export function openSave(store: KeyValueStore | null, nowMs: number): OpenedSave {
  const raw = readRaw(store);
  if (raw === null) return { state: newPlayerState(), rejected: false };
  const file = readSave(raw);
  if (file) return { state: catchUp(file.state, (nowMs - file.savedAt) / 1000), rejected: false };
  try {
    if (store!.getItem(REJECTED_KEY) === null) store!.setItem(REJECTED_KEY, raw);
  } catch {
    // Storage full or blocked: the copy is lost, the game goes on.
  }
  return { state: newPlayerState(), rejected: true };
}

/** The saved city caught up to `nowMs`, or a new city when there is no readable save. */
export const loadGame = (store: KeyValueStore | null, nowMs: number): PlayerState => openSave(store, nowMs).state;

function readRaw(store: KeyValueStore | null): string | null {
  if (!store) return null;
  try {
    return store.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Brings an old local save up to date, then reads it with the strict parseState of the shared rules.
 * Only fields that did not exist in older saves are filled in: the Pearls (week 2, task 4), the build queue
 * (task 3), the sea (task 5), the report ids with their counter (week 4: reports kept in a save without
 * ids are numbered r1, r2… in their order), the research and shipyard work in progress (week 4, task 6: none), and the training and healing (week 5: none). A field that exists but is invalid is not repaired: parseState refuses it.
 * These repairs live only in the client; the server never fills anything in.
 */
export function migrateSave(raw: unknown): PlayerState | null {
  if (!isObj(raw)) return null;
  const s = { ...raw };
  if (!("pearls" in s)) s.pearls = STARTING_PEARLS;
  if (!("queue" in s)) s.queue = [];
  if (!("research" in s)) s.research = null;
  if (!("yard" in s)) s.yard = null;
  if (!("training" in s)) s.training = null;
  if (!("healing" in s)) s.healing = null;
  if (!("lead" in s)) s.lead = STARTING_LEAD;
  if (!("fleets" in s)) s.fleets = [];
  if (!("world" in s)) s.world = startingSeaWorld();
  if (!("wounded" in s)) s.wounded = emptyTroops();
  if (!("reports" in s)) s.reports = [];
  if (!("reportSeq" in s) && Array.isArray(s.reports)) {
    const reports: unknown[] = s.reports;
    s.reports = reports.map((r, i) => (isObj(r) && !("id" in r) ? { ...r, id: `r${i + 1}` } : r));
    s.reportSeq = reports.length;
  }
  return parseState(s);
}

function readSave(raw: string): SaveFile | null {
  try {
    const o: unknown = JSON.parse(raw);
    if (!isObj(o) || o.v !== VERSION || typeof o.savedAt !== "number" || !Number.isFinite(o.savedAt)) return null;
    const state = migrateSave(o.state);
    return state ? { v: VERSION, savedAt: o.savedAt, state } : null;
  } catch {
    return null;
  }
}
