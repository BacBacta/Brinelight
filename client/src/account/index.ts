/**
 * The player's account: sign-in, the city kept on the server, and its saves.
 * Playing without signing in makes no network call: the game works as before, with the local save only.
 * The client reacts to a refusal by its `code`, never by the text of `error`.
 */
import { BUILDING_IDS, STARTING_PEARLS, newPlayerState, type PlayerState } from "@brinelight/shared";
import type { Wallet } from "@wallet-standard/base";
import { SAVE_KEY } from "../state/save.js";
import { OFFLINE, type Api, type ApiResult } from "./api.js";
import { signIn } from "./signIn.js";

/** The session on this device. Only the token, the wallet and where the saves stand: never the city. */
export const ACCOUNT_KEY = "brinelight-account-v1";
/** The city played on this device before the account city took its place: sign-in never erases it. */
export const BACKUP_KEY = "brinelight-client-v1-before-sign-in";

/** Saves to the server at most this often, and only when the city changed. */
export const SYNC_EVERY_MS = 30_000;
/** Even with no change, the city is sent this often, so the server never counts less time than was played. */
export const REFRESH_EVERY_MS = 30 * 60_000;
/** A save larger than this is not sent with `keepalive` (browsers cap those at 64 KB). */
const KEEPALIVE_MAX = 60_000;

export const TEXT = {
  conflict: "Your city changed on another device. We loaded the latest one.",
  signInAgain: "Please sign in again",
  signedIn: "Signed in. Your city is saved on your account.",
  signedOut: "Signed out. Your city stays on this device.",
} as const;

export type AccountStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * `pending`: the version a save was sent from, until its answer comes back. A save sent as the page closes
 * reaches the server, but its answer never reaches the page: the next page load recognizes it by this.
 */
type Saved = { token: string; wallet: string; version: number; dirty: boolean; pending?: number };
type AccountCity = { state: PlayerState; version: number; savedAt: string; asOf: string };
type CityAnswer = { city: null } | AccountCity;

export type AccountDeps = {
  api: Api;
  store: AccountStore | null;
  getState(): PlayerState;
  /** Replaces the city in play; it is then saved on this device as usual. */
  setState(state: PlayerState): void;
  toast(text: string, kind?: "" | "bad"): void;
  /** The account has a city and so has this device: "keep" the account city, or "replace" it (already confirmed). */
  ask(): Promise<"keep" | "replace">;
  nowMs(): number;
  /** The session changed: signed in or out. */
  onChange?(): void;
};

export type Account = ReturnType<typeof createAccount>;

/** A city nobody played yet on this device: nothing built, sent or spent. Signing in then just loads the account city. */
export function isUntouched(s: PlayerState): boolean {
  const n = newPlayerState();
  return (
    BUILDING_IDS.every((id) => s.buildings[id] === n.buildings[id]) &&
    s.queue.length === 0 &&
    s.fleets.length === 0 &&
    s.reports.length === 0 &&
    s.pearls === STARTING_PEARLS &&
    JSON.stringify(s.troops) === JSON.stringify(n.troops)
  );
}

function readSaved(store: AccountStore | null): Saved | null {
  try {
    const o = JSON.parse(store?.getItem(ACCOUNT_KEY) ?? "null") as Partial<Saved> | null;
    if (!o || typeof o.token !== "string" || typeof o.wallet !== "string") return null;
    const pending = Number.isInteger(o.pending) ? { pending: o.pending! } : {};
    return { token: o.token, wallet: o.wallet, version: Number.isInteger(o.version) ? o.version! : 0, dirty: o.dirty === true, ...pending };
  } catch {
    return null;
  }
}

