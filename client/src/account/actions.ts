/**
 * The account's city on this device: the server's last city, and the actions it has not answered yet.
 * - Actions go one at a time, in order: the next one leaves when the answer to the previous one has come.
 * - The city shown is the server's city, advanced by the time since its answer at the server's speed
 *   (never by comparing this device's clock with the server's), with the waiting actions applied on top.
 *   So an answer never makes a waiting action disappear, then come back.
 * - Kept on this device under the player's id, never mixed with the city played without an account.
 * Nothing here touches the browser: the API, the storage, the clocks and the timers are given.
 */
import { advance, applyAction, newPlayerState, parseAction, parseState, type ActionResult, type GameAction, type PlayerState } from "@brinelight/shared";
import { OFFLINE, SERVER_DOWN, TIMEOUT, type Api, type ApiResult } from "./api.js";

/** The account city of each player is kept under its own key, with the player's id. */
export const CITY_KEY_PREFIX = "brinelight-account-city-v1:";
export const cityKey = (playerId: string): string => `${CITY_KEY_PREFIX}${playerId}`;

/** At most this many actions wait for the server; beyond, a new action is refused. */
export const MAX_PENDING = 20;
/** Waits before sending again an action that got no answer: then 30 s each time. */
export const RETRY_MS = [1000, 2000, 5000, 10_000, 20_000, 30_000] as const;
/** A request without an answer in this time counts as no answer. */
export const REQUEST_TIMEOUT_MS = 10_000;
/** An action the server keeps failing (server_error) is dropped after this long, so the others can go. */
export const GIVE_UP_AFTER_MS = 3 * 60_000;
/**
 * An action sent without an answer may have been applied; the server forgets action ids after 7 days.
 * Past this age (since it was first sent), it is dropped rather than risk applying it twice.
 * An action never sent cannot have been applied: it is kept, however old.
 */
export const SENT_KEPT_MS = 6 * 24 * 3600_000;

export const QUEUE_TEXT = {
  full: "You are offline. Reconnect to keep playing.",
} as const;

/** The city as the server sent it, with its version, its time and its speed (DEV_SPEED, 1 in production). */
export type ServerCity = { state: PlayerState; version: number; asOf: string; speed: number };
/** An action waiting for the server; `firstSentAt` (this device's clock) once it has left at least once. */
export type Pending = { action: GameAction; firstSentAt: number | null };
/** An action as the game asks for it; its id is made here. */
export type ActionInput = { [K in GameAction["type"]]: Omit<Extract<GameAction, { type: K }>, "id"> }[GameAction["type"]];

export type Store = Pick<Storage, "getItem" | "setItem">;
export type Timers = { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void };

export type QueueDeps = {
  api: Api;
  store: Store | null;
  token: string;
  playerId: string;
  /** A clock that only moves forward, in ms (performance.now()): the time since an answer. */
  mono(): number;
  /** This device's clock, in ms (Date.now()): only ever compared with itself. */
  wall(): number;
  timers: Timers;
  newId(): string;
  /** A message for the player. */
  toast(text: string): void;
  /** A note for the developer (console). */
  warn(message: string, details?: unknown): void;
  /** The server says the session is over. */
  signedOut(): void;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads a city sent by the server, strictly: anything unexpected counts as no city. */
export function readServerCity(raw: unknown): ServerCity | null {
  if (!isObj(raw)) return null;
  const { version, asOf, speed } = raw;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) return null;
  if (typeof asOf !== "string" || typeof speed !== "number" || !Number.isFinite(speed) || speed <= 0) return null;
  const state = parseState(raw.state);
  return state ? { state, version, asOf, speed } : null;
}

type Copy = { server: ServerCity | null; receivedAt: number; pending: Pending[] };

/** The copy kept on this device for a player, read strictly; null when missing or unreadable. */
export function readCopy(store: Store | null, playerId: string): Copy | null {
  let o: unknown;
  try {
    o = JSON.parse(store?.getItem(cityKey(playerId)) ?? "null");
  } catch {
    return null;
  }
  if (!isObj(o) || o.v !== 1 || typeof o.receivedAt !== "number" || !Number.isFinite(o.receivedAt)) return null;
  const server = o.server === null ? null : readServerCity(o.server);
  if (o.server !== null && !server) return null;
  if (!Array.isArray(o.pending) || o.pending.length > MAX_PENDING) return null;
  const pending: Pending[] = [];
  for (const p of o.pending as unknown[]) {
    if (!isObj(p) || Object.keys(p).sort().join() !== "action,firstSentAt") return null;
    const action = parseAction(p.action);
    const at = p.firstSentAt;
    if (!action || !(at === null || (typeof at === "number" && Number.isFinite(at)))) return null;
    pending.push({ action, firstSentAt: at });
  }
  return { server, receivedAt: o.receivedAt, pending };
}

