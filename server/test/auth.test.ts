import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { Writable } from "node:stream";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { base58Encode } from "../src/auth/base58.js";
import { AUTH_PER_MINUTE, REFUSED } from "../src/auth/routes.js";
import { STATEMENT, formatSignInMessage } from "../src/auth/siws.js";
import type { Config } from "../src/config.js";
import { TOO_MANY_REQUESTS, type Refusal } from "../src/refusals.js";
import { hashToken, openDatabase, schema, type Database, type Db } from "../src/db/index.js";

const ORIGIN = "https://brinelight.pages.dev";
const CONFIG: Config = { allowedOrigins: [ORIGIN, "http://localhost:5173"], chainId: "mainnet", trustedProxy: null, databaseUrl: undefined };
const T0 = new Date("2026-10-15T12:00:00.000Z");
const MIN = 60_000;
const DAY = 24 * 3600_000;

let database: Database;
let db: Db;
let clock: Date;
const at = (ms: number) => new Date(clock.getTime() + ms).toISOString();

beforeAll(async () => {
  database = await openDatabase(undefined);
  db = database.db;
}, 30_000);
beforeEach(async () => {
  await db.execute(sql`truncate players, sessions, auth_nonces, cities cascade`);
  clock = T0;
});
afterAll(async () => {
  await database.close();
});

type App = Awaited<ReturnType<typeof buildApp>>;
const app = (options: Partial<Parameters<typeof buildApp>[0]> = {}): Promise<App> =>
  buildApp({ db, config: CONFIG, now: () => clock, ...options });

type Wallet = { address: string; privateKey: KeyObject };
const newWallet = (): Wallet => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { address: base58Encode(publicKey.export({ format: "der", type: "spki" }).subarray(-32)), privateKey };
};

async function getNonce(server: App): Promise<string> {
  const res = await server.inject({ method: "POST", url: "/auth/nonce", headers: { origin: ORIGIN } });
  expect(res.statusCode).toBe(200);
  return res.json().nonce;
}

type Fields = Parameters<typeof formatSignInMessage>[0];
/** A sign-in exactly as a wallet would send it; every part can be changed to build a bad one. */
function signInBody(wallet: Wallet, nonce: string, change: Partial<Fields> = {}, text?: (t: string) => string) {
  let message = formatSignInMessage({
    domain: "brinelight.pages.dev",
    address: wallet.address,
    statement: STATEMENT,
    uri: ORIGIN,
    version: "1",
    chainId: "mainnet",
    nonce,
    issuedAt: at(0),
    expirationTime: at(5 * MIN),
    ...change,
  });
  if (text) message = text(message);
  const bytes = Buffer.from(message, "utf8");
  return { address: wallet.address, signedMessage: bytes.toString("base64"), signature: sign(null, bytes, wallet.privateKey).toString("base64") };
}

/** `origin` null: a request without an Origin header. */
const verify = (server: App, body: unknown, origin: string | null = ORIGIN) =>
  server.inject({ method: "POST", url: "/auth/verify", headers: origin ? { origin } : {}, payload: body as object });

async function signIn(server: App, wallet = newWallet()) {
  const res = await verify(server, signInBody(wallet, await getNonce(server)));
  expect(res.statusCode).toBe(200);
  return { wallet, ...(res.json() as { token: string; expiresAt: string; player: { id: string; wallet: string } }) };
}

const me = (server: App, token: string) => server.inject({ method: "GET", url: "/me", headers: { authorization: `Bearer ${token}` } });

/** Signs in with a message changed by `change`, and expects this refusal. */
async function expectRefused(change: Partial<Fields>, code: number, error: Refusal) {
  const server = await app();
  const res = await verify(server, signInBody(newWallet(), await getNonce(server), change));
  expect(res.statusCode).toBe(code);
  expect(res.json()).toEqual(error);
}

