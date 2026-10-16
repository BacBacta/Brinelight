import { randomBytes, randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import { HOUR, MAX_REPORT_SEQ, applyAction, catchUp, newPlayerState, parseState, sail, upgrade, upgradeTime, type GameAction, type PlayerState } from "@brinelight/shared";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp, type AppOptions } from "../src/app.js";
import { ACTIONS_PER_MINUTE, ACTION_MAX_BYTES, ACTION_REFUSED } from "../src/city/actions.js";
import { CITY_REFUSED } from "../src/city/routes.js";
import { loadConfig } from "../src/config.js";
import { createSession, findOrCreatePlayer, openDatabase, purgeOldActions, schema, type Database, type Db } from "../src/db/index.js";
import { SERVER_ERROR, SIGNED_OUT } from "../src/refusals.js";

const T0 = new Date("2026-10-15T12:00:00.000Z");
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR_MS = 60 * MINUTE;
const DAY_MS = 24 * HOUR_MS;

let database: Database;
let db: Db;
let clock: Date;
const setClock = (ms: number) => (clock = new Date(T0.getTime() + ms));

beforeAll(async () => {
  database = await openDatabase(undefined);
  db = database.db;
}, 30_000);
beforeEach(async () => {
  await db.execute(sql`truncate players, sessions, auth_nonces, cities, applied_actions cascade`);
  clock = T0;
});
afterAll(async () => {
  await database.close();
});

type App = Awaited<ReturnType<typeof buildApp>>;
const app = (options: AppOptions = {}): Promise<App> => buildApp({ db, now: () => clock, ...options });

/** A signed-in player, straight in the database (sign-in itself is tested in auth.test.ts). */
async function player() {
  const p = await findOrCreatePlayer(db, `W${randomBytes(8).toString("hex")}`, clock);
  const token = randomBytes(32).toString("base64url");
  await createSession(db, token, p.id, clock, new Date(clock.getTime() + 30 * DAY_MS));
  return { id: p.id, token };
}

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const upgradeOf = (building: "refinery" | "fishery" | "lumberyard", id = randomUUID()): GameAction => ({ id, type: "upgrade", building });

const send = (server: App, token: string, body: unknown, headers: Record<string, string> = {}) =>
  server.inject({ method: "POST", url: "/city/actions", headers: { authorization: `Bearer ${token}`, ...headers }, payload: body as object });

/** The city stored for a player: state, version and save time. */
async function stored(playerId: string) {
  const [row] = await db.select().from(schema.cities).where(eq(schema.cities.playerId, playerId));
  return row;
}
const appliedCount = async (playerId: string) => (await db.select().from(schema.appliedActions).where(eq(schema.appliedActions.playerId, playerId))).length;

/** Puts a given city in the database for a player, saved at `clock`. */
async function putCity(playerId: string, state: PlayerState, version = 1) {
  await db.insert(schema.cities).values({ playerId, state, version, savedAt: clock });
}

