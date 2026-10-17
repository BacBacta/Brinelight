/**
 * Cities stored in an older shape, read and written by today's server. Runs on PGlite with the other tests, and on a
 * real PostgreSQL in the CI (job "postgres", with TEST_DATABASE_URL), where the column `shape` comes from the
 * migration 0003 applied to a database as the week 4 server left it.
 * Locally: TEST_DATABASE_URL=postgres://…@127.0.0.1:5432/brinelight_test npx vitest run server/test/migration.test.ts
 */
import { randomBytes, randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Writable } from "node:stream";
import { CITY_SHAPE, DAY, catchUp, emptyTroops, migrateCity, type GameAction, type PlayerState } from "@brinelight/shared";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createSession, findOrCreatePlayer, openDatabase, schema, type Database, type Db } from "../src/db/index.js";
import * as dbSchema from "../src/db/schema.js";
import { checkTestDatabaseUrl } from "./testDatabase.js";

const TEST_URL = process.env.TEST_DATABASE_URL || undefined;
if (TEST_URL) checkTestDatabaseUrl(TEST_URL);

/** The city of week 4, made by the week 4 rules and stored as it is (shared/test/fixtures/README.md). */
const WEEK4: Record<string, unknown> = JSON.parse(readFileSync(new URL("../../shared/test/fixtures/city-week4.json", import.meta.url), "utf8"));
const T0 = new Date("2026-10-18T12:00:00.000Z");
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));

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

/**
 * A signed-in player whose city row is stored as an older server stored it: `shape` left out (the column's default,
 * as for the rows that existed before it), or given.
 */
async function playerWithRow(state: unknown, version: number, shape?: number) {
  const wallet = `W${randomBytes(8).toString("hex")}`;
  const p = await findOrCreatePlayer(db, wallet, T0);
  const token = randomBytes(32).toString("base64url");
  await createSession(db, token, p.id, T0, new Date(T0.getTime() + 30 * 24 * 3600_000));
  if (shape === undefined) {
    // Written without the column, as the week 4 server did: the database gives it its default.
    await db.execute(sql`insert into cities (player_id, state, version, saved_at) values (${p.id}, ${JSON.stringify(state)}::jsonb, ${version}, ${T0})`);
  } else {
    await db.insert(schema.cities).values({ playerId: p.id, state, version, shape, savedAt: T0 });
  }
  return { id: p.id, token, wallet };
}
const row = async (playerId: string) => (await db.select().from(schema.cities).where(eq(schema.cities.playerId, playerId)))[0]!;

