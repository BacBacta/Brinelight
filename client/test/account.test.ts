import { HOUR, advance, applyAction, newPlayerState, parseAction, upgrade, type GameAction, type PlayerState } from "@brinelight/shared";
import type { Wallet } from "@wallet-standard/base";
import { describe, expect, it } from "vitest";
import {
  GIVE_UP_AFTER_MS,
  MAX_PENDING,
  QUEUE_TEXT,
  RETRY_MS,
  SENT_KEPT_MS,
  cityKey,
  createCityQueue,
  newActionId,
  readCopy,
  type ActionInput,
} from "../src/account/actions.js";
import { OFFLINE, TIMEOUT, createApi, type Api, type ApiResult, type CallOptions } from "../src/account/api.js";
import { ACCOUNT_KEY, TEXT, createAccount, isUntouched, type AccountStore } from "../src/account/index.js";
import { PROFILE_TEXT, profileHtml, shortAddress } from "../src/account/profile.js";
import { CANCELLED, signIn } from "../src/account/signIn.js";
import { NO_SIGN_IN, SIGN_IN, isPhone, phantomLink, type SignInInput } from "../src/account/wallets.js";
import { SAVE_KEY } from "../src/state/save.js";

const memoryStore = (): AccountStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

type Call = { method: string; path: string } & CallOptions;
type Route = (c: Call) => ApiResult<unknown> | Promise<ApiResult<unknown>>;
/** A server that answers from a script: one function per route, called with each request. */
function fakeApi(routes: Record<string, Route>): Api & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async call<T>(method: string, path: string, o: CallOptions = {}) {
      const c = { method, path, ...o };
      calls.push(c);
      const r = routes[`${method} ${path}`];
      return (await (r ? r(c) : { ok: false, code: OFFLINE, error: "" })) as ApiResult<T>;
    },
  };
}
const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data });
const no = (code: string, error = `text of ${code}`, city?: object): ApiResult<never> => ({ ok: false, code, error, ...(city ? { body: { code, error, ...city } } : {}) });
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const flush = () => new Promise((r) => setTimeout(r, 0));

/** An answer held until the test lets it go. */
function held<T>() {
  let release!: (v: T) => void;
  const promise = new Promise<T>((r) => (release = r));
  return { promise, release };
}

/** Both clocks of the page (forward-only and device), and timers that run only when the test moves time on. */
function fakeClock() {
  let mono = 5_000;
  let wall = Date.parse("2026-10-16T12:00:00.000Z");
  let next = 1;
  const due: { at: number; fn: () => void; id: number }[] = [];
  return {
    mono: () => mono,
    wall: () => wall,
    timers: {
      set: (fn: () => void, ms: number) => {
        due.push({ at: mono + ms, fn, id: next });
        return next++;
      },
      clear: (h: unknown) => {
        const i = due.findIndex((d) => d.id === h);
        if (i >= 0) due.splice(i, 1);
      },
    },
    /** Real time passes: both clocks move on, and timers that come due run. */
    async pass(ms: number) {
      const end = mono + ms;
      for (;;) {
        // Answers already on their way come first: they may set the next timer.
        await flush();
        due.sort((a, b) => a.at - b.at);
        const d = due[0];
        if (!d || d.at > end) break;
        due.shift();
        wall += d.at - mono;
        mono = d.at;
        d.fn();
        await flush();
      }
      wall += end - mono;
      mono = end;
      await flush();
    },
    /** Only the device clock moves (set by hand, or a page reloaded later). */
    moveWall: (ms: number) => (wall += ms),
    waits: () => due.map((d) => d.at - mono),
  };
}
type Clock = ReturnType<typeof fakeClock>;

const TOKEN = "T".repeat(43);
const ASOF = "2026-10-16T12:00:00.000Z";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sent = (api: { calls: Call[] }) => api.calls.filter((c) => c.path === "/city/actions").map((c) => (c.body as { action: GameAction }).action);
const queued = (s: PlayerState) => s.queue.map((j) => j.id).sort();

/** A server that applies actions with the shared rules, without time passing. */
function fakeServer(start: PlayerState = newPlayerState(), speed = 1) {
  let state = start;
  let version = 1;
  const city = () => ({ state: json(state), version, asOf: ASOF, speed });
  const routes: Record<string, Route> = {
    "GET /city": () => ok(city()),
    "POST /city/actions": (c) => {
      const r = applyAction(state, (c.body as { action: GameAction }).action);
      if (!r.ok) return no("rule_refused", r.reason, city());
      if (r.state !== state) {
        state = r.state;
        version++;
      }
      return ok(city());
    },
  };
  return {
    routes,
    city,
    get state() {
      return state;
    },
    get version() {
      return version;
    },
  };
}

function queueSetup(routes: Record<string, Route>, opts: { store?: ReturnType<typeof memoryStore>; clock?: Clock; playerId?: string } = {}) {
  const api = fakeApi(routes);
  const store = opts.store ?? memoryStore();
  const clock = opts.clock ?? fakeClock();
  const toasts: string[] = [];
  const warnings: string[] = [];
  let signedOut = 0;
  let ids = 0;
  const q = createCityQueue({
    api,
    store,
    token: TOKEN,
    playerId: opts.playerId ?? "p1",
    mono: clock.mono,
    wall: clock.wall,
    timers: clock.timers,
    newId: () => uuid(++ids),
    toast: (t) => toasts.push(t),
    warn: (m) => warnings.push(m),
    signedOut: () => signedOut++,
  });
  return { api, store, clock, toasts, warnings, q, signedOut: () => signedOut };
}