describe("POST /city/actions", () => {
  it("refuses a request without a session", async () => {
    const server = await app();
    const res = await server.inject({ method: "POST", url: "/city/actions", payload: { action: upgradeOf("refinery") } });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(SIGNED_OUT);
  });

  it("the first action of an account without a city: the server makes the city, then applies the action", async () => {
    const server = await app();
    const { id, token } = await player();
    expect(await stored(id)).toBeUndefined();
    const res = await send(server, token, { action: upgradeOf("refinery") });
    expect(res.statusCode).toBe(200);
    const expected = upgrade(newPlayerState(), "refinery");
    if (!expected.ok) throw new Error(expected.reason);
    expect(res.json()).toEqual({ state: json(expected.state), version: 2, asOf: T0.toISOString(), speed: 1 });
    expect((await stored(id))!.version).toBe(2);
  });

  it("an accepted action: the city advanced to now with the server clock, then the action, saved at version + 1", async () => {
    const server = await app();
    const { id, token } = await player();
    await send(server, token, { action: upgradeOf("refinery") });
    const before = await stored(id);
    setClock(HOUR_MS);
    const action = upgradeOf("fishery");
    const res = await send(server, token, { action });
    expect(res.statusCode).toBe(200);
    const expected = applyAction(catchUp(before!.state as PlayerState, 3600), action);
    if (!expected.ok) throw new Error(expected.reason);
    expect(res.json()).toEqual({ state: json(expected.state), version: 3, asOf: clock.toISOString(), speed: 1 });
    const after = await stored(id);
    expect(after!.version).toBe(3);
    expect(after!.state).toEqual(json(expected.state));
    expect(after!.savedAt).toEqual(clock);
  });

  it("a refused action: 422 with the rule's reason word for word, the city unchanged and sent back", async () => {
    const server = await app();
    const { id, token } = await player();
    const poor = { ...newPlayerState(), stock: { oil: 0, fish: 0, wood: 0, rope: 0 } };
    await putCity(id, poor, 4);
    setClock(MINUTE);
    const res = await send(server, token, { action: upgradeOf("refinery") });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ code: "rule_refused", error: "Not enough resources", state: json(catchUp(poor, 60)), version: 4, asOf: clock.toISOString(), speed: 1 });
    const after = await stored(id);
    expect(after!.version).toBe(4);
    expect(after!.state).toEqual(json(poor));
  });

  it("the same action sent again: the same outcome with the current city, replayed, applied once", async () => {
    const server = await app();
    const { id, token } = await player();
    const action = upgradeOf("refinery");
    const first = (await send(server, token, { action })).json();
    setClock(10 * MINUTE);
    const again = await send(server, token, { action });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ state: json(catchUp(first.state, 600)), version: first.version, asOf: clock.toISOString(), speed: 1, replayed: true });
    expect((await stored(id))!.version).toBe(first.version);
    expect(await appliedCount(id)).toBe(1);
  });

  it("a refused action sent again stays refused, replayed", async () => {
    const server = await app();
    const { id, token } = await player();
    await putCity(id, { ...newPlayerState(), stock: { oil: 0, fish: 0, wood: 0, rope: 0 } });
    const action = upgradeOf("refinery");
    await send(server, token, { action });
    const again = await send(server, token, { action });
    expect(again.statusCode).toBe(422);
    expect(again.json()).toMatchObject({ code: "rule_refused", error: "Not enough resources", version: 1, replayed: true });
  });

  it("the same id with other content: 409 action_id_reused, nothing applied", async () => {
    const server = await app();
    const { id, token } = await player();
    const action = upgradeOf("refinery");
    const first = (await send(server, token, { action })).json();
    const res = await send(server, token, { action: { ...action, building: "fishery" } });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ ...ACTION_REFUSED.reused, version: first.version, speed: 1 });
    expect(res.json().state.queue.map((j: { id: string }) => j.id)).toEqual(["refinery"]);
    expect(await appliedCount(id)).toBe(1);
  });

  it("an action that changes nothing is kept by its id, without writing the city again", async () => {
    const server = await app();
    const { id, token } = await player();
    await putCity(id, newPlayerState(), 5);
    const res = await send(server, token, { action: { id: randomUUID(), type: "readReport", reportId: "r1" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe(5);
    expect(await appliedCount(id)).toBe(1);
  });

  it("a badly formed request: 400 invalid_action, with the server's city", async () => {
    const server = await app();
    const { token } = await player();
    const action = upgradeOf("refinery");
    const bodies: unknown[] = [
      {},
      { action, at: T0.toISOString() },
      { action: { ...action, at: "2020-01-01T00:00:00Z" } },
      { action: { ...action, type: "buyPearls" } },
      { action: { ...action, building: "castle" } },
      { action: { ...action, id: "not-a-uuid" } },
      { action: [action] },
      [action],
    ];
    for (const body of bodies) {
      const res = await send(server, token, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
      expect(res.json()).toMatchObject({ ...ACTION_REFUSED.invalid, version: 1, speed: 1 });
      expect(res.json().state).toEqual(json(newPlayerState()));
    }
    for (const [payload, type] of [
      ["{", "application/json"],
      ["upgrade", "text/plain"],
    ]) {
      const res = await send(server, token, payload, { "content-type": type! });
      expect(res.statusCode, payload).toBe(400);
      expect(res.json()).toMatchObject({ ...ACTION_REFUSED.invalid, version: 1 });
    }
  });

  it("a body over 2 KB: 413 action_too_large, without a city and without touching the database", async () => {
    const server = await app();
    const { id, token } = await player();
    const res = await send(server, token, { action: { ...upgradeOf("refinery"), padding: "x".repeat(ACTION_MAX_BYTES) } });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual(ACTION_REFUSED.tooLarge);
    expect(await stored(id)).toBeUndefined();
  });

  it(`at most ${ACTIONS_PER_MINUTE} actions per minute and per player: then 429, without a city`, async () => {
    const server = await app();
    const a = await player();
    const b = await player();
    for (let i = 0; i < ACTIONS_PER_MINUTE; i++) {
      expect((await send(server, a.token, { action: { id: randomUUID(), type: "readReport", reportId: "r1" } })).statusCode).toBe(200);
    }
    const res = await send(server, a.token, { action: upgradeOf("refinery") });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual(ACTION_REFUSED.tooMany);
    // Counted before the body is read: a malformed body is refused the same way.
    expect((await send(server, a.token, "{", { "content-type": "application/json" })).statusCode).toBe(429);
    expect((await send(server, b.token, { action: upgradeOf("refinery") })).statusCode).toBe(200);
  });

  it("an unreadable stored city: 409 unreadable_city, nothing applied, the row left as it is", async () => {
    const server = await app();
    const { id, token } = await player();
    await db.insert(schema.cities).values({ playerId: id, state: { broken: true }, version: 3, savedAt: clock });
    const res = await send(server, token, { action: upgradeOf("refinery") });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual(CITY_REFUSED.unreadable);
    expect(await stored(id)).toMatchObject({ state: { broken: true }, version: 3 });
    expect(await appliedCount(id)).toBe(0);
  });

  it("only the server's clock counts: an upgrade started at T0 is finished when the server has advanced by its time", async () => {
    const server = await app();
    const { token } = await player();
    await send(server, token, { action: upgradeOf("refinery") });
    setClock(upgradeTime("refinery", 1) * 1000);
    const res = await server.inject({ method: "GET", url: "/city", headers: { authorization: `Bearer ${token}` } });
    expect(res.json().state.buildings.refinery).toBe(2);
    expect(res.json().state.queue).toEqual([]);
  });
});

describe("a city the rules would make invalid", () => {
  it("after catching up: 500 server_error, nothing written, the incident logged without the city", async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const server = await app({ logger: { level: "info", stream } });
    const { id, token } = await player();
    // A fleet on its way, and the report counter at its highest: the report it brings back would get an id parseState refuses.
    const sent = sail(newPlayerState(), "camp-1");
    if (!sent.ok) throw new Error(sent.reason);
    const city = { ...sent.state, reportSeq: MAX_REPORT_SEQ };
    expect(parseState(json(city))).not.toBeNull();
    expect(parseState(json(catchUp(city, 8 * HOUR)))).toBeNull();
    await putCity(id, city, 4);
    setClock(8 * HOUR_MS);

    const res = await send(server, token, { action: upgradeOf("refinery") });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual(SERVER_ERROR);
    expect(await stored(id)).toMatchObject({ state: json(city), version: 4, savedAt: T0 });
    expect(await appliedCount(id)).toBe(0);
    const all = lines.join("");
    expect(all).toContain("City refused by parseState after catching up");
    expect(all).toContain(`"playerId":"${id}"`);
    expect(all).toContain('"action":"upgrade"');
    for (const word of ['"buildings"', '"stock"', '"fleets"', '"state"']) expect(all, word).not.toContain(word);
  });
});

describe("DEV_SPEED", () => {
  const fast = () => app({ config: { ...loadConfig({}), devSpeed: 60 } });

  it("speeds up the city's game time only: one real minute is one hour for the city", async () => {
    const server = await fast();
    const { id, token } = await player();
    await send(server, token, { action: upgradeOf("refinery") });
    const before = (await stored(id))!.state as PlayerState;
    setClock(MINUTE);
    const action = upgradeOf("fishery");
    const res = await send(server, token, { action });
    const expected = applyAction(catchUp(before, 3600), action);
    if (!expected.ok) throw new Error(expected.reason);
    expect(res.json()).toMatchObject({ state: json(expected.state), speed: 60 });
    const read = await server.inject({ method: "GET", url: "/city", headers: { authorization: `Bearer ${token}` } });
    expect(read.json().speed).toBe(60);
  });

  it("never speeds up a session: it still lives 30 real days", async () => {
    const server = await fast();
    const { token } = await player();
    setClock(29 * DAY_MS);
    expect((await server.inject({ method: "GET", url: "/me", headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);
    setClock(31 * DAY_MS);
    expect((await server.inject({ method: "GET", url: "/me", headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(401);
  });

  it("never speeds up a sign-in nonce: it still lives 5 real minutes", async () => {
    const server = await fast();
    const res = await server.inject({ method: "POST", url: "/auth/nonce", headers: { origin: "http://localhost:5173" } });
    const { issuedAt, expiresAt } = res.json();
    expect(new Date(expiresAt).getTime() - new Date(issuedAt).getTime()).toBe(5 * MINUTE);
  });

  it("never speeds up the purge of action ids: 7 real days", async () => {
    const { id } = await player();
    const row = (actionId: string, at: Date) => ({ playerId: id, actionId, actionHash: "h", appliedAt: at, ok: true });
    await db.insert(schema.appliedActions).values([row(randomUUID(), new Date(T0.getTime() - 8 * DAY_MS)), row(randomUUID(), new Date(T0.getTime() - 6 * DAY_MS))]);
    expect(await purgeOldActions(db, T0)).toBe(1);
    expect(await appliedCount(id)).toBe(1);
  });

  it("the speed is written in the logs at start", async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, done) {
        lines.push(String(chunk));
        done();
      },
    });
    await buildApp({ db, now: () => clock, config: { ...loadConfig({}), devSpeed: 60 }, logger: { level: "info", stream } });
    expect(lines.join("")).toContain('"devSpeed":60');
    lines.length = 0;
    await buildApp({ db, now: () => clock, logger: { level: "info", stream } });
    expect(lines.join("")).toContain("Game time runs at real speed");
  });
});

describe("logs", () => {
  it("never hold a city, even at the most detailed level", async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const server = await app({ logger: { level: "trace", stream } });
    const { id, token } = await player();
    const action = upgradeOf("refinery");
    await send(server, token, { action });
    await send(server, token, { action });
    await send(server, token, { action: { ...action, building: "fishery" } });
    await send(server, token, { action: { ...action, at: 1 } });
    await server.inject({ method: "GET", url: "/city", headers: { authorization: `Bearer ${token}` } });
    // An unreadable city is reported with the player id only.
    const broken = await player();
    await db.insert(schema.cities).values({ playerId: broken.id, state: { broken: true, buildings: {} }, version: 1, savedAt: clock });
    await send(server, broken.token, { action: upgradeOf("refinery") });
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.join("")).toContain("Stored city refused by parseState");
    const all = lines.join("");
    for (const word of ['"buildings"', '"stock"', '"queue"', '"state"', '"broken"']) expect(all, word).not.toContain(word);
    expect(await appliedCount(id)).toBe(1);
  });
});
