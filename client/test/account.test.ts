import { newPlayerState, upgrade, type PlayerState } from "@brinelight/shared";
import type { Wallet } from "@wallet-standard/base";
import { describe, expect, it } from "vitest";
import { OFFLINE, createApi, type Api, type ApiResult } from "../src/account/api.js";
import { ACCOUNT_KEY, BACKUP_KEY, REFRESH_EVERY_MS, TEXT, createAccount, isUntouched, type AccountStore } from "../src/account/index.js";
import { PROFILE_TEXT, profileHtml, shortAddress } from "../src/account/profile.js";
import { CANCELLED, signIn } from "../src/account/signIn.js";
import { NO_SIGN_IN, SIGN_IN, isPhone, phantomLink, type SignInInput } from "../src/account/wallets.js";
import { SAVE_KEY } from "../src/state/save.js";

const memoryStore = (): AccountStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

type Call = { method: string; path: string; token?: string | null; body?: unknown; keepalive?: boolean };
/** A server that answers from a script: one function per route, called with each request. */
function fakeApi(routes: Record<string, (c: Call) => ApiResult<unknown>>): Api & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async call<T>(method: string, path: string, o: { token?: string | null; body?: unknown; keepalive?: boolean } = {}) {
      const c = { method, path, ...o };
      calls.push(c);
      const r = routes[`${method} ${path}`];
      return (r ? r(c) : { ok: false, code: OFFLINE, error: "" }) as ApiResult<T>;
    },
  };
}
const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data });
const no = (code: string, error = `text of ${code}`): ApiResult<never> => ({ ok: false, code, error });

const played = (): PlayerState => {
  const r = upgrade(newPlayerState(), "refinery");
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};

const NONCE = { nonce: "0123456789abcdef0123456789abcdef", issuedAt: "2026-10-15T12:00:00.000Z", expiresAt: "2026-10-15T12:05:00.000Z", chainId: "mainnet", statement: "Sign in." };
const WALLET = "7Hc3wTfa1Xp9Q2LmWbR8sKdN4vYzE6uJ5gA1oCiF3tPq";

function fakeWallet(opts: { signIn?: boolean; refuse?: boolean } = {}): Wallet & { inputs: SignInInput[] } {
  const inputs: SignInInput[] = [];
  const account = { address: WALLET, publicKey: new Uint8Array(32), chains: ["solana:mainnet"] as const, features: [SIGN_IN] as const };
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

const PAGE = { host: "brinelight.pages.dev", origin: "https://brinelight.pages.dev" };
const verified = ok({ token: "T".repeat(43), expiresAt: "2026-11-14T12:00:00.000Z", player: { id: "p1", wallet: WALLET } });

/** An account with a fake server and a city in play that the test can read. */
function setup(routes: Record<string, (c: Call) => ApiResult<unknown>>, opts: { state?: PlayerState; store?: ReturnType<typeof memoryStore>; ask?: "keep" | "replace" } = {}) {
  const api = fakeApi(routes);
  const store = opts.store ?? memoryStore();
  const toasts: string[] = [];
  let now = 0;
  const game = { state: opts.state ?? newPlayerState(), asked: 0 };
  const account = createAccount({
    api,
    store,
    getState: () => game.state,
    setState: (s) => (game.state = s),
    toast: (t) => toasts.push(t),
    ask: async () => {
      game.asked++;
      return opts.ask ?? "keep";
    },
    nowMs: () => now,
  });
  return { api, store, toasts, game, account, later: (ms: number) => (now += ms) };
}
const signedInStore = (version = 3, dirty = false) => {
  const store = memoryStore();
  store.setItem(ACCOUNT_KEY, JSON.stringify({ token: "T".repeat(43), wallet: WALLET, version, dirty }));
  return store;
};
const accountCity = (state: PlayerState, version: number) => ok({ state, version, savedAt: "2026-10-15T11:00:00.000Z", asOf: "2026-10-15T12:00:00.000Z" });

describe("api", () => {
  it("sends the token and the body, and keeps the server's code and text of a refusal", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response(JSON.stringify({ code: "version_conflict", error: "Your city changed on another device" }), { status: 409 });
    }) as typeof fetch;
    const r = await createApi("http://api.test", fetchFn).call("PUT", "/city", { token: "abc", body: { version: 1 }, keepalive: true });
    expect(r).toEqual({ ok: false, code: "version_conflict", error: "Your city changed on another device" });
    expect(seen[0]!.url).toBe("http://api.test/city");
    expect(seen[0]!.init).toMatchObject({ method: "PUT", body: '{"version":1}', keepalive: true, headers: { authorization: "Bearer abc", "content-type": "application/json" } });
  });

  it("no network, or an answer cut before its end, gives the code offline; an answer without a code is a server error", async () => {
    const down = (async () => Promise.reject(new TypeError("Failed to fetch"))) as typeof fetch;
    expect(await createApi("http://api.test", down).call("GET", "/city")).toEqual({ ok: false, code: OFFLINE, error: "" });
    const cut = (async () => new Response("{\"vers", { status: 200 })) as typeof fetch;
    expect(await createApi("http://api.test", cut).call("PUT", "/city")).toEqual({ ok: false, code: OFFLINE, error: "" });
    const html = (async () => new Response("<h1>Bad gateway</h1>", { status: 502 })) as typeof fetch;
    expect(await createApi("http://api.test", html).call("GET", "/city")).toMatchObject({ ok: false, code: "server_error" });
  });
});