describe("sign-in", () => {
  it("a wallet signs the message and gets a session; /me names the player", async () => {
    const server = await app();
    const { wallet, token, expiresAt, player } = await signIn(server);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiresAt).toBe(new Date(T0.getTime() + 30 * DAY).toISOString());
    expect(player.wallet).toBe(wallet.address);
    const res = await me(server, token);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ player, expiresAt });
  });

  it("only the hash of the token is stored", async () => {
    const server = await app();
    const { token } = await signIn(server);
    const rows = await db.select().from(schema.sessions);
    expect(rows.map((r) => r.tokenHash)).toEqual([hashToken(token)]);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("signing in again with the same wallet gives the same player and a new token", async () => {
    const server = await app();
    const first = await signIn(server);
    const second = await signIn(server, first.wallet);
    expect(second.player.id).toBe(first.player.id);
    expect(second.token).not.toBe(first.token);
  });

  it("the answer holds no hash, signature or message", async () => {
    const server = await app();
    const wallet = newWallet();
    const body = signInBody(wallet, await getNonce(server));
    const res = await verify(server, body);
    expect(Object.keys(res.json()).sort()).toEqual(["expiresAt", "player", "token"]);
    expect(res.body).not.toContain(body.signature);
    expect(res.body).not.toContain(hashToken(res.json().token));
    expect(Object.keys(res.json().player).sort()).toEqual(["id", "wallet"]);
  });
});

describe("refused signatures", () => {
  it("a signature made by another wallet", async () => {
    const server = await app();
    const wallet = newWallet();
    const body = signInBody(wallet, await getNonce(server));
    const other = signInBody(newWallet(), "x");
    const res = await verify(server, { ...body, signature: other.signature });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(REFUSED.signature);
  });

  it("a message changed after signing", async () => {
    const server = await app();
    const body = signInBody(newWallet(), await getNonce(server));
    const text = Buffer.from(body.signedMessage, "base64").toString();
    const changed = Buffer.from(text.replace(at(5 * MIN), at(6 * MIN))).toString("base64");
    const res = await verify(server, { ...body, signedMessage: changed });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(REFUSED.signature);
  });

  it("a message naming another wallet than the one that signed it", async () => {
    const server = await app();
    const signer = newWallet();
    const named = newWallet();
    const body = signInBody(signer, await getNonce(server), { address: named.address });
    const res = await verify(server, { ...body, address: named.address });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(REFUSED.signature);
  });

  it("an address in the request that is not the one in the message", async () => {
    const server = await app();
    const body = signInBody(newWallet(), await getNonce(server));
    const res = await verify(server, { ...body, address: newWallet().address });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(REFUSED.address);
  });

  it("a badly formed request: missing field, extra field, loose base64, bad UTF-8, bad message", async () => {
    const server = await app();
    const wallet = newWallet();
    const body = signInBody(wallet, await getNonce(server));
    const bad = async (payload: unknown, error: Refusal) => {
      const res = await verify(server, payload);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual(error);
    };
    await bad({ address: body.address, signature: body.signature }, REFUSED.request);
    await bad({ ...body, extra: 1 }, REFUSED.request);
    await bad({ ...body, signedMessage: body.signedMessage.replace(/=+$/, "") + "\n" }, REFUSED.request);
    await bad({ ...body, signedMessage: Buffer.from([0xff, 0xfe, 0x00]).toString("base64") }, REFUSED.message);
    await bad({ ...body, signedMessage: Buffer.from("hello").toString("base64") }, REFUSED.message);
    const res = await server.inject({ method: "POST", url: "/auth/verify", headers: { origin: ORIGIN, "content-type": "text/plain" }, payload: "hi" });
    expect(res.statusCode).toBe(400);
  });
});

