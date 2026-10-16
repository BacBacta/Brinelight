import { randomBytes } from "node:crypto";
import { LIGHTHOUSE_MAX, catchUp, newPlayerState, sail, storeCap, upgrade, type PlayerState } from "@brinelight/shared";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { CITY_MAX_BYTES, CITY_REFUSED, SAVES_PER_MINUTE } from "../src/city/routes.js";
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
const putCity = (server: App, token: string, body: unknown) =>
  server.inject({ method: "PUT", url: "/city", headers: { authorization: `Bearer ${token}` }, payload: body as object });

const json = (v: unknown) => JSON.parse(JSON.stringify(v));

describe("GET /city", () => {
  it("first visit: no city, and nothing is created", async () => {
    const server = await app();
    const { token } = await player();
    const res = await getCity(server, token);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ city: null });
    expect(await db.select().from(schema.cities)).toHaveLength(0);
  });

  it("time away is computed by the server, with the same offline rule as the client", async () => {
    const server = await app();
    const { token } = await player();
    const city = newPlayerState();
    expect((await putCity(server, token, { state: city, version: 0 })).json()).toEqual({ version: 1, savedAt: T0.toISOString() });

    setClock(2 * HOUR);
    const res = await getCity(server, token);
    expect(res.json()).toEqual({ state: json(catchUp(city, 7200)), version: 1, savedAt: T0.toISOString(), asOf: clock.toISOString() });
    expect(res.json().state.stock).not.toEqual(json(city.stock));
  });

  it("20 h away count in full: the upgrade started before is finished", async () => {
    const server = await app();
    const { token } = await player();
    const up = upgrade(newPlayerState(), "refinery");
    if (!up.ok) throw new Error(up.reason);
    await putCity(server, token, { state: up.state, version: 0 });
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
    await putCity(server, token, { state: newPlayerState(), version: 0 });
    setClock(3 * HOUR);
    const a = (await getCity(server, token)).json();
    const b = (await getCity(server, token)).json();
    expect(b).toEqual(a);
    const [row] = await db.select().from(schema.cities).where(eq(schema.cities.playerId, id));
    expect(row!.version).toBe(1);
    expect(row!.savedAt).toEqual(T0);
  });

  it("an unreadable stored city is reported, never replaced", async () => {
    const server = await app();
    const { token, id } = await player();
    await db.insert(schema.cities).values({ playerId: id, state: { broken: true }, version: 4, savedAt: T0 });
    const res = await getCity(server, token);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual(CITY_REFUSED.unreadable);
    for (const version of [0, 4]) {
      const put = await putCity(server, token, { state: newPlayerState(), version });
      expect(put.statusCode).toBe(409);
      expect(put.json()).toEqual(CITY_REFUSED.unreadable);
    }
    const [row] = await db.select().from(schema.cities).where(eq(schema.cities.playerId, id));
    expect(row).toMatchObject({ state: { broken: true }, version: 4 });
  });

  it("a player never sees another player's city", async () => {
    const server = await app();
    const a = await player();
    const b = await player();
    await putCity(server, a.token, { state: newPlayerState(), version: 0 });
    expect((await getCity(server, b.token)).json()).toEqual({ city: null });
  });
});