describe("sign-in with the wallet", () => {
  it("passes the server's nonce, time, network and statement to solana:signIn, then sends the signed bytes", async () => {
    const wallet = fakeWallet();
    const api = fakeApi({ "POST /auth/nonce": () => ok(NONCE), "POST /auth/verify": () => verified });
    const r = await signIn(api, wallet, PAGE);
    expect(r).toEqual({ ok: true, data: { token: "T".repeat(43), wallet: WALLET, expiresAt: "2026-11-14T12:00:00.000Z" } });
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

describe("after sign-in", () => {
  const signInRoutes = { "POST /auth/nonce": () => ok(NONCE), "POST /auth/verify": () => verified };

  it("no city on the account: the city of this device is sent at version 0", async () => {
    const t = setup({ ...signInRoutes, "GET /city": () => ok({ city: null }), "PUT /city": () => ok({ version: 1, savedAt: "x" }) }, { state: played() });
    expect((await t.account.signInWith(fakeWallet(), PAGE)).ok).toBe(true);
    const put = t.api.calls.find((c) => c.method === "PUT")!;
    expect(put.body).toEqual({ state: played(), version: 0 });
    expect(JSON.parse(t.store.getItem(ACCOUNT_KEY)!)).toMatchObject({ wallet: WALLET, version: 1, dirty: false });
    expect(t.toasts).toEqual([TEXT.signedIn]);
  });

  it("a city on the account and one here: you choose; keeping the account city keeps a copy of this one", async () => {
    const store = memoryStore();
    store.setItem(SAVE_KEY, "the city of this device");
    const mine = played();
    const theirs = newPlayerState();
    const t = setup({ ...signInRoutes, "GET /city": () => accountCity(theirs, 4) }, { state: mine, store, ask: "keep" });
    await t.account.signInWith(fakeWallet(), PAGE);
    expect(t.game.asked).toBe(1);
    expect(t.game.state).toEqual(theirs);
    expect(store.getItem(BACKUP_KEY)).toBe("the city of this device");
    expect(t.api.calls.some((c) => c.method === "PUT")).toBe(false);
    expect(JSON.parse(store.getItem(ACCOUNT_KEY)!).version).toBe(4);
  });

  it("replacing sends this city over the account city's version", async () => {
    const t = setup({ ...signInRoutes, "GET /city": () => accountCity(newPlayerState(), 4), "PUT /city": () => ok({ version: 5, savedAt: "x" }) }, { state: played(), ask: "replace" });
    await t.account.signInWith(fakeWallet(), PAGE);
    expect(t.api.calls.find((c) => c.method === "PUT")!.body).toEqual({ state: played(), version: 4 });
    expect(t.game.state).toEqual(played());
  });

  it("no save goes out while you choose which city to keep", async () => {
    let answer: (v: "keep" | "replace") => void = () => {};
    const api = fakeApi({ ...signInRoutes, "GET /city": () => accountCity(newPlayerState(), 4), "PUT /city": () => ok({ version: 5, savedAt: "x" }) });
    const game = { state: played() };
    const account = createAccount({
      api,
      store: memoryStore(),
      getState: () => game.state,
      setState: (s) => (game.state = s),
      toast: () => {},
      ask: () => new Promise((resolve) => (answer = resolve)),
      nowMs: () => 0,
    });
    const signingIn = account.signInWith(fakeWallet(), PAGE);
    await new Promise((r) => setTimeout(r, 0));
    account.markChanged();
    await account.sync();
    expect(api.calls.some((c) => c.method === "PUT")).toBe(false);
    answer("replace");
    await signingIn;
    expect(api.calls.filter((c) => c.method === "PUT").map((c) => c.body)).toEqual([{ state: played(), version: 4 }]);
  });

  it("a city never played on this device: the account city is loaded without asking", async () => {
    const theirs = played();
    const t = setup({ ...signInRoutes, "GET /city": () => accountCity(theirs, 2) });
    await t.account.signInWith(fakeWallet(), PAGE);
    expect(t.game.asked).toBe(0);
    expect(t.game.state).toEqual(theirs);
    expect(isUntouched(newPlayerState())).toBe(true);
    expect(isUntouched(played())).toBe(false);
  });

  it("a refused sign-in changes nothing", async () => {
    const t = setup({ "POST /auth/nonce": () => ok(NONCE), "POST /auth/verify": () => no("bad_signature") }, { state: played() });
    expect(await t.account.signInWith(fakeWallet(), PAGE)).toEqual(no("bad_signature"));
    expect(t.account.signedIn).toBe(false);
    expect(t.store.getItem(ACCOUNT_KEY)).toBeNull();
    expect(t.game.state).toEqual(played());
  });
});

describe("page load with a session", () => {
  it("the account city is played from asOf, as the server sent it", async () => {
    const theirs = played();
    const t = setup({ "GET /city": () => accountCity(theirs, 3) }, { store: signedInStore(3) });
    await t.account.start();
    expect(t.game.state).toEqual(theirs);
  });

  it("changes this device could not send are sent first, if nothing changed elsewhere", async () => {
    const t = setup({ "GET /city": () => accountCity(newPlayerState(), 3), "PUT /city": () => ok({ version: 4, savedAt: "x" }) }, { state: played(), store: signedInStore(3, true) });
    await t.account.start();
    expect(t.api.calls.find((c) => c.method === "PUT")!.body).toEqual({ state: played(), version: 3 });
    expect(t.game.state).toEqual(played());
  });

  it("a save sent as the page closed landed (its answer never came back): no conflict message", async () => {
    const store = memoryStore();
    store.setItem(ACCOUNT_KEY, JSON.stringify({ token: "T".repeat(43), wallet: WALLET, version: 3, dirty: true, pending: 3 }));
    const mine = played();
    const t = setup({ "GET /city": () => accountCity(mine, 4) }, { store });
    await t.account.start();
    expect(t.toasts).toEqual([]);
    expect(t.game.state).toEqual(mine);
    expect(JSON.parse(store.getItem(ACCOUNT_KEY)!)).toEqual({ token: "T".repeat(43), wallet: WALLET, version: 4, dirty: false });
  });

  it("a save that saw no answer keeps its note: as the page goes away, the request fails for the page but reaches the server", async () => {
    const store = signedInStore(3);
    const t = setup({ "GET /city": () => accountCity(newPlayerState(), 3), "PUT /city": () => no(OFFLINE, "") }, { store });
    await t.account.start();
    t.account.markChanged();
    await t.account.sync({ hidden: true });
    expect(JSON.parse(store.getItem(ACCOUNT_KEY)!)).toMatchObject({ version: 3, dirty: true, pending: 3 });
    // Next page load: the account is one version ahead, so that save landed. No conflict message.
    const next = setup({ "GET /city": () => accountCity(played(), 4) }, { store });
    await next.account.start();
    expect(next.toasts).toEqual([]);
  });

  it("unsent changes, and the account moved on elsewhere: the account city, with the message", async () => {
    const theirs = played();
    const t = setup({ "GET /city": () => accountCity(theirs, 5) }, { store: signedInStore(3, true) });
    await t.account.start();
    expect(t.game.state).toEqual(theirs);
    expect(t.toasts).toEqual([TEXT.conflict]);
  });

  it("while a save is on its way, the version it left from is noted; the answer clears it", async () => {
    const store = signedInStore(3);
    let during: unknown = null;
    const t = setup(
      {
        "GET /city": () => accountCity(newPlayerState(), 3),
        "PUT /city": () => {
          during = JSON.parse(store.getItem(ACCOUNT_KEY)!).pending;
          return ok({ version: 4, savedAt: "x" });
        },
      },
      { store },
    );
    await t.account.start();
    t.account.markChanged();
    await t.account.sync({ hidden: true });
    expect(during).toBe(3);
    expect(JSON.parse(store.getItem(ACCOUNT_KEY)!).pending).toBeUndefined();
  });

  it("without a session, nothing goes on the network", async () => {
    const t = setup({});
    await t.account.start();
    t.account.markChanged();
    await t.account.sync();
    await t.account.sync({ hidden: true });
    expect(t.api.calls).toEqual([]);
  });
});

describe("saving to the account", () => {
  const signedIn = async (routes: Record<string, (c: Call) => ApiResult<unknown>>, version = 3) => {
    const t = setup({ "GET /city": () => accountCity(newPlayerState(), version), ...routes }, { store: signedInStore(version) });
    await t.account.start();
    t.api.calls.length = 0;
    return t;
  };

  it("only when the city changed; the version follows the server", async () => {
    let v = 3;
    const t = await signedIn({ "PUT /city": () => ok({ version: ++v, savedAt: "x" }) });
    await t.account.sync();
    expect(t.api.calls).toEqual([]);
    t.account.markChanged();
    await t.account.sync();
    t.account.markChanged();
    await t.account.sync();
    expect(t.api.calls.map((c) => (c.body as { version: number }).version)).toEqual([3, 4]);
    await t.account.sync();
    expect(t.api.calls).toHaveLength(2);
  });

  it("with no change, the city is still sent every 30 minutes", async () => {
    const t = await signedIn({ "PUT /city": () => ok({ version: 4, savedAt: "x" }) });
    t.later(REFRESH_EVERY_MS - 1000);
    await t.account.sync();
    expect(t.api.calls).toHaveLength(0);
    t.later(2000);
    await t.account.sync();
    expect(t.api.calls).toHaveLength(1);
  });

  it("when the page is hidden, the save is sent with keepalive", async () => {
    const t = await signedIn({ "PUT /city": () => ok({ version: 4, savedAt: "x" }) });
    t.account.markChanged();
    await t.account.sync({ hidden: true });
    expect(t.api.calls[0]).toMatchObject({ method: "PUT", keepalive: true });
  });

  it("version_conflict: the account city is loaded again, with a message", async () => {
    const latest = played();
    let gets = 0;
    const t = await signedIn({ "PUT /city": () => no("version_conflict"), "GET /city": () => (gets++ ? accountCity(latest, 7) : accountCity(newPlayerState(), 3)) });
    t.account.markChanged();
    await t.account.sync();
    expect(t.game.state).toEqual(latest);
    expect(t.toasts).toEqual([TEXT.conflict]);
    expect(JSON.parse(t.store.getItem(ACCOUNT_KEY)!)).toMatchObject({ version: 7, dirty: false });
  });

  it("signed_out: back to playing on this device, with the city kept", async () => {
    const t = await signedIn({ "PUT /city": () => no("signed_out") });
    const city = t.game.state;
    t.account.markChanged();
    await t.account.sync();
    expect(t.account.signedIn).toBe(false);
    expect(t.store.getItem(ACCOUNT_KEY)).toBeNull();
    expect(t.game.state).toBe(city);
    expect(t.toasts).toEqual([TEXT.signInAgain]);
  });

  it("no network or too many saves: the city stays here and is sent later, without any message", async () => {
    let answer: ApiResult<unknown> = no(OFFLINE, "");
    const t = await signedIn({ "PUT /city": () => answer });
    t.account.markChanged();
    await t.account.sync();
    answer = no("too_many_saves");
    await t.account.sync();
    expect(t.toasts).toEqual([]);
    expect(JSON.parse(t.store.getItem(ACCOUNT_KEY)!).dirty).toBe(true);
    answer = ok({ version: 4, savedAt: "x" });
    await t.account.sync();
    expect(t.api.calls).toHaveLength(3);
    expect(JSON.parse(t.store.getItem(ACCOUNT_KEY)!)).toMatchObject({ version: 4, dirty: false });
  });

  it("a refusal that saving again cannot fix is shown once, and saving stops", async () => {
    const t = await signedIn({ "PUT /city": () => no("invalid_city", "This city is not valid") });
    t.account.markChanged();
    await t.account.sync();
    t.account.markChanged();
    await t.account.sync();
    expect(t.api.calls).toHaveLength(1);
    expect(t.toasts).toEqual(["This city is not valid"]);
  });

  it("the client reacts to the code, never to the text", async () => {
    const t = await signedIn({ "PUT /city": () => no("signed_out", "Some other words") });
    t.account.markChanged();
    await t.account.sync();
    expect(t.account.signedIn).toBe(false);
  });

  it("signing out forgets the session, never the city", async () => {
    const store = signedInStore(3);
    store.setItem(SAVE_KEY, "the city");
    const t = setup({ "GET /city": () => accountCity(played(), 3), "POST /auth/logout": () => ok({ ok: true }) }, { store });
    await t.account.start();
    const city = t.game.state;
    await t.account.signOut();
    expect(store.getItem(ACCOUNT_KEY)).toBeNull();
    expect(store.getItem(SAVE_KEY)).toBe("the city");
    expect(t.game.state).toBe(city);
    expect(t.api.calls.at(-1)).toMatchObject({ method: "POST", path: "/auth/logout", token: "T".repeat(43) });
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