describe(`a city stored by the week 4 server (${TEST_URL ? "PostgreSQL" : "PGlite"})`, () => {
  const logged = () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, done) {
        lines.push(String(chunk));
        done();
      },
    });
    return { lines, logger: { level: "info", stream } as const };
  };

  it("a row stored before the column existed is shape 4", async () => {
    const p = await playerWithRow(WEEK4, 7);
    expect((await row(p.id)).shape).toBe(4);
  });

  it("GET /city shows it brought up to date, with its fleet at sea and its reports, and writes nothing", async () => {
    const p = await playerWithRow(WEEK4, 7);
    const server = await buildApp({ db, now: () => T0 });
    const res = await server.inject({ method: "GET", url: "/city", headers: { authorization: `Bearer ${p.token}` } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { state: PlayerState; version: number };
    expect(body.state).toEqual(json(catchUp(migrateCity(WEEK4, 4)!, 0)));
    expect(body.version).toBe(7);
    expect(body.state.fleets).toHaveLength(1);
    expect(body.state.fleets[0]).toMatchObject({ site: "camp-2", phase: "out", veterans: emptyTroops() });
    expect(body.state.reports.map((r) => [r.id, r.read])).toEqual([
      ["r1", true],
      ["r2", false],
    ]);
    // Nothing written: the row is still the one of week 4.
    const stored = await row(p.id);
    expect(stored).toMatchObject({ state: WEEK4, version: 7, shape: 4 });
    await server.close();
  });

  it("the first action that changes it writes it in the current shape; the log has the player id and the two shapes only", async () => {
    const p = await playerWithRow(WEEK4, 7);
    const { lines, logger } = logged();
    const server = await buildApp({ db, now: () => T0, logger });
    const action: GameAction = { id: randomUUID(), type: "readReport", reportId: "r2" };
    const res = await server.inject({ method: "POST", url: "/city/actions", headers: { authorization: `Bearer ${p.token}` }, payload: { action } });
    expect(res.statusCode).toBe(200);
    const stored = await row(p.id);
    expect(stored.shape).toBe(CITY_SHAPE);
    expect(stored.version).toBe(8);
    const state = stored.state as PlayerState;
    expect(state).toEqual(json(res.json().state));
    expect(state).toMatchObject({ training: null, healing: null, veterans: emptyTroops(), shards: {} });
    expect(state.fleets[0]).toMatchObject({ site: "camp-2", veterans: emptyTroops() });
    expect(state.reports.map((r) => [r.id, r.read])).toEqual([
      ["r1", true],
      ["r2", true],
    ]);
    // The migration's log line: the player id and the two shapes, never the city or a wallet address.
    const line = lines.find((l) => l.includes("Stored city written in the current shape"));
    expect(line).toBeDefined();
    expect(JSON.parse(line!)).toMatchObject({ playerId: p.id, from: 4, to: CITY_SHAPE });
    const all = lines.join("");
    for (const word of [p.wallet, '"buildings"', '"fleets"', '"reports"', '"state"', "camp-2"]) expect(all, word).not.toContain(word);
    // Read again: already in the current shape, nothing more to log.
    const again = await server.inject({ method: "GET", url: "/city", headers: { authorization: `Bearer ${p.token}` } });
    expect(again.json().state).toEqual(json(state));
    await server.close();
  });

  it("an action that changes nothing writes nothing: the city stays in shape 4 until its next change", async () => {
    const p = await playerWithRow(WEEK4, 7);
    const server = await buildApp({ db, now: () => T0 });
    const action: GameAction = { id: randomUUID(), type: "readReport", reportId: "r1" };
    const res = await server.inject({ method: "POST", url: "/city/actions", headers: { authorization: `Bearer ${p.token}` }, payload: { action } });
    expect(res.statusCode).toBe(200);
    expect(await row(p.id)).toMatchObject({ state: WEEK4, version: 7, shape: 4 });
    await server.close();
  });

  it("time goes on: the fleet of week 4 fights at camp-2 and comes home, by the server's clock", async () => {
    const p = await playerWithRow(WEEK4, 7);
    const server = await buildApp({ db, now: () => new Date(T0.getTime() + DAY * 1000) });
    const res = await server.inject({ method: "GET", url: "/city", headers: { authorization: `Bearer ${p.token}` } });
    expect(res.statusCode).toBe(200);
    const state = res.json().state as PlayerState;
    expect(state.fleets).toEqual([]);
    expect(state.reports.map((r) => r.site)).toEqual(["camp-1", "camp-6", "camp-2"]);
    await server.close();
  });

  it("two actions at once on a city of shape 4: both applied, in order, and it is written in the current shape", async () => {
    const p = await playerWithRow(WEEK4, 7);
    const server = await buildApp({ db, now: () => T0 });
    const send = (action: GameAction) => server.inject({ method: "POST", url: "/city/actions", headers: { authorization: `Bearer ${p.token}` }, payload: { action } });
    const results = await Promise.all([
      send({ id: randomUUID(), type: "readReport", reportId: "r2" }),
      send({ id: randomUUID(), type: "upgrade", building: "fishery" }),
    ]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
    const stored = await row(p.id);
    expect(stored.version).toBe(9);
    expect(stored.shape).toBe(CITY_SHAPE);
    const state = stored.state as PlayerState;
    expect(state.reports[1]!.read).toBe(true);
    expect(state.queue.map((j) => j.id)).toContain("fishery");
    await server.close();
  });
});

describe(`cities that cannot be read (${TEST_URL ? "PostgreSQL" : "PGlite"})`, () => {
  for (const [name, state, shape] of [
    ["a city from a newer shape than the server knows", WEEK4, 99],
    ["a city from before week 4", WEEK4, 3],
    ["a city of shape 4 with a field the rules refuse", { ...WEEK4, pearls: "lots" }, 4],
  ] as const) {
    it(`${name}: refused, and left as it is`, async () => {
      const p = await playerWithRow(state, 7, shape);
      const server = await buildApp({ db, now: () => T0 });
      const get = await server.inject({ method: "GET", url: "/city", headers: { authorization: `Bearer ${p.token}` } });
      expect(get.statusCode).toBe(409);
      expect(get.json().code).toBe("unreadable_city");
      const action: GameAction = { id: randomUUID(), type: "upgrade", building: "fishery" };
      const post = await server.inject({ method: "POST", url: "/city/actions", headers: { authorization: `Bearer ${p.token}` }, payload: { action } });
      expect(post.statusCode).toBe(409);
      expect(await row(p.id)).toMatchObject({ state: json(state), version: 7, shape });
      await server.close();
    });
  }
});

describe(`a database left by the week 4 server, opened by today's (${TEST_URL ? "PostgreSQL" : "PGlite"})`, () => {
  /** The committed migrations up to `last` (0002: the last of week 4), as the week 4 server applied them. */
  function migrationsUpTo(last: number): string {
    const dir = mkdtempSync(join(tmpdir(), "brinelight-drizzle-"));
    cpSync(fileURLToPath(new URL("../drizzle", import.meta.url)), dir, { recursive: true });
    const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { idx: number }[] };
    journal.entries = journal.entries.filter((e) => e.idx <= last);
    writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify(journal));
    return dir;
  }

  it("migration 0003 gives its cities shape 4; they open with their fleet and reports, and are written in the current shape", async () => {
    const week4 = migrationsUpTo(2);
    const all = fileURLToPath(new URL("../drizzle", import.meta.url));
    let old: Db;
    let migrateAll: () => Promise<void>;
    let close: () => Promise<void>;
    if (TEST_URL) {
      // The real database, emptied: the other files of the job run one after the other (--no-file-parallelism).
      const { Pool } = await import("pg");
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      const pool = new Pool({ connectionString: TEST_URL });
      await pool.query("drop schema public cascade; create schema public; drop schema if exists drizzle cascade");
      const d = drizzle(pool, { schema: dbSchema });
      await migrate(d, { migrationsFolder: week4 });
      old = d as unknown as Db;
      migrateAll = () => migrate(d, { migrationsFolder: all });
      close = () => pool.end();
    } else {
      const { PGlite } = await import("@electric-sql/pglite");
      const { drizzle } = await import("drizzle-orm/pglite");
      const { migrate } = await import("drizzle-orm/pglite/migrator");
      const client = new PGlite();
      const d = drizzle(client, { schema: dbSchema });
      await migrate(d, { migrationsFolder: week4 });
      old = d as unknown as Db;
      migrateAll = () => migrate(d, { migrationsFolder: all });
      close = () => client.close();
    }
    try {
      // The week 4 server's database: no column `shape`; a player, a session and the city of week 4.
      const columns = await old.execute(sql`select column_name from information_schema.columns where table_name = 'cities'`);
      // node-postgres and PGlite both answer with { rows }.
      expect((columns as unknown as { rows: { column_name: string }[] }).rows.map((c) => c.column_name)).toEqual(expect.arrayContaining(["state", "version"]));
      expect((columns as unknown as { rows: { column_name: string }[] }).rows.map((c) => c.column_name)).not.toContain("shape");
      const p = await findOrCreatePlayer(old, `W${randomBytes(8).toString("hex")}`, T0);
      const token = randomBytes(32).toString("base64url");
      await createSession(old, token, p.id, T0, new Date(T0.getTime() + 30 * 24 * 3600_000));
      await old.execute(sql`insert into cities (player_id, state, version, saved_at) values (${p.id}, ${JSON.stringify(WEEK4)}::jsonb, ${7}, ${T0})`);

      // Today's server starts: it applies 0003 only.
      await migrateAll();
      expect((await old.select().from(schema.cities))[0]).toMatchObject({ state: WEEK4, version: 7, shape: 4 });
      const server = await buildApp({ db: old, now: () => T0 });
      const get = await server.inject({ method: "GET", url: "/city", headers: { authorization: `Bearer ${token}` } });
      expect(get.statusCode).toBe(200);
      expect(get.json().state.fleets).toHaveLength(1);
      expect(get.json().state.reports).toHaveLength(2);
      const action: GameAction = { id: randomUUID(), type: "readReport", reportId: "r2" };
      const post = await server.inject({ method: "POST", url: "/city/actions", headers: { authorization: `Bearer ${token}` }, payload: { action } });
      expect(post.statusCode).toBe(200);
      const [after] = await old.select().from(schema.cities);
      expect(after).toMatchObject({ version: 8, shape: CITY_SHAPE });
      expect((after!.state as PlayerState).fleets[0]).toMatchObject({ site: "camp-2", veterans: emptyTroops() });
      expect((after!.state as PlayerState).reports.map((r) => r.read)).toEqual([true, true]);
      await server.close();
    } finally {
      await close();
      rmSync(week4, { recursive: true, force: true });
    }
  }, 60_000);
});
