/**
 * The player's account: sign-in, and the account's city, which the server decides (actions, ./actions.ts).
 * Playing without signing in makes no network call: the game works as before, with the local save only.
 * The city of this device (played without an account) and the account's city never mix: each has its own save.
 * The client reacts to a refusal by its `code`, never by the text of `error`.
 */
import { BUILDING_IDS, STARTING_PEARLS, newPlayerState, type ActionResult, type PlayerState } from "@brinelight/shared";
import type { Wallet } from "@wallet-standard/base";
import { createCityQueue, newActionId, type ActionInput, type CityQueue, type Timers } from "./actions.js";
import type { Api, ApiResult } from "./api.js";
import { signIn } from "./signIn.js";

/** The session on this device: the token, the wallet and the player's id. Never the city. */
export const ACCOUNT_KEY = "brinelight-account-v1";

export const TEXT = {
  signInAgain: "Please sign in again",
  signedIn: "Signed in. Your city is saved on your account.",
  ownCity: "Your account has its own city. The city on this device stays here when you sign out.",
  signedOut: "Signed out. Your city stays on this device.",
} as const;

export type AccountStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type Saved = { token: string; wallet: string; playerId: string };

export type AccountDeps = {
  api: Api;
  store: AccountStore | null;
  toast(text: string, kind?: "" | "bad"): void;
  /** A clock that only moves forward, in ms (performance.now()). */
  mono(): number;
  /** This device's clock, in ms (Date.now()). */
  wall(): number;
  timers?: Timers;
  newId?(): string;
  warn?(message: string, details?: unknown): void;
  /** The session changed: signed in (the account's city is now played) or out (back to the city of this device). */
  onChange?(): void;
};

export type Account = ReturnType<typeof createAccount>;

/** A city nobody played yet on this device: nothing built, sent or spent. */
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

/** The session kept on this device. One without a player id (week 3) is forgotten: sign in again once. */
function readSaved(store: AccountStore | null): Saved | null {
  try {
    const raw = store?.getItem(ACCOUNT_KEY) ?? null;
    if (raw === null) return null;
    const o = JSON.parse(raw) as Partial<Saved> | null;
    if (o && typeof o.token === "string" && typeof o.wallet === "string" && typeof o.playerId === "string" && o.playerId) {
      return { token: o.token, wallet: o.wallet, playerId: o.playerId };
    }
    store?.removeItem(ACCOUNT_KEY);
  } catch {
    // Unreadable or blocked: no session.
  }
  return null;
}

const browserTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };

export function createAccount(deps: AccountDeps) {
  const { api, store } = deps;
  let saved = readSaved(store);
  let queue: CityQueue | null = null;

  const write = () => {
    try {
      if (saved) store?.setItem(ACCOUNT_KEY, JSON.stringify(saved));
      else store?.removeItem(ACCOUNT_KEY);
    } catch {
      // Storage full or blocked: the session lasts as long as the page.
    }
  };
  /** Forgets the session. The account's city stays on this device, with its waiting actions, under the player's id. */
  const forget = () => {
    queue?.stop();
    queue = null;
    saved = null;
    write();
    deps.onChange?.();
  };
  /** The account's city of this player: each copy is only ever sent with its own player's token. */
  const open = (s: Saved) => {
    queue?.stop();
    queue = createCityQueue({
      api,
      store,
      token: s.token,
      playerId: s.playerId,
      mono: deps.mono,
      wall: deps.wall,
      timers: deps.timers ?? browserTimers,
      newId: deps.newId ?? (() => newActionId()),
      toast: (text) => deps.toast(text, "bad"),
      warn: deps.warn ?? ((m, d) => console.warn(m, d ?? "")),
      signedOut: () => {
        forget();
        deps.toast(TEXT.signInAgain, "bad");
      },
    });
  };
  if (saved) open(saved);

  return {
    get signedIn(): boolean {
      return saved !== null;
    },
    get wallet(): string | null {
      return saved?.wallet ?? null;
    },
    /** The account's city as shown now; null when signed out. */
    city(): PlayerState | null {
      return queue?.city() ?? null;
    },
    /** The server's speed for the city's game time (1 in production). */
    get speed(): number {
      return queue?.speed ?? 1;
    },
    /** An action on the account's city: applied on screen at once, then sent. */
    act(input: ActionInput): ActionResult {
      return queue ? queue.act(input) : { ok: false, reason: TEXT.signInAgain };
    },
    /** On page load: with a session, the waiting actions are sent, or the server's city is asked for. */
    async start(): Promise<void> {
      await queue?.start();
    },
    /** `played`: a city was played on this device without an account (it stays there, untouched). */
    async signInWith(wallet: Wallet, page: { host: string; origin: string }, played = false): Promise<ApiResult<unknown>> {
      const r = await signIn(api, wallet, page);
      if (!r.ok) return r;
      saved = { token: r.data.token, wallet: r.data.wallet, playerId: r.data.playerId };
      write();
      open(saved);
      // The city is shown once the server has answered (or could not): actions kept for this account leave first.
      await queue?.start();
      if (!saved) return r;
      deps.onChange?.();
      deps.toast(played ? TEXT.ownCity : TEXT.signedIn);
      return r;
    },
    /** Signing out forgets the session, never a city: the account's city, and its waiting actions, stay here. */
    async signOut(): Promise<void> {
      const token = saved?.token;
      forget();
      deps.toast(TEXT.signedOut);
      if (token) await api.call("POST", "/auth/logout", { token });
    },
    /** The network is back, or the page is shown again. */
    wake(): void {
      queue?.wake();
    },
  };
}