describe("refused nonces", () => {
  it("a nonce used once cannot sign in again", async () => {
    const server = await app();
    const wallet = newWallet();
    const body = signInBody(wallet, await getNonce(server));
    expect((await verify(server, body)).statusCode).toBe(200);
    const again = await verify(server, body);
    expect(again.statusCode).toBe(401);
    expect(again.json()).toEqual(REFUSED.used);
  });

  it("two sign-ins at the same time with the same nonce: only one gets a session", async () => {
    const server = await app();
    const nonce = await getNonce(server);
    const wallet = newWallet();
    const results = await Promise.all([verify(server, signInBody(wallet, nonce)), verify(server, signInBody(wallet, nonce, { expirationTime: at(4 * MIN) }))]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 401]);
    expect(await db.select().from(schema.sessions)).toHaveLength(1);
  });

  it("a nonce the server never gave", async () => {
    const server = await app();
    const res = await verify(server, signInBody(newWallet(), "0123456789abcdef0123456789abcdef"));
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(REFUSED.unknown);
  });

  it("a nonce older than 5 minutes", async () => {
    const server = await app();
    const nonce = await getNonce(server);
    clock = new Date(T0.getTime() + 5 * MIN + 1000);
    const res = await verify(server, signInBody(newWallet(), nonce));
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(REFUSED.expired);
  });

  it("a refused signature does not use the nonce", async () => {
    const server = await app();
    const wallet = newWallet();
    const body = signInBody(wallet, await getNonce(server));
    const res = await verify(server, { ...body, signature: signInBody(newWallet(), "x").signature });
    expect(res.statusCode).toBe(401);
    expect((await verify(server, body)).statusCode).toBe(200);
  });
});

describe("refused messages", () => {
  it("another domain or another uri", async () => {
    await expectRefused({ domain: "evil.example" }, 400, REFUSED.site);
    await expectRefused({ domain: "localhost:5173" }, 400, REFUSED.site);
    await expectRefused({ uri: "https://evil.example" }, 400, REFUSED.site);
    await expectRefused({ uri: "http://brinelight.pages.dev" }, 400, REFUSED.site);
    await expectRefused({ uri: "not a uri" }, 400, REFUSED.site);
  });

  it("a request from a page that is not allowed, or without Origin", async () => {
    const server = await app();
    const wallet = newWallet();
    const body = signInBody(wallet, await getNonce(server), { domain: "evil.example", uri: "https://evil.example" });
    for (const origin of ["https://evil.example", null]) {
      const res = await verify(server, body, origin);
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual(REFUSED.origin);
    }
  });

  it("a message for the right site sent from another allowed origin", async () => {
    const server = await app();
    const res = await verify(server, signInBody(newWallet(), await getNonce(server)), "http://localhost:5173");
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(REFUSED.site);
  });

  it("another statement, version or chain", async () => {
    await expectRefused({ statement: "Sign in to Brinelight." }, 400, REFUSED.statement);
    await expectRefused({ version: "2" }, 400, REFUSED.statement);
    await expectRefused({ chainId: "devnet" }, 400, REFUSED.chain);
  });

  it("Issued At more than 5 minutes away from the server clock", async () => {
    await expectRefused({ issuedAt: at(-6 * MIN), expirationTime: at(MIN) }, 400, REFUSED.clock);
    await expectRefused({ issuedAt: at(6 * MIN), expirationTime: at(8 * MIN) }, 400, REFUSED.clock);
  });

  it("an Expiration Time missing, before Issued At, more than 10 minutes after it, or passed", async () => {
    const server = await app();
    const noExpiry = await verify(server, signInBody(newWallet(), await getNonce(server), {}, (t) => t.split("\n").slice(0, -1).join("\n")));
    expect(noExpiry.statusCode).toBe(400);
    expect(noExpiry.json()).toEqual(REFUSED.message);
    await expectRefused({ expirationTime: at(-MIN) }, 400, REFUSED.expiry);
    await expectRefused({ expirationTime: at(10 * MIN + 1000) }, 400, REFUSED.expiry);
    await expectRefused({ issuedAt: at(-4 * MIN), expirationTime: at(-MIN) }, 401, REFUSED.expired);
  });
});

