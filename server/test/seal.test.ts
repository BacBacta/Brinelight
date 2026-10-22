/**
 * The nightly seal (week 9, task 4; protected), against the fake network of fakeSolana.ts and a clock the test moves.
 * In every case: at most one root on chain a night, and each milestone sealed exactly once. Runs on PGlite with the
 * other tests, and on a real PostgreSQL in the CI (job "postgres", with TEST_DATABASE_URL).
 */
import { randomBytes } from "node:crypto";
import { inspect } from "node:util";
import { checkProofHashes, parseSealMemo, proofDay, toHex, type NotaryAddress, type PlayerProof } from "@brinelight/shared";
import { asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { base58Encode } from "../src/auth/base58.js";
import { createSession, findOrCreatePlayer, openDatabase, schema, type Database, type Db } from "../src/db/index.js";
import { loadNotary, type NotaryKey } from "../src/proofs/key.js";
import { makeNotaryKey } from "../src/proofs/keygen.js";
import { leafHash, merkleRoot } from "../src/proofs/merkle.js";
import { createRpc } from "../src/proofs/rpc.js";
import { MAX_TRIES_A_NIGHT, createNotaryService, nightAt, notaryHealth, type SealLog } from "../src/proofs/seal.js";
import { fakeSolana, type FakeSolana } from "./fakeSolana.js";
import { checkTestDatabaseUrl } from "./testDatabase.js";

const TEST_URL = process.env.TEST_DATABASE_URL || undefined;
if (TEST_URL) checkTestDatabaseUrl(TEST_URL);

let database: Database;
let db: Db;
beforeAll(async () => {
  database = await openDatabase(TEST_URL);
  db = database.db;
}, 60_000);
beforeEach(async () => {
  await db.execute(sql`truncate players, sessions, auth_nonces, cities, applied_actions, proofs, seals cascade`);
});
afterAll(async () => {
  await database?.close();
});

const at = (iso: string) => new Date(iso);
const sha256 = async (b: Uint8Array) => new Uint8Array(await crypto.subtle.digest("SHA-256", b));

/** A throwaway devnet notary, its secret kept only to look for it where it must never be. */
function notary(): { key: NotaryKey; secret: string } {
  const k = makeNotaryKey();
  const loaded = loadNotary({ SOLANA_CLUSTER: "devnet", NOTARY_KEY_DEVNET: k.secret });
  if (loaded.status !== "on") throw new Error(loaded.reason);
  return { key: loaded.key, secret: k.secret };
}

/** Everything the seal logged, to look for the key in it. */
function logs(): SealLog & { lines: string[] } {
  const lines: string[] = [];
  return { lines, info: (f, m) => void lines.push(`${m} ${inspect(f, { depth: 5 })}`), error: (f, m) => void lines.push(`${m} ${inspect(f, { depth: 5 })}`) };
}

function setUp(options: { balance?: number } = {}) {
  const chain = fakeSolana("devnet");
  const n = notary();
  chain.balances.set(n.key.address, options.balance ?? 20_000_000);
  const rpc = createRpc("devnet", { urls: ["https://api.devnet.solana.com"], fetch: chain.fetch, wait: async () => {} });
  const service = createNotaryService(db, n.key, rpc);
  return { chain, ...n, rpc, service };
}

/** A player with a wallet and milestones recorded at the given times. */
async function milestones(recorded: Date[]) {
  const wallet = base58Encode(randomBytes(32));
  const p = await findOrCreatePlayer(db, wallet, recorded[0] ?? new Date());
  const facts = ["lighthouse:5", "lighthouse:10", "lighthouse:15", "lighthouse:20", "lighthouse:25", "lighthouse:30"];
  const rows = recorded.map((r, i) => {
    const salt = new Uint8Array(randomBytes(16));
    const m = { fact: facts[i]!, when: "on" as const, day: proofDay(r.getTime() / 1000) };
    return { playerId: p.id, ...m, salt: toHex(salt), leaf: toHex(leafHash({ salt, wallet, ...m })), recordedAt: r };
  });
  if (rows.length) await db.insert(schema.proofs).values(rows);
  return { id: p.id, wallet };
}
const allProofs = () => db.select().from(schema.proofs).orderBy(asc(schema.proofs.id));
const allSeals = () => db.select().from(schema.seals).orderBy(asc(schema.seals.id));

describe("the night to seal", () => {
  it("from 00:15 UTC, the day just ended, with the milestones recorded before 00:00", () => {
    expect(nightAt(at("2026-10-23T00:14:59Z"))).toBeNull();
    expect(nightAt(at("2026-10-23T00:15:00Z"))).toEqual({ day: "2026-10-22", before: at("2026-10-23T00:00:00Z") });
    expect(nightAt(at("2026-10-23T23:59:00Z"))).toEqual({ day: "2026-10-22", before: at("2026-10-23T00:00:00Z") });
  });
});

describe("the nightly seal", () => {
  it("a quiet night: one transaction with the day's root, then finalized, then nothing more", async () => {
    const { chain, service, key } = setUp();
    const a = await milestones([at("2026-10-22T08:00:00Z"), at("2026-10-22T21:00:00Z")]);
    await milestones([at("2026-10-22T23:59:59Z")]);
    // Recorded after midnight: it waits for the next night.
    await milestones([at("2026-10-23T00:05:00Z")]);

    expect(await service.tick(at("2026-10-23T00:10:00Z"))).toBe("too early");
    expect(chain.sent).toBe(0);
    expect(await service.tick(at("2026-10-23T00:15:00Z"))).toBe("sent");

    const [seal] = await allSeals();
    const rows = await allProofs();
    const sealed = rows.filter((r) => r.sealId === seal!.id);
    expect(sealed.map((r) => r.position)).toEqual([0, 1, 2]);
    expect(rows.at(-1)!.sealId).toBeNull();
    const root = toHex(merkleRoot(sealed.map((r) => Buffer.from(r.leaf, "hex"))));
    expect(seal).toMatchObject({ cluster: "devnet", day: "2026-10-22", root, leaves: 3, signer: key.address, status: "sent" });
    expect(chain.landed.map((t) => [t.signer, t.memo])).toEqual([[key.address, `brinelight proof v1 2026-10-22 ${root}`]]);
    expect(parseSealMemo(chain.landed[0]!.memo)!.day).toBe("2026-10-22");

    // Not finalized yet: it waits, and sends nothing new.
    expect(await service.tick(at("2026-10-23T00:20:00Z"))).toBe("waiting");
    chain.advance(40);
    expect(await service.tick(at("2026-10-23T00:25:00Z"))).toBe("done");
    expect((await allSeals())[0]).toMatchObject({ status: "finalized", finalizedAt: at("2026-10-23T00:25:00Z") });
    for (const t of ["2026-10-23T06:00:00Z", "2026-10-23T23:59:00Z"]) expect(await service.tick(at(t))).toBe("done");
    expect(chain.landed).toHaveLength(1);
    expect(a.id).toBeTruthy();
  });

  it("a night with nothing to seal sends nothing", async () => {
    const { chain, service } = setUp();
    expect(await service.tick(at("2026-10-23T00:15:00Z"))).toBe("nothing");
    await milestones([at("2026-10-23T00:01:00Z")]);
    expect(await service.tick(at("2026-10-23T03:00:00Z"))).toBe("nothing");
    expect(chain.calls).not.toContain("sendTransaction");
    expect(chain.calls).not.toContain("getLatestBlockhash");
  });

  it("the network down for 3 hours: nothing written, then one seal when it is back", async () => {
    const { chain, service } = setUp();
    await milestones([at("2026-10-22T10:00:00Z")]);
    chain.down = true;
    for (const t of ["00:15", "00:20", "01:15", "02:15", "03:10"]) await expect(service.tick(at(`2026-10-23T${t}:00Z`))).rejects.toThrow();
    expect(await allSeals()).toEqual([]);
    chain.down = false;
    expect(await service.tick(at("2026-10-23T03:15:00Z"))).toBe("sent");
    chain.advance(40);
    expect(await service.tick(at("2026-10-23T03:20:00Z"))).toBe("done");
    expect(chain.landed).toHaveLength(1);
  });

  it("written, then the sending fails: sent again as it is, it lands once", async () => {
    const { chain, key, rpc } = setUp();
    await milestones([at("2026-10-22T10:00:00Z")]);
    let failSends = true;
    const flaky: typeof fetch = async (url, init) => {
      if (failSends && String(init?.body).includes('"sendTransaction"')) throw new TypeError("fetch failed");
      return chain.fetch(url, init);
    };
    const service = createNotaryService(db, key, createRpc("devnet", { urls: ["https://api.devnet.solana.com"], fetch: flaky, wait: async () => {} }));
    const log = logs();
    expect(await service.tick(at("2026-10-23T00:15:00Z"), log)).toBe("sent");
    expect(chain.landed).toHaveLength(0);
    expect(log.lines.some((l) => l.startsWith("The seal could not be sent yet"))).toBe(true);
    failSends = false;
    expect(await service.tick(at("2026-10-23T00:20:00Z"))).toBe("waiting");
    expect(chain.landed).toHaveLength(1);
    expect(chain.landed[0]!.signature).toBe((await allSeals())[0]!.signature);
    chain.advance(40);
    expect(await createNotaryService(db, key, rpc).tick(at("2026-10-23T00:25:00Z"))).toBe("done");
    expect(chain.landed).toHaveLength(1);
  });

  it("a restart between the sending and the confirmation: the new process finalizes the same seal", async () => {
    const { chain, key, rpc, service } = setUp();
    await milestones([at("2026-10-22T10:00:00Z"), at("2026-10-22T11:00:00Z")]);
    expect(await service.tick(at("2026-10-23T00:15:00Z"))).toBe("sent");
    chain.advance(40);
    const restarted = createNotaryService(db, key, rpc);
    expect(await restarted.tick(at("2026-10-23T00:20:00Z"))).toBe("done");
    expect(chain.landed).toHaveLength(1);
    expect((await allSeals()).map((s) => s.status)).toEqual(["finalized"]);
  });

  it("a transaction lost on the way: given up only once its blockhash is past, then one new seal", async () => {
    const { chain, service } = setUp();
    await milestones([at("2026-10-22T10:00:00Z"), at("2026-10-22T11:00:00Z")]);
    chain.drop = true;
    expect(await service.tick(at("2026-10-23T00:15:00Z"))).toBe("sent");
    chain.advance(200);
    expect(await service.tick(at("2026-10-23T00:20:00Z"))).toBe("waiting");
    chain.drop = false;
    chain.advance(101);
    // The first can no longer land: its milestones go back, and a new transaction seals them.
    expect(await service.tick(at("2026-10-23T00:25:00Z"))).toBe("sent");
    const [lost, again] = await allSeals();
    expect([lost!.status, again!.status]).toEqual(["expired", "sent"]);
    expect(lost!.signature).not.toBe(again!.signature);
    expect((await allProofs()).every((p) => p.sealId === again!.id)).toBe(true);
    chain.advance(40);
    expect(await service.tick(at("2026-10-23T00:30:00Z"))).toBe("done");
    expect(chain.landed.map((t) => t.signature)).toEqual([again!.signature]);
  });

  it("two server processes at once: one seal", async () => {
    const { chain, key, rpc } = setUp();
    await milestones([at("2026-10-22T10:00:00Z"), at("2026-10-22T11:00:00Z"), at("2026-10-22T12:00:00Z")]);
    const outcomes = await Promise.all([createNotaryService(db, key, rpc).tick(at("2026-10-23T00:15:00Z")), createNotaryService(db, key, rpc).tick(at("2026-10-23T00:15:00Z"))]);
    expect(outcomes.sort()).toEqual(expect.arrayContaining(["sent"]));
    expect(outcomes.filter((o) => o === "sent")).toHaveLength(1);
    expect((await allSeals()).filter((s) => s.status === "sent")).toHaveLength(1);
    expect(chain.landed).toHaveLength(1);
  });

  it("the database never holds two live seals of one night", async () => {
    const { service, chain } = setUp();
    await milestones([at("2026-10-22T10:00:00Z")]);
    await service.tick(at("2026-10-23T00:15:00Z"));
    const [s] = await allSeals();
    await expect(db.insert(schema.seals).values({ ...s!, id: undefined, signature: "another" })).rejects.toThrow();
    expect(chain.landed).toHaveLength(1);
  });

  it("an empty notary sends nothing and says it is low", async () => {
    const { chain, service } = setUp({ balance: 4_000 });
    await milestones([at("2026-10-22T10:00:00Z")]);
    const log = logs();
    expect(await service.tick(at("2026-10-23T00:15:00Z"), log)).toBe("low");
    expect(chain.sent).toBe(0);
    expect(log.lines[0]).toContain("The notary cannot pay the seal's fee");
    expect(await notaryHealth(db, service, at("2026-10-23T00:20:00Z"))).toBe("low");
  });

  it(`after ${MAX_TRIES_A_NIGHT} tries a night that did not end finalized, it waits for the next night`, async () => {
    const { chain, service } = setUp();
    await milestones([at("2026-10-22T10:00:00Z")]);
    for (let i = 0; i < MAX_TRIES_A_NIGHT; i++) {
      expect(await service.tick(at("2026-10-23T00:15:00Z"))).toBe("sent");
      // The seal landed with an error on chain.
      await db.update(schema.seals).set({ status: "failed" }).where(eq(schema.seals.status, "sent"));
      await db.update(schema.proofs).set({ sealId: null, position: null });
      // A new try gets a new blockhash: the same one would make the same transaction, refused by its signature.
      chain.advance(1);
    }
    expect(await service.tick(at("2026-10-23T00:20:00Z"))).toBe("gave up");
    expect(chain.landed).toHaveLength(MAX_TRIES_A_NIGHT);
  });
});

describe("what the independent review found (week 9)", () => {
  it("a seal that landed is never given up because a node has no history: the night is sealed once", async () => {
    const { chain, service } = setUp();
    await milestones([at("2026-10-22T10:00:00Z")]);
    chain.history = false;
    expect(await service.tick(at("2026-10-23T00:15:00Z"))).toBe("sent");
    // Five minutes later the signature has left the node's recent statuses, and the chain is far past its blockhash.
    chain.advance(750);
    const log = logs();
    for (const t of ["00:20", "00:25", "00:30", "01:30", "06:00"]) {
      expect(await service.tick(at(`2026-10-23T${t}:00Z`), log)).toBe("waiting");
      chain.advance(750);
    }
    expect(chain.landed).toHaveLength(1);
    expect((await allSeals()).map((s) => s.status)).toEqual(["sent"]);
    expect(log.lines.some((l) => l.startsWith("The seal could not be followed"))).toBe(true);
    // A node with history: finalized, still one transaction.
    chain.history = true;
    expect(await service.tick(at("2026-10-23T06:05:00Z"))).toBe("done");
    expect(chain.landed).toHaveLength(1);
  });

  it(`lost transactions count too: at most ${MAX_TRIES_A_NIGHT} a night`, async () => {
    const { chain, service } = setUp();
    await milestones([at("2026-10-22T10:00:00Z")]);
    chain.drop = true;
    const outcomes: string[] = [];
    for (let i = 0; i < 6; i++) {
      outcomes.push(await service.tick(at(`2026-10-23T0${i}:20:00Z`)));
      chain.advance(400);
    }
    expect(outcomes.filter((o) => o === "sent")).toHaveLength(MAX_TRIES_A_NIGHT);
    expect(outcomes.at(-1)).toBe("gave up");
    expect(chain.sent).toBeGreaterThanOrEqual(MAX_TRIES_A_NIGHT);
  });

  it("a seal another process finalized first is left as it is", async () => {
    const { chain, service, key, rpc } = setUp();
    await milestones([at("2026-10-22T10:00:00Z")]);
    await service.tick(at("2026-10-23T00:15:00Z"));
    chain.advance(40);
    // Another process finalized it first.
    await createNotaryService(db, key, rpc).tick(at("2026-10-23T00:20:00Z"));
    const [s] = await allSeals();
    expect(s!.status).toBe("finalized");
    expect((await allProofs()).every((p) => p.sealId === s!.id)).toBe(true);
    expect(await service.tick(at("2026-10-23T00:25:00Z"))).toBe("done");
    expect(chain.landed).toHaveLength(1);
  });

  it("a player deleted leaves every other proof of the same seal as it was", async () => {
    const { chain, service } = setUp();
    const me = await milestones([at("2026-10-22T08:00:00Z")]);
    const other = await milestones([at("2026-10-22T09:00:00Z")]);
    await milestones([at("2026-10-22T10:00:00Z")]);
    await service.tick(at("2026-10-23T00:15:00Z"));
    chain.advance(40);
    await service.tick(at("2026-10-23T00:20:00Z"));
    const token = randomBytes(32).toString("base64url");
    await createSession(db, token, me.id, at("2026-10-22T00:00:00Z"), at("2026-11-22T00:00:00Z"));
    const app = await buildApp({ db, notary: service, now: () => at("2026-10-23T08:00:00Z") });
    const get = async () => ((await app.inject({ method: "GET", url: "/proofs", headers: { authorization: `Bearer ${token}` } })).json() as { proofs: PlayerProof[] }).proofs[0]!;
    const before = await get();
    await db.delete(schema.players).where(eq(schema.players.id, other.id));
    const after = await get();
    expect(after).toEqual(before);
    expect(await checkProofHashes({ ...after, seal: after.seal! }, sha256)).toBeNull();
  });

  it("/health: a milestone sealed on another network still waits", async () => {
    const { service, chain, key } = setUp();
    await milestones([at("2026-10-22T10:00:00Z")]);
    await service.tick(at("2026-10-23T00:15:00Z"));
    chain.advance(40);
    await service.tick(at("2026-10-23T00:20:00Z"));
    const official: NotaryAddress[] = [{ cluster: "devnet", address: key.address, from: "2026-10-01", until: null }];
    expect(await notaryHealth(db, service, at("2026-10-24T12:00:00Z"), official)).toBe("ok");
    await db.update(schema.seals).set({ cluster: "mainnet" });
    expect(await notaryHealth(db, service, at("2026-10-24T12:00:00Z"), official)).toBe("late");
  });
});

describe("the notary in /health", () => {
  const official = (key: NotaryKey): NotaryAddress[] => [{ cluster: "devnet", address: key.address, from: "2026-10-01", until: null }];

  it("off without a notary; ok; late when a milestone waits more than 26 hours; unlisted when its address is not official", async () => {
    const { service, key, chain } = setUp();
    expect(await notaryHealth(db, null, at("2026-10-23T00:00:00Z"))).toBe("off");
    await service.tick(at("2026-10-22T12:00:00Z"));
    expect(await notaryHealth(db, service, at("2026-10-22T12:00:00Z"), official(key))).toBe("ok");
    expect(await notaryHealth(db, service, at("2026-10-22T12:00:00Z"), [])).toBe("unlisted");
    await milestones([at("2026-10-22T10:00:00Z")]);
    expect(await notaryHealth(db, service, at("2026-10-23T12:00:00Z"), official(key))).toBe("ok");
    expect(await notaryHealth(db, service, at("2026-10-23T12:00:01Z"), official(key))).toBe("late");
    // Sent but not finalized still counts as waiting.
    chain.drop = true;
    await service.tick(at("2026-10-23T12:00:01Z"));
    expect(await notaryHealth(db, service, at("2026-10-23T12:00:01Z"), official(key))).toBe("late");
  });

  it("/health says it, and counts it against ok", async () => {
    const { service } = setUp();
    const app = await buildApp({ db, notary: service, now: () => at("2026-10-23T12:00:00Z") });
    const res = await app.inject({ method: "GET", url: "/health" });
    // A throwaway key is never in the official list.
    expect(res.json()).toMatchObject({ ok: false, notary: "unlisted", database: "ok" });
    expect(res.statusCode).toBe(503);
    const without = await buildApp({ db, now: () => at("2026-10-23T12:00:00Z") });
    expect((await without.inject({ method: "GET", url: "/health" })).json()).toMatchObject({ ok: true, notary: "off" });
  });
});

describe("GET /proofs", () => {
  it("a player's own proofs: waiting, then sealed with a path that leads to the seal's root", async () => {
    const { service, chain, key } = setUp();
    const me = await milestones([at("2026-10-22T08:00:00Z"), at("2026-10-22T09:00:00Z")]);
    await milestones([at("2026-10-22T10:00:00Z"), at("2026-10-22T11:00:00Z"), at("2026-10-22T12:00:00Z")]);
    const token = randomBytes(32).toString("base64url");
    await createSession(db, token, me.id, at("2026-10-22T00:00:00Z"), at("2026-11-22T00:00:00Z"));
    let clock = at("2026-10-22T23:00:00Z");
    const app = await buildApp({ db, notary: service, now: () => clock });
    const get = async () => (await app.inject({ method: "GET", url: "/proofs", headers: { authorization: `Bearer ${token}` } })).json() as { notary: unknown; proofs: PlayerProof[] };

    const before = await get();
    expect(before.notary).toEqual({ cluster: "devnet", address: key.address });
    expect(before.proofs.map((p) => [p.fact, p.wallet, p.seal])).toEqual([
      ["lighthouse:5", me.wallet, null],
      ["lighthouse:10", me.wallet, null],
    ]);
    clock = at("2026-10-23T00:15:00Z");
    await service.tick(clock);
    expect((await get()).proofs.every((p) => p.seal === null)).toBe(true);
    chain.advance(40);
    await service.tick(at("2026-10-23T00:20:00Z"));
    const after = await get();
    const [seal] = await allSeals();
    for (const p of after.proofs) {
      expect(p.seal).toMatchObject({ cluster: "devnet", day: "2026-10-22", root: seal!.root, signature: seal!.signature });
      expect(await checkProofHashes({ ...p, seal: p.seal! }, sha256)).toBeNull();
      // Another root: the same proof does not hold.
      expect(await checkProofHashes({ ...p, seal: { ...p.seal!, root: "00".repeat(32) } }, sha256)).toBe("This proof's path does not lead to the seal's root.");
    }
    expect(after.proofs.map((p) => p.seal!.path.length)).toEqual([3, 3]);
  });

  it("signed in only", async () => {
    const app = await buildApp({ db });
    expect((await app.inject({ method: "GET", url: "/proofs" })).statusCode).toBe(401);
  });
});

describe("the key is never anywhere but in the server's memory", () => {
  it("not in a log line, an error, an HTTP answer or the database, through a whole night", async () => {
    const { chain, service, secret, key } = setUp();
    const me = await milestones([at("2026-10-22T08:00:00Z")]);
    const token = randomBytes(32).toString("base64url");
    await createSession(db, token, me.id, at("2026-10-22T00:00:00Z"), at("2026-11-22T00:00:00Z"));
    const log = logs();
    const lines: string[] = [];
    const app = await buildApp({ db, notary: service, now: () => at("2026-10-23T00:30:00Z"), logger: { level: "trace", stream: { write: (l: string) => void lines.push(l) } } });
    // A sending that fails, a lost transaction, then the seal.
    chain.refuse = "Transaction simulation failed";
    await service.tick(at("2026-10-23T00:15:00Z"), log);
    chain.refuse = null;
    chain.drop = true;
    await service.tick(at("2026-10-23T00:20:00Z"), log);
    chain.drop = false;
    chain.advance(400);
    await service.tick(at("2026-10-23T00:25:00Z"), log);
    chain.advance(40);
    await service.tick(at("2026-10-23T00:30:00Z"), log);
    chain.down = true;
    const err = await service.tick(at("2026-10-23T00:35:00Z"), log).catch((e: unknown) => e);
    const answers = [
      (await app.inject({ method: "GET", url: "/health" })).body,
      (await app.inject({ method: "GET", url: "/proofs", headers: { authorization: `Bearer ${token}` } })).body,
    ];
    const dump: unknown[] = [];
    for (const t of ["players", "sessions", "cities", "applied_actions", "proofs", "seals", "auth_nonces"]) dump.push(await db.execute(sql.raw(`select * from ${t}`)));
    const bytes = Buffer.from(await import("../src/auth/base58.js").then((m) => m.base58Decode(secret)!));
    const forms = [secret, bytes.toString("hex"), bytes.toString("base64"), bytes.subarray(0, 32).toString("hex"), bytes.subarray(0, 32).toString("base64"), bytes.subarray(0, 32).toString("base64url")];
    const everything = [...log.lines, ...lines, String(err), inspect(err), ...answers, JSON.stringify(dump), inspect(service, { depth: 6, showHidden: true }), JSON.stringify(service)].join("\n");
    for (const f of forms) expect(everything.includes(f)).toBe(false);
    // What is there is public: the address and the signatures.
    expect(everything).toContain(key.address);
    expect((await allSeals()).map((s) => s.status)).toEqual(["expired", "finalized"]);
  });
});