const UP_REFINERY: ActionInput = { type: "upgrade", building: "refinery" };
const UP_FISHERY: ActionInput = { type: "upgrade", building: "fishery" };
const UP_LUMBERYARD: ActionInput = { type: "upgrade", building: "lumberyard" };

const WALLET = "7Hc3wTfa1Xp9Q2LmWbR8sKdN4vYzE6uJ5gA1oCiF3tPq";
const PAGE = { host: "brinelight.pages.dev", origin: "https://brinelight.pages.dev" };
const verified = ok({ token: TOKEN, expiresAt: "2026-11-14T12:00:00.000Z", player: { id: "p1", wallet: WALLET } });

function fakeWallet(opts: { signIn?: boolean; refuse?: boolean; address?: string } = {}): Wallet & { inputs: SignInInput[] } {
  const inputs: SignInInput[] = [];
  const account = { address: opts.address ?? WALLET, publicKey: new Uint8Array(32), chains: ["solana:mainnet"] as const, features: [SIGN_IN] as const };
  const features: Record<string, unknown> = {
    "solana:signMessage": { version: "1.0.0", signMessage: () => Promise.reject(new Error("never used")) },
  };
  if (opts.signIn !== false) {
    features[SIGN_IN] = {
      version: "1.0.0",
      signIn: async (input: SignInInput) => {
        inputs.push(input);
        if (opts.refuse) throw new Error("User rejected the request.");
        return [{ account, signedMessage: new Uint8Array([104, 105]), signature: new Uint8Array(64).fill(7) }];
      },
    };
  }
  return { version: "1.0.0", name: "Test Wallet", icon: "data:image/svg+xml;base64,AA==", chains: ["solana:mainnet"], accounts: [account], features, inputs } as unknown as Wallet & {
    inputs: SignInInput[];
  };
}

describe("api", () => {
  it("sends the token and the body, and keeps the server's code, text and body of a refusal", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const answer = { code: "rule_refused", error: "Not enough resources", state: { x: 1 }, version: 3 };
    const fetchFn = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response(JSON.stringify(answer), { status: 422 });
    }) as typeof fetch;
    const r = await createApi("http://api.test", fetchFn).call("POST", "/city/actions", { token: "abc", body: { action: 1 }, keepalive: true });
    expect(r).toEqual({ ok: false, code: "rule_refused", error: "Not enough resources", body: answer });
    expect(seen[0]!.url).toBe("http://api.test/city/actions");
    expect(seen[0]!.init).toMatchObject({ method: "POST", body: '{"action":1}', keepalive: true, headers: { authorization: "Bearer abc", "content-type": "application/json" } });
  });

  it("no network, or an answer cut before its end, gives the code offline; an answer without a code is a server error", async () => {
    const down = (async () => Promise.reject(new TypeError("Failed to fetch"))) as typeof fetch;
    expect(await createApi("http://api.test", down).call("GET", "/city")).toEqual({ ok: false, code: OFFLINE, error: "" });
    const cut = (async () => new Response('{"vers', { status: 200 })) as typeof fetch;
    expect(await createApi("http://api.test", cut).call("GET", "/city")).toEqual({ ok: false, code: OFFLINE, error: "" });
    const html = (async () => new Response("<h1>Bad gateway</h1>", { status: 502 })) as typeof fetch;
    expect(await createApi("http://api.test", html).call("GET", "/city")).toMatchObject({ ok: false, code: "server_error" });
  });

  it("no answer in time: the request is dropped, with the code timeout", async () => {
    let signal: AbortSignal | undefined;
    const slow = ((_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    }) as typeof fetch;
    expect(await createApi("http://api.test", slow).call("GET", "/city", { timeoutMs: 20 })).toEqual({ ok: false, code: TIMEOUT, error: "" });
    expect(signal?.aborted).toBe(true);
  });
});

describe("sign-in with the wallet", () => {
  const NONCE = { nonce: "0123456789abcdef0123456789abcdef", issuedAt: "2026-10-15T12:00:00.000Z", expiresAt: "2026-10-15T12:05:00.000Z", chainId: "mainnet", statement: "Sign in." };

  it("passes the server's nonce, time, network and statement to solana:signIn, then sends the signed bytes; keeps the player's id", async () => {
    const wallet = fakeWallet();
    const api = fakeApi({ "POST /auth/nonce": () => ok(NONCE), "POST /auth/verify": () => verified });
    const r = await signIn(api, wallet, PAGE);
    expect(r).toEqual({ ok: true, data: { token: TOKEN, wallet: WALLET, playerId: "p1", expiresAt: "2026-11-14T12:00:00.000Z" } });
    expect(wallet.inputs).toEqual([
      { domain: PAGE.host, statement: "Sign in.", uri: PAGE.origin, version: "1", chainId: "mainnet", nonce: NONCE.nonce, issuedAt: NONCE.issuedAt, expirationTime: NONCE.expiresAt },
    ]);
    expect(api.calls[1]!.body).toEqual({ address: WALLET, signedMessage: "aGk=", signature: Buffer.alloc(64, 7).toString("base64") });
  });

  it("a wallet without solana:signIn is refused, even if it can sign messages", async () => {
    const api = fakeApi({});
    expect(await signIn(api, fakeWallet({ signIn: false }), PAGE)).toEqual({ ok: false, code: "no_sign_in", error: NO_SIGN_IN });
    expect(api.calls).toEqual([]);
  });

  it("saying no in the wallet cancels, without asking the server to verify anything", async () => {
    const api = fakeApi({ "POST /auth/nonce": () => ok(NONCE) });
    expect(await signIn(api, fakeWallet({ refuse: true }), PAGE)).toEqual({ ok: false, code: "cancelled", error: CANCELLED });
    expect(api.calls.map((c) => c.path)).toEqual(["/auth/nonce"]);
  });
});