describe("sessions", () => {
  it("a session ends after 30 days", async () => {
    const server = await app();
    const { token } = await signIn(server);
    clock = new Date(T0.getTime() + 29 * DAY);
    expect((await me(server, token)).statusCode).toBe(200);
    clock = new Date(T0.getTime() + 31 * DAY);
    const res = await me(server, token);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(REFUSED.session);
  });

  it("logging out ends the session", async () => {
    const server = await app();
    const { token } = await signIn(server);
    const res = await server.inject({ method: "POST", url: "/auth/logout", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect((await me(server, token)).statusCode).toBe(401);
    expect(await db.select().from(schema.sessions)).toHaveLength(0);
  });

  it("no token, a badly formed token or an unknown token", async () => {
    const server = await app();
    for (const headers of [{}, { authorization: "Bearer" }, { authorization: "Basic abc" }, { authorization: `Bearer ${"A".repeat(43)}` }]) {
      const res = await server.inject({ method: "GET", url: "/me", headers });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual(REFUSED.session);
    }
  });
});

describe("protections", () => {
  it("CORS: only the allowed origins may call the server from a browser", async () => {
    const server = await app();
    const preflight = (origin: string) =>
      server.inject({ method: "OPTIONS", url: "/auth/verify", headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type" } });
    expect((await preflight(ORIGIN)).headers["access-control-allow-origin"]).toBe(ORIGIN);
    expect((await preflight("https://evil.example")).headers["access-control-allow-origin"]).toBeUndefined();
  });

  it(`at most ${AUTH_PER_MINUTE} sign-in requests per minute from one address`, async () => {
    const server = await app();
    for (let i = 0; i < AUTH_PER_MINUTE; i++) expect((await getNonce(server)).length).toBe(32);
    const res = await server.inject({ method: "POST", url: "/auth/nonce", headers: { origin: ORIGIN } });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual(TOO_MANY_REQUESTS);
    expect((await server.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
  });

  const nonceFrom = (server: App, forwardedFor: string) =>
    server.inject({ method: "POST", url: "/auth/nonce", remoteAddress: "10.0.0.2", headers: { "x-forwarded-for": forwardedFor } });

  it("without TRUSTED_PROXY, an X-Forwarded-For sent by the client is ignored", async () => {
    const server = await app();
    for (let i = 0; i < AUTH_PER_MINUTE; i++) expect((await nonceFrom(server, `203.0.113.${i}`)).statusCode).toBe(200);
    expect((await nonceFrom(server, "203.0.113.200")).statusCode).toBe(429);
  });

  it("with TRUSTED_PROXY, the limit counts each player address the proxy names", async () => {
    const server = await app({ config: { ...CONFIG, trustedProxy: "10.0.0.2" } });
    for (let i = 0; i < AUTH_PER_MINUTE; i++) expect((await nonceFrom(server, "203.0.113.1")).statusCode).toBe(200);
    expect((await nonceFrom(server, "203.0.113.1")).statusCode).toBe(429);
    expect((await nonceFrom(server, "203.0.113.2")).statusCode).toBe(200);
    // Another machine than the proxy cannot pick an address.
    const other = await server.inject({ method: "POST", url: "/auth/nonce", remoteAddress: "10.0.0.9", headers: { "x-forwarded-for": "203.0.113.3" } });
    expect(other.statusCode).toBe(200);
    for (let i = 0; i < AUTH_PER_MINUTE; i++) await server.inject({ method: "POST", url: "/auth/nonce", remoteAddress: "10.0.0.9", headers: { "x-forwarded-for": `198.51.100.${i}` } });
    expect((await server.inject({ method: "POST", url: "/auth/nonce", remoteAddress: "10.0.0.9", headers: { "x-forwarded-for": "198.51.100.99" } })).statusCode).toBe(429);
  });

  it("no log line holds a session token, even at the most detailed level", async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const server = await app({ logger: { level: "trace", stream } });
    const { token } = await signIn(server);
    await me(server, token);
    await server.inject({ method: "POST", url: "/auth/logout", headers: { authorization: `Bearer ${token}` } });
    // A careless log of the headers is caught too: the request serializer drops them, and redaction hides the header.
    server.log.info({ req: { headers: { authorization: `Bearer ${token}` } } }, "request headers");
    server.log.info({ headers: { authorization: `Bearer ${token}` } }, "headers");
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.join("")).not.toContain(token);
    expect(lines.find((l) => l.includes('"msg":"headers"'))).toContain('"authorization":"[Redacted]"');
  });
});