export function createAccount(deps: AccountDeps) {
  const { api, store } = deps;
  let saved = readSaved(store);
  /** Counts the changes, so a change made while a save is on its way is not forgotten. */
  let changes = 0;
  let sentChanges = 0;
  let lastSentMs = deps.nowMs();
  let busy = false;
  /** Between sign-in (or page load) and the moment the city to play is known: no save goes out meanwhile. */
  let settling = false;
  /** Set after a refusal that saving again cannot fix (an invalid or unreadable city): no more saves until the page reloads. */
  let stopped = false;

  const write = () => {
    try {
      if (saved) store?.setItem(ACCOUNT_KEY, JSON.stringify(saved));
      else store?.removeItem(ACCOUNT_KEY);
    } catch {
      // Storage full or blocked: the session lasts as long as the page.
    }
  };
  const forget = () => {
    saved = null;
    write();
    deps.onChange?.();
  };
  const backup = () => {
    try {
      const raw = store?.getItem(SAVE_KEY);
      if (raw) store?.setItem(BACKUP_KEY, raw);
    } catch {
      // Storage full or blocked.
    }
  };
  /** The account city takes the place of the city in play, from `asOf`, with no time away added. */
  const adopt = (city: AccountCity) => {
    deps.setState(city.state);
    if (saved) saved = { token: saved.token, wallet: saved.wallet, version: city.version, dirty: false };
    sentChanges = changes;
    lastSentMs = deps.nowMs();
    write();
  };

  async function refused(r: { code: string; error: string }, canReload = true): Promise<void> {
    switch (r.code) {
      case "version_conflict":
        if (canReload && (await reload())) deps.toast(TEXT.conflict);
        return;
      case "signed_out":
        forget();
        deps.toast(TEXT.signInAgain, "bad");
        return;
      // No network, or saving too fast: the city stays on this device and is sent at the next try, silently.
      case OFFLINE:
      case "too_many_saves":
      case "server_error":
        return;
      default:
        stopped = true;
        deps.toast(r.error, "bad");
    }
  }

  const getCity = () => api.call<CityAnswer>("GET", "/city", { token: saved?.token });

  /** Loads the account city in place of the one in play. False when it could not. */
  async function reload(): Promise<boolean> {
    const r = await getCity();
    if (!r.ok) {
      await refused(r, false);
      return false;
    }
    if ("state" in r.data) {
      adopt(r.data);
      return true;
    }
    return push(0);
  }

  /** Sends the city in play over `version` (0 creates the account city). */
  async function push(version: number, keepalive = false): Promise<boolean> {
    if (!saved) return false;
    busy = true;
    const at = changes;
    saved = { ...saved, pending: version };
    write();
    const state = deps.getState();
    const body = { state, version };
    const r = await api.call<{ version: number; savedAt: string }>("PUT", "/city", {
      token: saved.token,
      body,
      keepalive: keepalive && JSON.stringify(body).length < KEEPALIVE_MAX,
    });
    busy = false;
    // Without an answer, the save may still have landed: a keepalive request sent as the page goes away
    // reaches the server, but the page sees it fail. `pending` is kept until a real answer.
    if (saved && (r.ok || r.code !== OFFLINE)) {
      const { pending: _, ...rest } = saved;
      saved = rest;
      write();
    }
    if (!r.ok) {
      await refused(r);
      return false;
    }
    if (!saved || !Number.isInteger(r.data?.version)) return !!saved;
    sentChanges = at;
    lastSentMs = deps.nowMs();
    saved = { ...saved, version: r.data.version, dirty: changes !== at };
    write();
    return true;
  }

  /** Right after sign-in, or on a page load with a session: which city is played from now on. */
  async function settle(fresh: boolean): Promise<void> {
    settling = true;
    try {
      await settleNow(fresh);
    } finally {
      settling = false;
    }
  }

  async function settleNow(fresh: boolean): Promise<void> {
    const r = await getCity();
    if (!r.ok) return refused(r);
    if (!("state" in r.data)) {
      await push(0);
      return;
    }
    const city = r.data;
    if (!fresh) {
      // A page load: changes this device could not send yet go first if nothing changed elsewhere since.
      if (saved?.dirty && saved.version === city.version) {
        await push(city.version);
        return;
      }
      // The last save, sent as the page closed, landed: the account city is this device's own.
      const ownSave = saved?.pending === saved?.version && city.version === (saved?.version ?? 0) + 1;
      const lost = !!saved?.dirty && !ownSave;
      adopt(city);
      if (lost) deps.toast(TEXT.conflict);
      return;
    }
    if (isUntouched(deps.getState()) || (await deps.ask()) === "keep") {
      backup();
      adopt(city);
    } else {
      await push(city.version);
    }
  }

  return {
    get signedIn(): boolean {
      return saved !== null;
    },
    get wallet(): string | null {
      return saved?.wallet ?? null;
    },
    /** On page load: with a session, the account city (or this device's unsent changes) is played. */
    async start(): Promise<void> {
      if (saved) await settle(false);
    },
    async signInWith(wallet: Wallet, page: { host: string; origin: string }): Promise<ApiResult<unknown>> {
      const r = await signIn(api, wallet, page);
      if (!r.ok) return r;
      saved = { token: r.data.token, wallet: r.data.wallet, version: 0, dirty: false };
      stopped = false;
      write();
      deps.onChange?.();
      await settle(true);
      if (saved) deps.toast(TEXT.signedIn);
      return r;
    },
    /** Signing out forgets the session, never the city. */
    async signOut(): Promise<void> {
      const token = saved?.token;
      forget();
      deps.toast(TEXT.signedOut);
      if (token) await api.call("POST", "/auth/logout", { token });
    },
    /** An action or an event changed the city (not the passing of time, which the server computes). */
    markChanged(): void {
      changes++;
      if (saved && !saved.dirty) {
        saved = { ...saved, dirty: true };
        write();
      }
    },
    /** Saves to the server if the city changed (or was not sent for a long time). `hidden`: the page is being hidden. */
    async sync(options: { hidden?: boolean } = {}): Promise<void> {
      if (!saved || stopped || busy || settling) return;
      const changed = changes !== sentChanges || saved.dirty;
      if (!changed && deps.nowMs() - lastSentMs < REFRESH_EVERY_MS) return;
      await push(saved.version, options.hidden);
    },
  };
}
