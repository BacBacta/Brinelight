import { advance, newPlayerState } from "@brinelight/shared";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  CHANGED_ELSEWHERE,
  UNREADABLE,
  createCity,
  createNonce,
  createSession,
  findOrCreatePlayer,
  findSession,
  hashToken,
  loadCity,
  openDatabase,
  purgeExpired,
  saveCity,
  schema,
  useNonce,
  type Database,
  type Db,
} from "../src/db/index.js";

const T0 = new Date("2026-10-15T12:00:00Z");
const later = (ms: number) => new Date(T0.getTime() + ms);
const MIN = 60_000;
const DAY = 24 * 3600_000;
const WALLET = "7Hc3wTfa1Xp9Q2LmWbR8sKdN4vYzE6uJ5gA1oCiF3tPq";

let database: Database;
let db: Db;
// One PGlite per file (starting one takes about 2 s); every test starts from empty tables.
beforeAll(async () => {
  database = await openDatabase(undefined);
  db = database.db;
}, 30_000);
beforeEach(async () => {
  await db.execute(sql`truncate players, sessions, auth_nonces, cities cascade`);
});
afterAll(async () => {
  await database.close();
});

describe("database", () => {
  it("without DATABASE_URL, opens PGlite in memory and applies the migrations", async () => {
    expect(database.engine).toBe("pglite");
    const rows = await db.execute<{ table_name: string }>(sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`);
    const names = (rows as unknown as { rows: { table_name: string }[] }).rows.map((r) => r.table_name);
    expect(names).toEqual(["auth_nonces", "cities", "players", "sessions"]);
  });

  it("runs the PostgreSQL major version written in docs/decisions.md", async () => {
    const rows = await db.execute<{ server_version_num: string }>(sql`show server_version_num`);
    const num = Number((rows as unknown as { rows: { server_version_num: string }[] }).rows[0]!.server_version_num);
    expect(Math.floor(num / 10000)).toBe(18);
  });
});

describe("players", () => {
  it("one player per wallet; signing in again only updates last_seen_at", async () => {
    const a = await findOrCreatePlayer(db, WALLET, T0);
    const b = await findOrCreatePlayer(db, WALLET, later(DAY));
    expect(b.id).toBe(a.id);
    expect(b.createdAt).toEqual(T0);
    expect(b.lastSeenAt).toEqual(later(DAY));
    expect(await db.select().from(schema.players)).toHaveLength(1);
  });
});

describe("cities", () => {
  it("writes and reads a city, unchanged, at version 1", async () => {
    const p = await findOrCreatePlayer(db, WALLET, T0);
    const city = advance(newPlayerState(), 3600);
    expect(await createCity(db, p.id, city, T0)).toEqual({ ok: true, version: 1 });
    expect(await loadCity(db, p.id)).toEqual({ status: "ok", city: { state: city, version: 1, savedAt: T0 } });
  });

  it("a player with no city has none", async () => {
    const p = await findOrCreatePlayer(db, WALLET, T0);
    expect(await loadCity(db, p.id)).toEqual({ status: "missing" });
  });

  it("each save raises the version by one", async () => {
    const p = await findOrCreatePlayer(db, WALLET, T0);
    await createCity(db, p.id, newPlayerState(), T0);
    expect(await saveCity(db, p.id, advance(newPlayerState(), 60), 1, later(MIN))).toEqual({ ok: true, version: 2 });
    expect(await saveCity(db, p.id, advance(newPlayerState(), 120), 2, later(2 * MIN))).toEqual({ ok: true, version: 3 });
    const loaded = await loadCity(db, p.id);
    expect(loaded.status === "ok" && loaded.city.version).toBe(3);
  });

  it("refuses a save from an old version: two devices cannot overwrite each other", async () => {
    const p = await findOrCreatePlayer(db, WALLET, T0);
    await createCity(db, p.id, newPlayerState(), T0);
    const phone = advance(newPlayerState(), 600);
    const laptop = advance(newPlayerState(), 60);
    expect(await saveCity(db, p.id, phone, 1, later(MIN))).toEqual({ ok: true, version: 2 });
    expect(await saveCity(db, p.id, laptop, 1, later(2 * MIN))).toEqual({ ok: false, reason: CHANGED_ELSEWHERE });
    const loaded = await loadCity(db, p.id);
    expect(loaded.status === "ok" && loaded.city.state).toEqual(phone);
  });

  it("refuses an invalid city at write time, and a second first city", async () => {
    const p = await findOrCreatePlayer(db, WALLET, T0);
    const { pearls: _p, ...noPearls } = newPlayerState();
    expect(await createCity(db, p.id, noPearls, T0)).toEqual({ ok: false, reason: "This city is not valid" });
    await createCity(db, p.id, newPlayerState(), T0);
    expect(await createCity(db, p.id, newPlayerState(), T0)).toEqual({ ok: false, reason: CHANGED_ELSEWHERE });
    expect(await saveCity(db, p.id, { ...newPlayerState(), pearls: -1 }, 1, T0)).toEqual({ ok: false, reason: "This city is not valid" });
  });

  it("a stored city that parseState refuses is reported, logged with the player id only, and left intact", async () => {
    const p = await findOrCreatePlayer(db, WALLET, T0);
    await createCity(db, p.id, newPlayerState(), T0);
    // The stored document gets damaged (by hand, or by an old server).
    const broken = { ...newPlayerState(), world: { camps: {}, wrecks: {} } };
    await db.update(schema.cities).set({ state: broken });
    const logs: { fields: Record<string, unknown>; message: string }[] = [];
    const r = await loadCity(db, p.id, { error: (fields, message) => logs.push({ fields, message }) });
    expect(r).toEqual({ status: "unreadable", reason: UNREADABLE });
    expect(logs).toEqual([{ fields: { playerId: p.id, version: 1 }, message: "Stored city refused by parseState" }]);
    expect(JSON.stringify(logs)).not.toContain("camps");
    const [row] = await db.select().from(schema.cities);
    expect(row!.state).toEqual(broken);
    expect(row!.version).toBe(1);
  });

  it("deleting a player deletes their city and sessions", async () => {
    const p = await findOrCreatePlayer(db, WALLET, T0);
    await createCity(db, p.id, newPlayerState(), T0);
    await createSession(db, "token", p.id, T0, later(DAY));
    await db.delete(schema.players);
    expect(await db.select().from(schema.cities)).toEqual([]);
    expect(await db.select().from(schema.sessions)).toEqual([]);
  });
});

describe("sessions and nonces", () => {
  it("stores only the SHA-256 hash of a session token", async () => {
    const p = await findOrCreatePlayer(db, WALLET, T0);
    const token = "a-secret-session-token";
    await createSession(db, token, p.id, T0, later(30 * DAY));
    const rows = await db.select().from(schema.sessions);
    expect(rows[0]!.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("finds a session until it expires", async () => {
    const p = await findOrCreatePlayer(db, WALLET, T0);
    await createSession(db, "t", p.id, T0, later(30 * DAY));
    expect(await findSession(db, "t", later(29 * DAY))).toEqual({ playerId: p.id, expiresAt: later(30 * DAY) });
    expect(await findSession(db, "t", later(30 * DAY))).toBeNull();
    expect(await findSession(db, "other", T0)).toBeNull();
  });

  it("a nonce is used once, and never after it expires", async () => {
    await createNonce(db, "n1", T0, later(5 * MIN));
    expect(await useNonce(db, "n1", later(MIN))).toBe(true);
    expect(await useNonce(db, "n1", later(2 * MIN))).toBe(false);
    await createNonce(db, "n2", T0, later(5 * MIN));
    expect(await useNonce(db, "n2", later(5 * MIN))).toBe(false);
    expect(await useNonce(db, "unknown", T0)).toBe(false);
  });
});

describe("purgeExpired", () => {
  it("deletes nonces expired unused or used more than a day ago, and expired sessions", async () => {
    const p = await findOrCreatePlayer(db, WALLET, T0);
    await createNonce(db, "fresh", T0, later(5 * MIN));
    await createNonce(db, "expired", T0, later(5 * MIN));
    await createNonce(db, "used-recently", T0, later(5 * MIN));
    await createNonce(db, "used-long-ago", T0, later(5 * MIN));
    await useNonce(db, "used-long-ago", later(MIN));
    await createSession(db, "live", p.id, T0, later(30 * DAY));
    await createSession(db, "dead", p.id, T0, later(DAY));

    // Two days later; "used-recently" was used an hour ago (its creation time is moved to fit).
    const now = later(2 * DAY);
    await db.update(schema.authNonces).set({ createdAt: later(2 * DAY - 70 * MIN), expiresAt: later(2 * DAY - 65 * MIN), usedAt: later(2 * DAY - 60 * MIN) }).where(sql`nonce = 'used-recently'`);
    await db.update(schema.authNonces).set({ expiresAt: later(2 * DAY + 5 * MIN) }).where(sql`nonce = 'fresh'`);

    expect(await purgeExpired(db, now)).toEqual({ nonces: 2, sessions: 1 });
    const left = (await db.select().from(schema.authNonces)).map((n) => n.nonce).sort();
    expect(left).toEqual(["fresh", "used-recently"]);
    expect(await findSession(db, "live", now)).not.toBeNull();
    expect(await db.select().from(schema.sessions)).toHaveLength(1);
  });

  it("does nothing on an empty database", async () => {
    expect(await purgeExpired(db, T0)).toEqual({ nonces: 0, sessions: 0 });
  });
});
