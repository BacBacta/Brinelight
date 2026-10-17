/**
 * Actions sent at the same moment on the same city. PGlite has one connection and runs transactions one after
 * the other, so it cannot reveal a locking bug: the CI also runs this file on a real PostgreSQL (job "postgres"),
 * with TEST_DATABASE_URL. Locally: TEST_DATABASE_URL=postgres://…@127.0.0.1:5432/brinelight_test npx vitest run server/test/concurrency.test.ts
 * Check of the check: without the row lock (FOR UPDATE in db/actions.ts), these tests fail on PostgreSQL.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { HOUR, advance, newPlayerState, sail, type GameAction, type PlayerState } from "@brinelight/shared";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createSession, findOrCreatePlayer, openDatabase, schema, type Database, type Db } from "../src/db/index.js";
import { checkTestDatabaseUrl } from "./testDatabase.js";

const TEST_URL = process.env.TEST_DATABASE_URL || undefined;
if (TEST_URL) checkTestDatabaseUrl(TEST_URL);

const T0 = new Date("2026-10-15T12:00:00.000Z");
let database: Database;
let db: Db;

beforeAll(async () => {
  database = await openDatabase(TEST_URL);
  db = database.db;
}, 60_000);
beforeEach(async () => {
  await db.execute(sql`truncate players, sessions, auth_nonces, cities, applied_actions cascade`);
});
afterAll(async () => {
  await database?.close();
});

async function playerWithCity(state: PlayerState, version = 1) {
  const p = await findOrCreatePlayer(db, `W${randomBytes(8).toString("hex")}`, T0);
  const token = randomBytes(32).toString("base64url");
  await createSession(db, token, p.id, T0, new Date(T0.getTime() + 30 * 24 * 3600_000));
  await db.insert(schema.cities).values({ playerId: p.id, state, version, savedAt: T0 });
  return { id: p.id, token };
}
const stored = async (playerId: string) => (await db.select().from(schema.cities).where(eq(schema.cities.playerId, playerId)))[0]!;
const appliedCount = async (playerId: string) => (await db.select().from(schema.appliedActions).where(eq(schema.appliedActions.playerId, playerId))).length;

describe(`actions at the same moment (${TEST_URL ? "PostgreSQL" : "PGlite"})`, () => {
  // One server for all requests of a test, built before they leave, so they really start together.
  let server: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    server = await buildApp({ db, now: () => T0 });
  });
  afterEach(async () => {
    await server.close();
  });
  const send = (token: string, action: GameAction) =>
    server.inject({ method: "POST", url: "/city/actions", headers: { authorization: `Bearer ${token}` }, payload: { action } });

  /**
   * Sends the actions together. On PostgreSQL, another connection holds the city row meanwhile, and lets it go
   * only once every action waits for it: each one has read the city before any writes, the worst case.
   * Without the row lock, they would all write over each other. On PGlite, they are simply sent together.
   */
  async function together(player: { id: string; token: string }, actions: GameAction[]) {
    if (!TEST_URL) return Promise.all(actions.map((a) => send(player.token, a)));
    const { Client } = await import("pg");
    const holder = new Client({ connectionString: TEST_URL });
    const watcher = new Client({ connectionString: TEST_URL });
    await holder.connect();
    await watcher.connect();
    try {
      await holder.query("begin");
      await holder.query("select 1 from cities where player_id = $1 for update", [player.id]);
      const sent = Promise.all(actions.map((a) => send(player.token, a)));
      for (const deadline = Date.now() + 10_000; ; ) {
        const { rows } = await watcher.query<{ n: number }>(
          "select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'",
        );
        if (rows[0]!.n >= actions.length) break;
        if (Date.now() > deadline) throw new Error(`Only ${rows[0]!.n} of ${actions.length} actions waited for the city`);
        await new Promise((r) => setTimeout(r, 10));
      }
      await holder.query("commit");
      return await sent;
    } finally {
      await holder.query("rollback").catch(() => undefined);
      await holder.end();
      await watcher.end();
    }
  }

  it("two different actions on the same city are each applied once, and the version goes up by 2", async () => {
    const player = await playerWithCity(newPlayerState(), 1);
    const { id } = player;
    const results = await together(player, [
      { id: randomUUID(), type: "upgrade", building: "refinery" },
      { id: randomUUID(), type: "upgrade", building: "fishery" },
    ]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
    const city = await stored(id);
    expect(city.version).toBe(3);
    expect((city.state as PlayerState).queue.map((j) => j.id).sort()).toEqual(["fishery", "refinery"]);
    expect(await appliedCount(id)).toBe(2);
  });

  it("ten actions at once, each changing the city: none is lost", async () => {
    // A city with 10 unread reports: reading each one is a change of its own.
    let city = newPlayerState();
    for (let i = 0; i < 10; i++) {
      const r = sail({ ...city, troops: { boarders: 25, harpooners: 25, crossbowmen: 25 } }, "camp-1");
      if (!r.ok) throw new Error(r.reason);
      city = advance(r.state, 8 * HOUR);
    }
    const player = await playerWithCity(city, 1);
    const { id } = player;
    const results = await together(
      player,
      city.reports.map((r) => ({ id: randomUUID(), type: "readReport", reportId: r.id })),
    );
    expect(results.map((r) => r.statusCode)).toEqual(Array(10).fill(200));
    const after = await stored(id);
    expect((after.state as PlayerState).reports.every((r) => r.read)).toBe(true);
    expect(after.version).toBe(11);
  });

  it("the same action sent twice at once is applied once; the other answer is a replay", async () => {
    const player = await playerWithCity(newPlayerState(), 1);
    const { id } = player;
    const action: GameAction = { id: randomUUID(), type: "upgrade", building: "refinery" };
    const results = await together(player, [action, action]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(results.map((r) => r.json().replayed === true).sort()).toEqual([false, true]);
    expect((await stored(id)).version).toBe(2);
    expect(await appliedCount(id)).toBe(1);
  });

  it("two first actions of a player without a city: the city is created once, and both are applied", async () => {
    const p = await findOrCreatePlayer(db, `W${randomBytes(8).toString("hex")}`, T0);
    const token = randomBytes(32).toString("base64url");
    await createSession(db, token, p.id, T0, new Date(T0.getTime() + 30 * 24 * 3600_000));
    const results = await Promise.all([
      send(token, { id: randomUUID(), type: "upgrade", building: "refinery" }),
      send(token, { id: randomUUID(), type: "upgrade", building: "fishery" }),
    ]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
    const city = await stored(p.id);
    expect(city.version).toBe(3);
    expect((city.state as PlayerState).queue.map((j) => j.id).sort()).toEqual(["fishery", "refinery"]);
  });
});

describe("the safety check on TEST_DATABASE_URL", () => {
  it("accepts a test database on this machine only", () => {
    expect(() => checkTestDatabaseUrl("postgres://u:p@localhost:5432/brinelight_test")).not.toThrow();
    expect(() => checkTestDatabaseUrl("postgres://u:p@127.0.0.1:55432/test")).not.toThrow();
    expect(() => checkTestDatabaseUrl("postgres://u:p@[::1]:5432/my_test_db")).not.toThrow();
    expect(() => checkTestDatabaseUrl("postgres://u:p@db.example.com:5432/brinelight_test")).toThrow("must point to this machine");
    expect(() => checkTestDatabaseUrl("postgres://u:p@10.0.0.5:5432/brinelight_test")).toThrow("must point to this machine");
    expect(() => checkTestDatabaseUrl("postgres://u:p@localhost:5432/brinelight")).toThrow('contains "test"');
    expect(() => checkTestDatabaseUrl("not a url")).toThrow("not a valid address");
  });
});