export type CityQueue = ReturnType<typeof createCityQueue>;

export function createCityQueue(deps: QueueDeps) {
  const { api, store, token, playerId, timers } = deps;
  /** Null until the server has sent a city: the account may have none yet. */
  let server: ServerCity | null = null;
  /** When the server's city was received: on the forward-only clock, and on this device's clock (for the copy). */
  let receivedMono = deps.mono();
  let receivedWall = deps.wall();
  let pending: Pending[] = [];
  /** A request on its way (an action or GET /city): only one at a time. */
  let busy = false;
  /** A GET /city is wanted once no action waits (an action's answer carries the city anyway). */
  let wantCity = false;
  /** A GET /city goes before the next action: after an action was dropped for server errors. */
  let refetch = false;
  let retry: unknown = null;
  let attempt = 0;
  /** Since when the action at the head keeps getting server errors (forward-only clock). */
  let failingSince: number | null = null;
  /** Signed out, or the server cannot read the city: nothing more is sent, with this reason. */
  let stopped: string | null = null;
  let active = true;

  const copy = readCopy(store, playerId);
  if (copy) {
    server = copy.server;
    receivedWall = copy.receivedAt;
    // Time passed since the copy was received, measured on this device's clock only.
    receivedMono = deps.mono() - Math.max(0, deps.wall() - copy.receivedAt);
    pending = copy.pending;
  } else if (store?.getItem(cityKey(playerId))) {
    deps.warn("The account city kept on this device could not be read; the server's city will replace it");
  }

  const persist = () => {
    try {
      store?.setItem(cityKey(playerId), JSON.stringify({ v: 1, server, receivedAt: receivedWall, pending }));
    } catch {
      // Storage full or blocked: the city stays on the server, the waiting actions in this page.
    }
  };
  /** Takes a city from the server; an older version (a late answer) never replaces a newer one. */
  const take = (c: ServerCity | null) => {
    if (!c || (server && c.version < server.version)) return;
    server = c;
    receivedMono = deps.mono();
    receivedWall = deps.wall();
  };

  function city(): PlayerState {
    // No city on the server yet: the new city it will make at the first action, which does not move until then.
    const base = server ? advance(server.state, (Math.max(0, deps.mono() - receivedMono) / 1000) * server.speed) : newPlayerState();
    // An action the rules refuse on the latest city stays in the queue, not on screen: the server will decide.
    return pending.reduce((s, p) => {
      const r = applyAction(s, p.action);
      return r.ok ? r.state : s;
    }, base);
  }

  function retryLater(): void {
    const ms = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]!;
    attempt++;
    retry = timers.set(() => {
      retry = null;
      void pump();
    }, ms);
  }

  /** The action at the head got its answer: the next one can go. */
  function done(): void {
    pending.shift();
    attempt = 0;
    failingSince = null;
  }

  /** True when the action was sent long ago without an answer (see SENT_KEPT_MS). Only the head is ever sent. */
  const stale = (p: Pending | undefined): p is Pending => p?.firstSentAt != null && deps.wall() - p.firstSentAt > SENT_KEPT_MS;

  /** Sends what comes next, if nothing is on its way. Resolves when that one request has its answer. */
  function pump(): Promise<void> {
    if (!active || stopped !== null || busy || retry !== null) return Promise.resolve();
    while (stale(pending[0])) {
      deps.warn("An action sent more than 6 days ago without an answer was dropped", pending[0].action);
      done();
      persist();
    }
    if (refetch) return fetchCity();
    const head = pending[0];
    if (head) return sendAction(head);
    if (wantCity) return fetchCity();
    return Promise.resolve();
  }

  async function sendAction(p: Pending): Promise<void> {
    busy = true;
    if (p.firstSentAt === null) {
      p.firstSentAt = deps.wall();
      persist();
    }
    // keepalive: if the page goes away meanwhile, the action still reaches the server; it is sent again, with
    // the same id, at the next visit, and the server answers that it was already applied.
    const r = await api.call<unknown>("POST", "/city/actions", { token, body: { action: p.action }, keepalive: true, timeoutMs: REQUEST_TIMEOUT_MS });
    busy = false;
    if (!active) return;
    if (pending[0] === p) answered(p, r);
    void pump();
  }

  function answered(p: Pending, r: ApiResult<unknown>): void {
    if (r.ok) {
      const c = readServerCity(r.data);
      if (!c) return serverError(p, SERVER_DOWN.error);
      done();
      take(c);
      wantCity = false;
      persist();
      return;
    }
    switch (r.code) {
      case "rule_refused":
        done();
        take(readServerCity(r.body));
        persist();
        deps.toast(r.error);
        return;
      case "invalid_action":
      case "action_id_reused":
      case "action_too_large":
        deps.warn(`The server dropped an action (${r.code})`, p.action);
        done();
        take(readServerCity(r.body));
        persist();
        return;
      case "signed_out":
        stopped = r.error;
        return deps.signedOut();
      case "unreadable_city":
        // Sending again cannot fix it: nothing more goes out, the waiting actions stay on this device.
        stopped = r.error;
        return deps.toast(r.error);
      case OFFLINE:
      case TIMEOUT:
      case "too_many_actions":
        // No answer: the same action, with the same id, a little later.
        failingSince = null;
        return retryLater();
      default:
        return serverError(p, r.error);
    }
  }

  /** A server error, or a code this client does not know: as no answer, until it has lasted GIVE_UP_AFTER_MS. */
  function serverError(p: Pending, error: string): void {
    const at = deps.mono();
    failingSince ??= at;
    if (at - failingSince < GIVE_UP_AFTER_MS) return retryLater();
    deps.warn("The server failed on an action for 3 minutes: it was dropped", p.action);
    done();
    persist();
    refetch = true;
    deps.toast(error || SERVER_DOWN.error);
  }

  async function fetchCity(): Promise<void> {
    busy = true;
    const r = await api.call<unknown>("GET", "/city", { token, timeoutMs: REQUEST_TIMEOUT_MS });
    busy = false;
    if (!active) return;
    if (r.ok) {
      // Until GET /city makes the city itself (week 4, task 4), an account without one answers { city: null }.
      const none = isObj(r.data) && r.data.city === null;
      const c = readServerCity(r.data);
      if (none || c) {
        take(c);
        wantCity = false;
        refetch = false;
        attempt = 0;
        persist();
        void pump();
        return;
      }
    } else if (r.code === "signed_out") {
      stopped = r.error;
      return deps.signedOut();
    } else if (r.code === "unreadable_city") {
      stopped = r.error;
      return deps.toast(r.error);
    }
    // No answer, a server error or an unreadable city: nothing can be lost by asking again later.
    retryLater();
  }

  return {
    /** The city to show now. */
    city,
    /** How much faster than real time the server runs a city's game time (1 in production). */
    get speed(): number {
      return server?.speed ?? 1;
    },
    get pendingCount(): number {
      return pending.length;
    },
    /** The server has sent a city, now or before (kept on this device). */
    get hasCity(): boolean {
      return server !== null;
    },
    /** Applied at once on the city shown, then sent; refused here with the rule's reason, or when too many wait. */
    act(input: ActionInput): ActionResult {
      if (stopped !== null) return { ok: false, reason: stopped };
      if (pending.length >= MAX_PENDING) return { ok: false, reason: QUEUE_TEXT.full };
      const action = { ...input, id: deps.newId() } as GameAction;
      const r = applyAction(city(), action);
      if (!r.ok) return r;
      pending.push({ action, firstSentAt: null });
      persist();
      void pump();
      return { ok: true, state: city() };
    },
    /** Starts: waiting actions are sent, or the server's city is asked for. Resolves after the first answer. */
    start(): Promise<void> {
      wantCity = true;
      return pump();
    },
    /** The network is back, or the page is shown again: try now, and ask for the latest city if nothing waits. */
    wake(): void {
      if (!active || stopped !== null) return;
      if (!pending.length && !busy) wantCity = true;
      if (retry !== null) {
        timers.clear(retry);
        retry = null;
      }
      void pump();
    },
    /** Signed out: nothing more is sent or shown; the copy stays on this device, with its waiting actions. */
    stop(): void {
      active = false;
      if (retry !== null) timers.clear(retry);
      retry = null;
    },
  };
}

/** A version 4 UUID, made with crypto.getRandomValues (crypto.randomUUID needs https, getRandomValues does not). */
export function newActionId(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const b = random(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