describe("the account's actions", () => {
  it("an action is shown at once, then sent with its id, the token and keepalive; the answer's city takes its place", async () => {
    const server = fakeServer();
    const t = queueSetup(server.routes);
    await t.q.start();
    const r = t.q.act(UP_REFINERY);
    expect(r.ok && queued(r.state)).toEqual(["refinery"]);
    expect(queued(t.q.city())).toEqual(["refinery"]);
    await flush();
    const call = t.api.calls.at(-1)!;
    expect(call).toMatchObject({ method: "POST", path: "/city/actions", token: TOKEN, keepalive: true, timeoutMs: 10_000 });
    expect(call.body).toEqual({ action: { type: "upgrade", building: "refinery", id: uuid(1) } });
    expect(parseAction((call.body as { action: unknown }).action)).not.toBeNull();
    expect(t.q.pendingCount).toBe(0);
    expect(t.q.city()).toEqual(server.state);
  });

  it("one action on its way at a time: the next leaves when the answer to the previous one has come, in order", async () => {
    const server = fakeServer();
    const gates: ReturnType<typeof held<ApiResult<unknown>>>[] = [];
    const t = queueSetup({
      ...server.routes,
      "POST /city/actions": (c) => {
        const g = held<ApiResult<unknown>>();
        gates.push(g);
        return g.promise.then(() => server.routes["POST /city/actions"]!(c));
      },
    });
    await t.q.start();
    t.q.act(UP_REFINERY);
    t.q.act(UP_FISHERY);
    await flush();
    expect(sent(t.api).map((a) => a.id)).toEqual([uuid(1)]);
    gates[0]!.release(ok(null));
    await flush();
    expect(sent(t.api).map((a) => a.id)).toEqual([uuid(1), uuid(2)]);
    gates[1]!.release(ok(null));
    await flush();
    expect(server.version).toBe(3);
    expect(queued(server.state)).toEqual(["fishery", "refinery"]);
  });

  it("between two answers, a waiting action stays on screen: the first answer never makes the second upgrade disappear", async () => {
    const server = fakeServer();
    const gates: ReturnType<typeof held<ApiResult<unknown>>>[] = [];
    const t = queueSetup({
      ...server.routes,
      "POST /city/actions": (c) => {
        const g = held<ApiResult<unknown>>();
        gates.push(g);
        return g.promise.then(() => server.routes["POST /city/actions"]!(c));
      },
    });
    await t.q.start();
    t.q.act(UP_REFINERY);
    t.q.act(UP_FISHERY);
    const seen: string[][] = [queued(t.q.city())];
    gates[0]!.release(ok(null));
    await flush();
    seen.push(queued(t.q.city()));
    gates[1]!.release(ok(null));
    await flush();
    seen.push(queued(t.q.city()));
    expect(seen).toEqual([
      ["fishery", "refinery"],
      ["fishery", "refinery"],
      ["fishery", "refinery"],
    ]);
  });

  it("the city shown is the server's, advanced by the time since its answer at the server's speed; the device clock does not count", async () => {
    const server = fakeServer(newPlayerState(), 60);
    const t = queueSetup(server.routes);
    await t.q.start();
    expect(t.q.speed).toBe(60);
    const at = server.state;
    t.clock.moveWall(5 * HOUR * 1000);
    expect(t.q.city()).toEqual(json(at));
    await t.clock.pass(60_000);
    expect(t.q.city()).toEqual(advance(json(at), HOUR));
  });

  it("an action the rules refuse here is never sent: the reason of the rule", async () => {
    const t = queueSetup(fakeServer().routes);
    await t.q.start();
    t.q.act(UP_REFINERY);
    t.q.act(UP_FISHERY);
    await t.clock.pass(10);
    expect(t.q.act(UP_LUMBERYARD)).toEqual({ ok: false, reason: "Your 2 builders are busy" });
    await flush();
    expect(sent(t.api)).toHaveLength(2);
  });

  it("no answer (no network, or nothing within 10 s) or too_many_actions: the same action, same id, after 1, 2, 5, 10, 20, then 30 s", async () => {
    const answers = [no(OFFLINE, ""), no(TIMEOUT, ""), no("too_many_actions"), no(OFFLINE, ""), no(OFFLINE, ""), no(OFFLINE, ""), no(OFFLINE, "")];
    const server = fakeServer();
    const t = queueSetup({ ...server.routes, "POST /city/actions": (c) => answers.shift() ?? server.routes["POST /city/actions"]!(c) });
    await t.q.start();
    t.q.act(UP_REFINERY);
    await flush();
    const waits: number[] = [];
    for (let i = 0; i < 7; i++) {
      waits.push(t.clock.waits()[0]!);
      await t.clock.pass(t.clock.waits()[0]!);
    }
    expect(waits).toEqual([...RETRY_MS, 30_000]);
    expect(new Set(sent(t.api).map((a) => a.id))).toEqual(new Set([uuid(1)]));
    expect(sent(t.api)).toHaveLength(8);
    expect(t.q.pendingCount).toBe(0);
    expect(server.version).toBe(2);
    expect(t.toasts).toEqual([]);
  });

  it("the network back, or the page shown again: the waiting action leaves at once", async () => {
    let online = false;
    const server = fakeServer();
    const t = queueSetup({ ...server.routes, "POST /city/actions": (c) => (online ? server.routes["POST /city/actions"]!(c) : no(OFFLINE, "")) });
    await t.q.start();
    t.q.act(UP_REFINERY);
    await t.clock.pass(1000);
    expect(t.clock.waits()).toEqual([2000]);
    online = true;
    t.q.wake();
    await flush();
    expect(t.q.pendingCount).toBe(0);
    expect(t.clock.waits()).toEqual([]);
  });

  it("rule_refused: the server's city comes back, the next actions are applied again on it, and the toast says why", async () => {
    const server = fakeServer();
    let first = true;
    const t = queueSetup({
      ...server.routes,
      "POST /city/actions": (c) => {
        if (!first) return server.routes["POST /city/actions"]!(c);
        first = false;
        return no("rule_refused", "Not enough resources", server.city());
      },
    });
    await t.q.start();
    t.q.act(UP_REFINERY);
    t.q.act(UP_FISHERY);
    await flush();
    await flush();
    expect(t.toasts).toEqual(["Not enough resources"]);
    expect(queued(t.q.city())).toEqual(["fishery"]);
    expect(queued(server.state)).toEqual(["fishery"]);
    expect(t.q.pendingCount).toBe(0);
  });

  it("invalid_action, action_id_reused and action_too_large: the action is dropped and written to the console, the server's city is taken", async () => {
    for (const code of ["invalid_action", "action_id_reused", "action_too_large"]) {
      const server = fakeServer();
      // action_too_large comes without a city: the last one received stays.
      const answer = code === "action_too_large" ? no(code) : no(code, "x", server.city());
      let first = true;
      const t = queueSetup({
        ...server.routes,
        "POST /city/actions": (c) => {
          if (!first) return server.routes["POST /city/actions"]!(c);
          first = false;
          return answer;
        },
      });
      await t.q.start();
      t.q.act(UP_REFINERY);
      t.q.act(UP_FISHERY);
      await flush();
      await flush();
      expect(t.warnings, code).toEqual([`The server dropped an action (${code})`]);
      expect(t.toasts, code).toEqual([]);
      expect(queued(t.q.city()), code).toEqual(["fishery"]);
      expect(t.q.pendingCount, code).toBe(0);
    }
  });

  it("server_error or a code this client does not know: as no answer, same id; dropped only after 3 minutes of errors, then the city is asked for and the toast shown", async () => {
    const server = fakeServer();
    let failing = true;
    const t = queueSetup({
      ...server.routes,
      "POST /city/actions": (c) =>
        failing ? (sent(t.api).length % 2 ? no("server_error", "Something went wrong on the server. Please try again") : no("database_restarting")) : server.routes["POST /city/actions"]!(c),
    });
    await t.q.start();
    t.q.act(UP_REFINERY);
    t.q.act(UP_FISHERY);
    await flush();
    // Errors at 0, 1, 3, 8, 18, 38, 68, 98, 128, 158 s, then 188 s: the first one past 3 minutes drops the action.
    await t.clock.pass(187_000);
    expect(GIVE_UP_AFTER_MS).toBe(180_000);
    expect(t.q.pendingCount).toBe(2);
    expect(new Set(sent(t.api).map((a) => a.id))).toEqual(new Set([uuid(1)]));
    expect(t.toasts).toEqual([]);
    await t.clock.pass(1000);
    expect(t.q.pendingCount).toBe(1);
    expect(t.warnings).toEqual(["The server failed on an action for 3 minutes: it was dropped"]);
    expect(t.toasts).toEqual(["Something went wrong on the server. Please try again"]);
    // The server's city is asked for first, then the next action goes.
    const after = t.api.calls.slice(-2).map((c) => `${c.method} ${c.path} ${(c.body as { action?: GameAction } | undefined)?.action?.id ?? ""}`.trim());
    expect(after).toEqual(["GET /city", `POST /city/actions ${uuid(2)}`]);
    failing = false;
    await t.clock.pass(1000);
    expect(t.q.pendingCount).toBe(0);
    expect(queued(server.state)).toEqual(["fishery"]);
  });

  it("a database restart: errors, then no answer, then errors again; the run of errors starts again, and the action is applied", async () => {
    const server = fakeServer();
    const t0 = { n: 0 };
    const t = queueSetup({
      ...server.routes,
      "POST /city/actions": (c) => {
        t0.n++;
        if (t0.n <= 8) return no("server_error");
        if (t0.n === 9) return no(OFFLINE, "");
        if (t0.n <= 12) return no("server_error");
        return server.routes["POST /city/actions"]!(c);
      },
    });
    await t.q.start();
    t.q.act(UP_REFINERY);
    await t.clock.pass(10 * 60_000);
    expect(t.warnings).toEqual([]);
    expect(t.q.pendingCount).toBe(0);
    expect(queued(server.state)).toEqual(["refinery"]);
  });

  it("signed_out: nothing more is sent, and the waiting actions stay in the copy", async () => {
    const t = queueSetup({ "GET /city": () => no("signed_out", "Please sign in again"), "POST /city/actions": () => no("signed_out", "Please sign in again") });
    t.q.act(UP_REFINERY);
    await flush();
    expect(t.signedOut()).toBe(1);
    await t.clock.pass(60_000);
    expect(sent(t.api)).toHaveLength(1);
    expect(readCopy(t.store, "p1")?.pending.map((p) => p.action.id)).toEqual([uuid(1)]);
  });

  it("unreadable_city: nothing more is sent, the toast says why, and the waiting actions stay", async () => {
    const t = queueSetup({ "GET /city": () => no("unreadable_city", "Your saved city could not be read"), "POST /city/actions": () => no("unreadable_city", "Your saved city could not be read") });
    t.q.act(UP_REFINERY);
    await flush();
    expect(t.toasts).toEqual(["Your saved city could not be read"]);
    await t.clock.pass(60_000);
    expect(sent(t.api)).toHaveLength(1);
    expect(t.q.pendingCount).toBe(1);
    expect(t.q.act(UP_FISHERY)).toEqual({ ok: false, reason: "Your saved city could not be read" });
  });

  it(`at most ${MAX_PENDING} actions wait: then "${QUEUE_TEXT.full}"`, async () => {
    const t = queueSetup({});
    // Reading a report that is gone changes nothing: the rules accept it every time.
    for (let i = 0; i < MAX_PENDING; i++) expect(t.q.act({ type: "readReport", reportId: `r${i + 1}` }).ok).toBe(true);
    expect(t.q.act(UP_REFINERY)).toEqual({ ok: false, reason: QUEUE_TEXT.full });
    expect(t.q.pendingCount).toBe(MAX_PENDING);
  });

  it("an older city (a late answer) never replaces a newer one", async () => {
    const server = fakeServer();
    const late = held<ApiResult<unknown>>();
    let gets = 0;
    const t = queueSetup({ ...server.routes, "GET /city": () => (++gets === 2 ? late.promise : server.routes["GET /city"]!({ method: "GET", path: "/city" })) });
    await t.q.start();
    t.q.wake();
    const old = server.city();
    await flush();
    // The page is shown again: GET /city leaves; its answer arrives after a newer city.
    late.release(ok({ ...old, version: 0 }));
    await flush();
    expect(t.q.city()).toEqual(old.state);
  });

  it("at start: the waiting actions go first; with none, the server's city is asked for", async () => {
    const server = fakeServer();
    const t = queueSetup(server.routes);
    await t.q.start();
    expect(t.api.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /city"]);
    t.q.act(UP_REFINERY);
    await flush();
    const again = queueSetup(server.routes, { store: t.store });
    expect(again.q.pendingCount).toBe(0);
    const store = memoryStore();
    store.setItem(cityKey("p1"), JSON.stringify({ v: 1, server: server.city(), receivedAt: Date.parse(ASOF), pending: [{ action: { id: uuid(9), type: "upgrade", building: "fishery" }, firstSentAt: null }] }));
    const loaded = queueSetup(server.routes, { store });
    await loaded.q.start();
    expect(loaded.api.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /city/actions"]);
    expect(queued(server.state)).toEqual(["fishery", "refinery"]);
  });

  it("an account the server has no city for yet ({ city: null }): a new city that does not move until the first action", async () => {
    const server = fakeServer();
    const t = queueSetup({ ...server.routes, "GET /city": () => ok({ city: null }) });
    await t.q.start();
    expect(t.q.hasCity).toBe(false);
    await t.clock.pass(HOUR * 1000);
    expect(t.q.city()).toEqual(newPlayerState());
    t.q.act(UP_REFINERY);
    await flush();
    expect(t.q.hasCity).toBe(true);
  });
});

describe("the account's copy on this device", () => {
  it("is kept under the player's id: the server's city, when it came, and the waiting actions with their first send", async () => {
    const server = fakeServer();
    const t = queueSetup({ ...server.routes, "POST /city/actions": () => no(OFFLINE, "") });
    await t.q.start();
    t.q.act(UP_REFINERY);
    t.q.act(UP_FISHERY);
    await flush();
    const copy = JSON.parse(t.store.getItem(cityKey("p1"))!);
    expect(copy).toEqual({
      v: 1,
      server: server.city(),
      receivedAt: t.clock.wall(),
      pending: [
        { action: { type: "upgrade", building: "refinery", id: uuid(1) }, firstSentAt: t.clock.wall() },
        { action: { type: "upgrade", building: "fishery", id: uuid(2) }, firstSentAt: null },
      ],
    });
    expect([...t.store.data.keys()]).toEqual([cityKey("p1")]);
  });

  it("read again after a reload: the same city, advanced by the time since its answer on this device's clock, and the actions sent with their ids", async () => {
    const server = fakeServer();
    const clock = fakeClock();
    const t = queueSetup({ ...server.routes, "POST /city/actions": () => no(OFFLINE, "") }, { clock });
    await t.q.start();
    t.q.act(UP_REFINERY);
    await flush();
    t.q.stop();
    // The page is reloaded 2 hours later: the forward-only clock starts again, the device clock goes on.
    const later = fakeClock();
    later.moveWall(clock.wall() - later.wall() + 2 * HOUR * 1000);
    const back = queueSetup(server.routes, { store: t.store, clock: later });
    const r = upgrade(advance(json(server.city().state), 2 * HOUR), "refinery");
    expect(back.q.city()).toEqual(r.ok && r.state);
    await back.q.start();
    expect(sent(back.api).map((a) => a.id)).toEqual([uuid(1)]);
    expect(queued(server.state)).toEqual(["refinery"]);
  });

  it("a copy that cannot be read is left aside, with a note in the console: the server's city replaces it", async () => {
    const server = fakeServer();
    for (const bad of ["{", JSON.stringify({ v: 1, server: { state: { broken: true }, version: 1, asOf: ASOF, speed: 1 }, receivedAt: 0, pending: [] }), JSON.stringify({ v: 1, server: null, receivedAt: 0, pending: [{ action: { type: "upgrade" }, firstSentAt: null }] })]) {
      const store = memoryStore();
      store.setItem(cityKey("p1"), bad);
      const t = queueSetup(server.routes, { store });
      expect(t.warnings).toEqual(["The account city kept on this device could not be read; the server's city will replace it"]);
      await t.q.start();
      expect(t.q.city()).toEqual(server.state);
    }
  });

  it("an action sent more than 6 days ago without an answer is dropped (it may have been applied); one never sent is kept, however old", async () => {
    const server = fakeServer();
    const clock = fakeClock();
    const at = clock.wall();
    const copy = (firstSentAt: number | null) =>
      JSON.stringify({ v: 1, server: server.city(), receivedAt: at, pending: [{ action: { id: uuid(7), type: "upgrade", building: "refinery" }, firstSentAt }] });
    const store = memoryStore();
    store.setItem(cityKey("p1"), copy(at - SENT_KEPT_MS - 1));
    const old = queueSetup(server.routes, { store, clock });
    await old.q.start();
    expect(sent(old.api)).toEqual([]);
    expect(old.warnings).toEqual(["An action sent more than 6 days ago without an answer was dropped"]);
    store.setItem(cityKey("p1"), copy(null));
    clock.moveWall(30 * 24 * HOUR * 1000);
    const never = queueSetup(server.routes, { store, clock });
    await never.q.start();
    expect(sent(never.api).map((a) => a.id)).toEqual([uuid(7)]);
  });

  it("each player has a copy of their own, never mixed with the city of this device", async () => {
    const store = memoryStore();
    store.setItem(SAVE_KEY, "the city of this device");
    const a = queueSetup(fakeServer().routes, { store, playerId: "p1" });
    const b = queueSetup(fakeServer().routes, { store, playerId: "p2" });
    await a.q.start();
    await b.q.start();
    a.q.act(UP_REFINERY);
    await flush();
    expect(store.getItem(SAVE_KEY)).toBe("the city of this device");
    expect(queued(readCopy(store, "p1")!.server!.state)).toEqual(["refinery"]);
    expect(queued(readCopy(store, "p2")!.server!.state)).toEqual([]);
  });

  it("action ids: version 4 UUIDs that the server reads", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newActionId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(parseAction({ id, type: "upgrade", building: "refinery" })).not.toBeNull();
    expect(newActionId((b) => b.fill(0))).toBe("00000000-0000-4000-8000-000000000000");
    expect(newActionId((b) => b.fill(255))).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });
});

describe("the account", () => {
  function accountSetup(routes: Record<string, Route>, store = memoryStore()) {
    const api = fakeApi(routes);
    const clock = fakeClock();
    const toasts: string[] = [];
    let changes = 0;
    let ids = 0;
    const account = createAccount({
      api,
      store,
      toast: (t) => toasts.push(t),
      mono: clock.mono,
      wall: clock.wall,
      timers: clock.timers,
      newId: () => uuid(++ids),
      warn: () => undefined,
      onChange: () => changes++,
    });
    return { api, store, clock, toasts, account, changes: () => changes };
  }
  const signInRoutes = (server: ReturnType<typeof fakeServer>, player = { id: "p1", wallet: WALLET }, token = TOKEN): Record<string, Route> => ({
    ...server.routes,
    "POST /auth/nonce": () => ok({ nonce: "0123456789abcdef0123456789abcdef", issuedAt: ASOF, expiresAt: ASOF, chainId: "mainnet", statement: "Sign in." }),
    "POST /auth/verify": () => ok({ token, expiresAt: "2026-11-14T12:00:00.000Z", player }),
    "POST /auth/logout": () => ok({ ok: true }),
  });

  it("signing in keeps the token, the wallet and the player's id; the account's city is shown once the server has answered", async () => {
    const fished = upgrade(newPlayerState(), "fishery");
    if (!fished.ok) throw new Error(fished.reason);
    const server = fakeServer(fished.state);
    const t = accountSetup(signInRoutes(server));
    expect(t.account.signedIn).toBe(false);
    expect(t.account.city()).toBeNull();
    const r = await t.account.signInWith(fakeWallet(), PAGE);
    expect(r.ok).toBe(true);
    expect(JSON.parse(t.store.getItem(ACCOUNT_KEY)!)).toEqual({ token: TOKEN, wallet: WALLET, playerId: "p1" });
    expect(t.account.city()).toEqual(server.state);
    expect(t.changes()).toBe(1);
    expect(t.toasts).toEqual([TEXT.signedIn]);
  });

  it("after playing on this device: one message, and the city of this device stays as it is", async () => {
    const t = accountSetup(signInRoutes(fakeServer()));
    t.store.setItem(SAVE_KEY, "the city of this device");
    await t.account.signInWith(fakeWallet(), PAGE, true);
    expect(t.toasts).toEqual([TEXT.ownCity]);
    expect(t.store.getItem(SAVE_KEY)).toBe("the city of this device");
    expect(TEXT.ownCity).toBe("Your account has its own city. The city on this device stays here when you sign out.");
  });

  it("a session of week 3 (without the player's id) is forgotten: sign in again once", () => {
    const store = memoryStore();
    store.setItem(ACCOUNT_KEY, JSON.stringify({ token: TOKEN, wallet: WALLET, version: 3, dirty: true }));
    const t = accountSetup({}, store);
    expect(t.account.signedIn).toBe(false);
    expect(store.getItem(ACCOUNT_KEY)).toBeNull();
  });

  it("with a session, the page shows the account's copy at once, then sends what waits", async () => {
    const server = fakeServer();
    const store = memoryStore();
    store.setItem(ACCOUNT_KEY, JSON.stringify({ token: TOKEN, wallet: WALLET, playerId: "p1" }));
    store.setItem(cityKey("p1"), JSON.stringify({ v: 1, server: server.city(), receivedAt: Date.parse(ASOF), pending: [{ action: { id: uuid(5), type: "upgrade", building: "refinery" }, firstSentAt: null }] }));
    const t = accountSetup(server.routes, store);
    expect(queued(t.account.city()!)).toEqual(["refinery"]);
    await t.account.start();
    expect(sent(t.api).map((a) => a.id)).toEqual([uuid(5)]);
    expect(t.account.city()).toEqual(server.state);
  });

  it("signed_out with waiting actions: they are kept; signing in again with the same account sends them, with their ids", async () => {
    const server = fakeServer();
    let session = true;
    const routes = signInRoutes(server);
    const t = accountSetup({
      ...routes,
      "POST /city/actions": (c) => (session ? routes["POST /city/actions"]!(c) : no("signed_out", "Please sign in again")),
      "GET /city": (c) => (session ? routes["GET /city"]!(c) : no("signed_out", "Please sign in again")),
    });
    await t.account.signInWith(fakeWallet(), PAGE);
    session = false;
    t.account.act(UP_REFINERY);
    await flush();
    expect(t.account.signedIn).toBe(false);
    expect(t.toasts.at(-1)).toBe(TEXT.signInAgain);
    expect(readCopy(t.store, "p1")!.pending.map((p) => p.action.id)).toEqual([uuid(1)]);
    session = true;
    await t.account.signInWith(fakeWallet(), PAGE);
    expect(sent(t.api).map((a) => a.id)).toEqual([uuid(1), uuid(1)]);
    expect(queued(server.state)).toEqual(["refinery"]);
  });

  it("another account: its own copy; the first account's copy and its waiting actions are kept, and never sent with the other token", async () => {
    const first = fakeServer();
    const other = fakeServer();
    const routes = signInRoutes(first);
    let who: "p1" | "p2" = "p1";
    const t = accountSetup({
      ...routes,
      "POST /auth/verify": () => ok({ token: who === "p1" ? TOKEN : "U".repeat(43), expiresAt: ASOF, player: { id: who, wallet: who === "p1" ? WALLET : "Other1111111111111111111111111111111111111" } }),
      "GET /city": (c) => (c.token === TOKEN ? first.routes["GET /city"]!(c) : other.routes["GET /city"]!(c)),
      "POST /city/actions": (c) => (c.token === TOKEN ? no(OFFLINE, "") : other.routes["POST /city/actions"]!(c)),
    });
    await t.account.signInWith(fakeWallet(), PAGE);
    t.account.act(UP_REFINERY);
    await flush();
    await t.account.signOut();
    who = "p2";
    await t.account.signInWith(fakeWallet(), PAGE);
    t.account.act(UP_FISHERY);
    await flush();
    expect(t.api.calls.filter((c) => c.path === "/city/actions" && c.token !== TOKEN).map((c) => (c.body as { action: GameAction }).action.id)).toEqual([uuid(2)]);
    expect(readCopy(t.store, "p1")!.pending.map((p) => p.action.id)).toEqual([uuid(1)]);
    expect(queued(other.state)).toEqual(["fishery"]);
    expect(queued(first.state)).toEqual([]);
  });

  it("signing out forgets the session, never a city: the account's copy and the city of this device stay", async () => {
    const t = accountSetup(signInRoutes(fakeServer()));
    t.store.setItem(SAVE_KEY, "the city of this device");
    await t.account.signInWith(fakeWallet(), PAGE);
    t.account.act(UP_REFINERY);
    await flush();
    await t.account.signOut();
    expect(t.store.getItem(ACCOUNT_KEY)).toBeNull();
    expect(t.store.getItem(SAVE_KEY)).toBe("the city of this device");
    expect(readCopy(t.store, "p1")).not.toBeNull();
    expect(t.account.city()).toBeNull();
    expect(t.api.calls.at(-1)).toMatchObject({ method: "POST", path: "/auth/logout", token: TOKEN });
    expect(t.toasts.at(-1)).toBe(TEXT.signedOut);
  });

  it("without a session, nothing goes on the network", async () => {
    const t = accountSetup({});
    await t.account.start();
    t.account.wake();
    await flush();
    expect(t.api.calls).toEqual([]);
  });

  it("the client reacts to the code, never to the text", async () => {
    const server = fakeServer();
    let first = true;
    const routes = signInRoutes(server);
    const t = accountSetup({
      ...routes,
      "POST /city/actions": (c) => {
        if (!first) return routes["POST /city/actions"]!(c);
        first = false;
        return no("rule_refused", "Please sign in again", server.city());
      },
    });
    await t.account.signInWith(fakeWallet(), PAGE);
    t.account.act(UP_REFINERY);
    await flush();
    expect(t.account.signedIn).toBe(true);
    expect(t.toasts.at(-1)).toBe("Please sign in again");
  });

  it("isUntouched: a city nobody played yet", () => {
    expect(isUntouched(newPlayerState())).toBe(true);
    const r = upgrade(newPlayerState(), "refinery");
    expect(r.ok && isUntouched(r.state)).toBe(false);
  });
});

describe("profile", () => {
  const page = { href: "https://brinelight.pages.dev/", origin: "https://brinelight.pages.dev", userAgent: "Mozilla/5.0 (X11; Linux x86_64)" };
  const android = { ...page, userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S901U) Chrome/141.0" };

  it("a wallet that can sign in gets the sign-in button", () => {
    const html = profileHtml({ available: true, wallet: null, wallets: [fakeWallet()], busy: false }, page);
    expect(html).toContain(PROFILE_TEXT.signIn);
    expect(html).toContain('data-act="sign-in"');
  });

  it("a wallet without signIn gets the message, and no button", () => {
    const html = profileHtml({ available: true, wallet: null, wallets: [fakeWallet({ signIn: false })], busy: false }, page);
    expect(html).toContain(NO_SIGN_IN);
    expect(html).not.toContain('data-act="sign-in"');
  });

  it("no wallet on Chrome Android: Open in Phantom, which opens the game in Phantom's browser", () => {
    const html = profileHtml({ available: true, wallet: null, wallets: [], busy: false }, android);
    expect(html).toContain(PROFILE_TEXT.openInPhantom);
    expect(html).toContain(phantomLink(android.href, android.origin).replaceAll("&", "&#38;"));
    expect(phantomLink("https://brinelight.pages.dev/", "https://brinelight.pages.dev")).toBe(
      "https://phantom.app/ul/browse/https%3A%2F%2Fbrinelight.pages.dev%2F?ref=https%3A%2F%2Fbrinelight.pages.dev",
    );
    expect(isPhone(android.userAgent)).toBe(true);
    expect(profileHtml({ available: true, wallet: null, wallets: [], busy: false }, page)).toContain(PROFILE_TEXT.noWallet);
  });

  it("signed in: the short address and Sign out", () => {
    const html = profileHtml({ available: true, wallet: WALLET, wallets: [], busy: false }, page);
    expect(html).toContain(`Signed in as ${shortAddress(WALLET)}`);
    expect(shortAddress(WALLET)).toBe("7Hc3…3tPq");
    expect(html).toContain('data-act="sign-out"');
  });

  it("without a server address, accounts are not offered", () => {
    expect(profileHtml({ available: false, wallet: null, wallets: [fakeWallet()], busy: false }, page)).toBe(`<p class="p">${PROFILE_TEXT.unavailable}</p>`);
  });
});

describe("profile with several wallets", () => {
  it("a title, then one button per wallet that can sign in, with its name", () => {
    const a = fakeWallet();
    const b = { ...fakeWallet(), name: "Other Wallet" } as Wallet;
    const html = profileHtml({ available: true, wallet: null, wallets: [a, fakeWallet({ signIn: false }), b], busy: false }, {
      href: "https://brinelight.pages.dev/",
      origin: "https://brinelight.pages.dev",
      userAgent: "",
    });
    expect(html.match(/data-act="sign-in"/g)).toHaveLength(2);
    expect(html).toContain('data-i="0"');
    expect(html).toContain('data-i="2"');
    expect(html).toContain("Other Wallet");
  });
});