describe("PUT /city", () => {
  it("version 0 creates the city; then each save goes one version up", async () => {
    const server = await app();
    const { token } = await player();
    let city = newPlayerState();
    expect((await putCity(server, token, { state: city, version: 0 })).json().version).toBe(1);
    const up = upgrade(city, "refinery");
    if (!up.ok) throw new Error(up.reason);
    city = up.state;
    setClock(HOUR);
    expect((await putCity(server, token, { state: city, version: 1 })).json()).toEqual({ version: 2, savedAt: clock.toISOString() });
    expect((await putCity(server, token, { state: city, version: 2 })).json().version).toBe(3);
    const read = (await getCity(server, token)).json();
    expect(read.version).toBe(3);
    expect(read.state).toEqual(json(city));
  });

  it("version 0 when the account already has a city is refused", async () => {
    const server = await app();
    const { token } = await player();
    await putCity(server, token, { state: newPlayerState(), version: 0 });
    const res = await putCity(server, token, { state: newPlayerState(), version: 0 });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual(CITY_REFUSED.conflict);
  });

  it("an old version, or a version ahead, is refused", async () => {
    const server = await app();
    const { token } = await player();
    await putCity(server, token, { state: newPlayerState(), version: 0 });
    await putCity(server, token, { state: newPlayerState(), version: 1 });
    for (const version of [1, 5]) {
      const res = await putCity(server, token, { state: newPlayerState(), version });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual(CITY_REFUSED.conflict);
    }
  });

  it("a version N without a city is refused", async () => {
    const server = await app();
    const { token } = await player();
    const res = await putCity(server, token, { state: newPlayerState(), version: 1 });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual(CITY_REFUSED.conflict);
  });

  const refusedCities: [string, (s: PlayerState) => unknown][] = [
    ["a missing field", ({ pearls: _, ...rest }) => rest],
    ["a building above the Lighthouse", (s) => ({ ...s, buildings: { ...s.buildings, refinery: s.buildings.lighthouse + 1 } })],
    ["a Lighthouse above its highest level", (s) => ({ ...s, buildings: { ...s.buildings, lighthouse: LIGHTHOUSE_MAX + 1 } })],
    ["a level that is not a whole number", (s) => ({ ...s, buildings: { ...s.buildings, refinery: 1.5 } })],
    [
      "a job on a building already at its highest level",
      (s) => ({ ...s, buildings: { ...s.buildings, refinery: s.buildings.lighthouse }, queue: [{ id: "refinery", left: 60, duration: 60 }] }),
    ],
    ["a bad job (dropped by parseState)", (s) => ({ ...s, queue: [{ id: "casino", left: 60, duration: 60 }] })],
    [
      "more fleets at sea than the Harbor allows",
      (s) => {
        const r = sail(s, "camp-1");
        if (!r.ok) throw new Error(r.reason);
        return { ...r.state, fleets: [r.state.fleets[0], r.state.fleets[0]] };
      },
    ],
  ];

  for (const [name, change] of refusedCities) {
    it(`refuses ${name}`, async () => {
      const server = await app();
      const { token } = await player();
      const res = await putCity(server, token, { state: change(newPlayerState()), version: 0 });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual(CITY_REFUSED.invalid);
      expect(await db.select().from(schema.cities)).toHaveLength(0);
    });
  }

  it("the fleets the Harbor allows are accepted", async () => {
    const server = await app();
    const { token } = await player();
    const r = sail(newPlayerState(), "camp-1");
    if (!r.ok) throw new Error(r.reason);
    expect((await putCity(server, token, { state: r.state, version: 0 })).statusCode).toBe(200);
  });

  it("refuses a badly formed request", async () => {
    const server = await app();
    const state = newPlayerState();
    // Refused saves count against the limit too, so each try uses its own player.
    const send = async (headers: Record<string, string>, payload: unknown) => {
      const { token } = await player();
      return server.inject({ method: "PUT", url: "/city", headers: { authorization: `Bearer ${token}`, ...headers }, payload: payload as string });
    };
    const tries: [Record<string, string>, unknown][] = [
      ...[{ state }, { state, version: -1 }, { state, version: 1.5 }, { state, version: "1" }, { state, version: 0, extra: 1 }, [state]].map(
        (body): [Record<string, string>, unknown] => [{}, body],
      ),
      [{ "content-type": "text/plain" }, "city"],
      [{ "content-type": "application/json" }, "{"],
    ];
    for (const [headers, payload] of tries) {
      const res = await send(headers, payload);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual(CITY_REFUSED.invalid);
    }
  });

  it("refused saves count against the limit", async () => {
    const server = await app();
    const { token } = await player();
    for (let i = 0; i < SAVES_PER_MINUTE; i++) expect((await putCity(server, token, { version: 0 })).statusCode).toBe(400);
    expect((await putCity(server, token, { state: newPlayerState(), version: 0 })).statusCode).toBe(429);
  });

  it(`refuses a body over ${CITY_MAX_BYTES / 1024} KB`, async () => {
    const server = await app();
    const { token } = await player();
    const res = await putCity(server, token, { state: { ...newPlayerState(), padding: "x".repeat(CITY_MAX_BYTES) }, version: 0 });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual(CITY_REFUSED.tooLarge);
  });

  it(`at most ${SAVES_PER_MINUTE} saves per minute and per player`, async () => {
    const server = await app();
    const a = await player();
    const b = await player();
    await putCity(server, a.token, { state: newPlayerState(), version: 0 });
    for (let v = 1; v < SAVES_PER_MINUTE; v++) expect((await putCity(server, a.token, { state: newPlayerState(), version: v })).statusCode).toBe(200);
    const res = await putCity(server, a.token, { state: newPlayerState(), version: SAVES_PER_MINUTE });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual(CITY_REFUSED.tooMany);
    // Another player at the same address is not affected.
    expect((await putCity(server, b.token, { state: newPlayerState(), version: 0 })).statusCode).toBe(200);
    // Reading is not limited by saves.
    expect((await getCity(server, a.token)).statusCode).toBe(200);
  });
});

describe("signed out", () => {
  it("no session, an unknown token or an expired session: 401 on both routes", async () => {
    const server = await app();
    const { token } = await player();
    const tries = [{}, { authorization: `Bearer ${"A".repeat(43)}` }, { authorization: "Bearer short" }];
    for (const headers of tries) {
      for (const method of ["GET", "PUT"] as const) {
        const res = await server.inject({ method, url: "/city", headers, payload: method === "PUT" ? { state: newPlayerState(), version: 0 } : undefined });
        expect(res.statusCode).toBe(401);
        expect(res.json()).toEqual(SIGNED_OUT);
      }
    }
    setClock(31 * DAY);
    expect((await getCity(server, token)).json()).toEqual(SIGNED_OUT);
    expect((await putCity(server, token, { state: newPlayerState(), version: 0 })).statusCode).toBe(401);
  });
});

describe("refusals", () => {
  it("every refusal has its own stable code and a text for the player", async () => {
    const { REFUSED } = await import("../src/auth/routes.js");
    const refusals = await import("../src/refusals.js");
    const all = [...Object.values(REFUSED), ...Object.values(CITY_REFUSED), ...Object.values(refusals).filter((v) => typeof v === "object")] as { code: string; error: string }[];
    const unique = new Map(all.map((r) => [r.code, r.error]));
    for (const [code, error] of unique) {
      expect(code).toMatch(/^[a-z_]+$/);
      expect(error.length).toBeGreaterThan(5);
    }
    // The same code always carries the same text (a shared refusal may be listed twice).
    expect(new Set(all.map((r) => `${r.code}|${r.error}`)).size).toBe(unique.size);
    expect([...unique.keys()]).toEqual(expect.arrayContaining(["signed_out", "version_conflict", "unreadable_city", "invalid_city", "city_too_large", "too_many_saves"]));
  });
});
