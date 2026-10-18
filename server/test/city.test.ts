import { randomBytes } from "node:crypto";
import { catchUp, newPlayerState, storeCap, upgrade, type PlayerState } from "@brinelight/shared";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { ACTION_REFUSED } from "../src/city/actions.js";
import { CITY_REFUSED } from "../src/city/routes.js";
import { createSession, findOrCreatePlayer, openDatabase, schema, type Database, type Db } from "../src/db/index.js";
import { SIGNED_OUT } from "../src/refusals.js";

const T0 = new Date("2026-10-15T12:00:00.000Z");
const HOUR = 3600_000;
const DAY = 24 * HOUR;

let database: Database;
let db: Db;
let clock: Date;
const setClock = (ms: number) => (clock = new Date(T0.getTime() + ms));

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
const app = (): Promise<App> => buildApp({ db, now: () => clock });

/** A signed-in player, straight in the database (sign-in itself is tested in auth.test.ts). */
async function player(wallet = `W${randomBytes(8).toString("hex")}`) {
  const p = await findOrCreatePlayer(db, wallet, clock);
  const token = randomBytes(32).toString("base64url");
  await createSession(db, token, p.id, clock, new Date(clock.getTime() + 30 * DAY));
  return { id: p.id, token };
}

const getCity = (server: App, token: string) => server.inject({ method: "GET", url: "/city", headers: { authorization: `Bearer ${token}` } });
/** Puts a city in the database for a player, saved at the current clock (it changes only through actions). */
const storeCity = (playerId: string, state: PlayerState, version = 1) => db.insert(schema.cities).values({ playerId, state, version, savedAt: clock });

const json = (v: unknown) => JSON.parse(JSON.stringify(v));

describe("GET /city", () => {
  it("first visit of a new account: the server makes a new city, at version 1; the next visit gives the same city", async () => {
    const server = await app();
    const { token, id } = await player();
    const res = await getCity(server, token);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ state: json(newPlayerState(T0.getTime() / 1000)), version: 1, savedAt: T0.toISOString(), asOf: T0.toISOString(), speed: 1 });
    expect(await db.select().from(schema.cities).where(eq(schema.cities.playerId, id))).toHaveLength(1);
    setClock(HOUR);
    const again = (await getCity(server, token)).json();
    expect(again).toEqual({ state: json(catchUp(newPlayerState(T0.getTime() / 1000), 3600)), version: 1, savedAt: T0.toISOString(), asOf: clock.toISOString(), speed: 1 });
  });

  it("time away is computed by the server", async () => {
    const server = await app();
    const { token, id } = await player();
    const city = newPlayerState();
    await storeCity(id, city);
    setClock(2 * HOUR);
    const res = await getCity(server, token);
    expect(res.json()).toEqual({ state: json(catchUp(city, 7200)), version: 1, savedAt: T0.toISOString(), asOf: clock.toISOString(), speed: 1 });
    expect(res.json().state.stock).not.toEqual(json(city.stock));
  });

  it("20 h away count in full: the upgrade started before is finished", async () => {
    const server = await app();
    const { token, id } = await player();
    const up = upgrade(newPlayerState(), "refinery");
    if (!up.ok) throw new Error(up.reason);
    await storeCity(id, up.state);
    setClock(20 * HOUR);
    const state = (await getCity(server, token)).json().state;
    // catchUp takes seconds (HOUR here is in milliseconds).
    expect(state).toEqual(json(catchUp(up.state, 20 * 3600)));
    expect(state.buildings.refinery).toBe(2);
    expect(state.queue).toEqual([]);
    expect(state.stock.wood).toBeLessThanOrEqual(storeCap(state.buildings.lighthouse, state.techs));
  });

  it("reading twice gives the same city: nothing is stored by a read", async () => {
    const server = await app();
    const { token, id } = await player();
    await storeCity(id, newPlayerState());
    setClock(3 * HOUR);
    const a = (await getCity(server, token)).json();
    const b = (await getCity(server, token)).json();
    expect(b).toEqual(a);
    const [row] = await db.select().from(schema.cities).where(eq(schema.cities.playerId, id));
    expect(row!.version).toBe(1);
    expect(row!.savedAt).toEqual(T0);
  });

  it("an unreadable stored city is reported, never replaced by a new one", async () => {
    const server = await app();
    const { token, id } = await player();
    await db.insert(schema.cities).values({ playerId: id, state: { broken: true }, version: 4, savedAt: T0 });
    const res = await getCity(server, token);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual(CITY_REFUSED.unreadable);
    const [row] = await db.select().from(schema.cities).where(eq(schema.cities.playerId, id));
    expect(row).toMatchObject({ state: { broken: true }, version: 4 });
  });

  it("a player never sees another player's city", async () => {
    const server = await app();
    const a = await player();
    const b = await player();
    const up = upgrade(newPlayerState(), "refinery");
    if (!up.ok) throw new Error(up.reason);
    await storeCity(a.id, up.state, 7);
    expect((await getCity(server, b.token)).json()).toMatchObject({ state: json(newPlayerState(T0.getTime() / 1000)), version: 1 });
  });

  it("the client can no longer send its city: PUT /city is gone", async () => {
    const server = await app();
    const { token, id } = await player();
    const res = await server.inject({ method: "PUT", url: "/city", headers: { authorization: `Bearer ${token}` }, payload: { state: newPlayerState(), version: 0 } });
    expect(res.statusCode).toBe(404);
    expect(await db.select().from(schema.cities).where(eq(schema.cities.playerId, id))).toHaveLength(0);
  });
});

describe("signed out", () => {
  it("no session, an unknown token or an expired session: 401, and no city is made", async () => {
    const server = await app();
    const { token } = await player();
    const tries = [{}, { authorization: `Bearer ${"A".repeat(43)}` }, { authorization: "Bearer short" }];
    for (const headers of tries) {
      const res = await server.inject({ method: "GET", url: "/city", headers });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual(SIGNED_OUT);
    }
    setClock(31 * DAY);
    expect((await getCity(server, token)).json()).toEqual(SIGNED_OUT);
    expect(await db.select().from(schema.cities)).toHaveLength(0);
  });
});

describe("refusals", () => {
  it("every refusal has its own stable code and a text for the player", async () => {
    const { REFUSED } = await import("../src/auth/routes.js");
    const refusals = await import("../src/refusals.js");
    const all = [
      ...Object.values(REFUSED),
      ...Object.values(CITY_REFUSED),
      ...Object.values(ACTION_REFUSED),
      ...Object.values(refusals).filter((v) => typeof v === "object"),
    ] as { code: string; error: string }[];
    const unique = new Map(all.map((r) => [r.code, r.error]));
    for (const [code, error] of unique) {
      expect(code).toMatch(/^[a-z_]+$/);
      expect(error.length).toBeGreaterThan(5);
    }
    // The same code always carries the same text (a shared refusal may be listed twice).
    expect(new Set(all.map((r) => `${r.code}|${r.error}`)).size).toBe(unique.size);
    expect([...unique.keys()]).toEqual(
      expect.arrayContaining(["signed_out", "unreadable_city", "invalid_action", "action_id_reused", "action_too_large", "too_many_actions", "server_error"]),
    );
    // The codes of the week 3 saves are gone with PUT /city.
    for (const gone of ["version_conflict", "invalid_city", "city_too_large", "too_many_saves"]) expect(unique.has(gone), gone).toBe(false);
  });
});
