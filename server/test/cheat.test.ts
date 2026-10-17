/**
 * The cheat test (week 4, task 5): a modified client can neither create resources nor speed up time.
 * Every case is refused or ignored, and the server's city stays exactly what the shared rules give:
 * a reference city is kept here, apart from the server, with the rules alone (catchUp on the real time, then
 * applyAction for each accepted action), and the server's city is compared with it after every case.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { PROMOTE_TIME, RAFT_BUILD_TIME, RAFT_INSTALL_TIME, RAFT_MAX_HP, RAFT_SLOTS, applyAction, catchUp, emptyTroops, healTime, newPlayerState, raftCap, raftUpgradeTime, totalTroops, trainTime, type GameAction, type PlayerState } from "@brinelight/shared";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { ACTION_MAX_BYTES, ACTION_REFUSED } from "../src/city/actions.js";
import { createSession, findOrCreatePlayer, openDatabase, schema, type Database, type Db } from "../src/db/index.js";

const T0 = new Date("2026-10-16T12:00:00.000Z");
let database: Database;
let db: Db;
let clock: Date;
const later = (ms: number) => (clock = new Date(clock.getTime() + ms));

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
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** The city as the rules alone make it, beside the server: the same steps, never the server's code. */
function reference(start: PlayerState) {
  let state = start;
  let savedAt = clock;
  let version = 1;
  const now = () => catchUp(state, (clock.getTime() - savedAt.getTime()) / 1000);
  return {
    now,
    get version() {
      return version;
    },
    /** What the rules say about an action; when it changes the city, it is the new reference. */
    apply(action: GameAction) {
      const current = now();
      const r = applyAction(current, action);
      if (r.ok && r.state !== current) {
        state = r.state;
        savedAt = clock;
        version++;
      }
      return r;
    },
  };
}
type Reference = ReturnType<typeof reference>;

/** A signed-in player whose city, stored at `clock`, is `city`; with its reference beside it. */
async function player(city: PlayerState = newPlayerState()) {
  const p = await findOrCreatePlayer(db, `W${randomBytes(8).toString("hex")}`, clock);
  const token = randomBytes(32).toString("base64url");
  await createSession(db, token, p.id, clock, new Date(clock.getTime() + 30 * 24 * 3600_000));
  await db.insert(schema.cities).values({ playerId: p.id, state: city, version: 1, savedAt: clock });
  return { id: p.id, token, ref: reference(city) };
}

type ActionInput = { [K in GameAction["type"]]: Omit<Extract<GameAction, { type: K }>, "id"> & { id?: string } }[GameAction["type"]];
const action = (a: ActionInput): GameAction => ({ id: randomUUID(), ...a }) as GameAction;
const send = (server: App, token: string, body: unknown, headers: Record<string, string> = {}) =>
  server.inject({ method: "POST", url: "/city/actions", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...headers }, payload: typeof body === "string" ? body : JSON.stringify(body) });

/** The server's city, read with GET /city, is exactly the reference: state and version. */
async function expectRules(server: App, p: { token: string; ref: Reference }) {
  const res = await server.inject({ method: "GET", url: "/city", headers: { authorization: `Bearer ${p.token}` } });
  expect(res.statusCode).toBe(200);
  expectCity(res.json(), p.ref);
}
/** An action the rules refuse: 422, the rule's reason word for word, the server's city unchanged, and sent back. */
async function expectRefused(server: App, p: { token: string; ref: Reference }, a: GameAction, reason: string) {
  expect(p.ref.apply(a)).toEqual({ ok: false, reason });
  const res = await send(server, p.token, { action: a });
  expect(res.statusCode).toBe(422);
  expectCity(res.json(), p.ref, { code: "rule_refused", error: reason });
  await expectRules(server, p);
}
/** An action the rules accept: 200, the city of the rules. */
async function expectApplied(server: App, p: { token: string; ref: Reference }, a: GameAction) {
  expect(p.ref.apply(a).ok).toBe(true);
  const res = await send(server, p.token, { action: a });
  expect(res.statusCode).toBe(200);
  expectCity(res.json(), p.ref);
}
/** A request the server cannot read: 400 with its own city, nothing applied. */
async function expectInvalid(server: App, p: { token: string; ref: Reference }, body: unknown) {
  const res = await send(server, p.token, body);
  expect(res.statusCode, typeof body === "string" ? body : JSON.stringify(body)).toBe(400);
  expectCity(res.json(), p.ref, { ...ACTION_REFUSED.invalid });
  await expectRules(server, p);
}
/**
 * An answer carries exactly the reference city: `state` compared strictly (a field the server added would fail),
 * the rest of the answer (code, error, version) as given.
 */
function expectCity(body: Record<string, unknown>, ref: Reference, rest: Record<string, unknown> = {}) {
  expect(body.state).toEqual(json(ref.now()));
  expect(body).toMatchObject({ version: ref.version, ...rest });
}
const appliedIds = async (playerId: string) => (await db.select().from(schema.appliedActions).where(eq(schema.appliedActions.playerId, playerId))).length;

describe("a modified client cannot change the rules", () => {
  it("an upgrade without enough resources, above the Lighthouse's level, or with both builders busy", async () => {
    const server = await buildApp({ db, now: () => clock });
    const poor = await player({ ...newPlayerState(), stock: { oil: 0, fish: 0, wood: 0, rope: 0 } });
    await expectRefused(server, poor, action({ type: "upgrade", building: "refinery" }), "Not enough resources");

    const s = newPlayerState();
    const capped = await player({ ...s, buildings: { ...s.buildings, refinery: s.buildings.lighthouse } });
    await expectRefused(server, capped, action({ type: "upgrade", building: "refinery" }), "Upgrade the Lighthouse first");

    const busy = await player();
    await expectApplied(server, busy, action({ type: "upgrade", building: "refinery" }));
    later(1000);
    await expectApplied(server, busy, action({ type: "upgrade", building: "fishery" }));
    later(1000);
    await expectRefused(server, busy, action({ type: "upgrade", building: "lumberyard" }), "Your 2 builders are busy");
  });

  it("a fleet without troops, to an unknown site, or when every fleet the Harbor allows is at sea", async () => {
    const server = await buildApp({ db, now: () => clock });
    const empty = await player({ ...newPlayerState(), troops: { boarders: 0, harpooners: 0, crossbowmen: 0 } });
    await expectRefused(server, empty, action({ type: "sail", site: "camp-1" }), "You do not have enough troops");
    // An unknown site is not even an action the server can read.
    await expectInvalid(server, empty, { action: action({ type: "sail", site: "camp-99" }) });

    const p = await player();
    await expectApplied(server, p, action({ type: "sail", site: "camp-1" }));
    later(5000);
    await expectRefused(server, p, action({ type: "sail", site: "wreck-1" }), "Build the Harbor to send more fleets");
  });

  it("the same action id replayed ten times is applied once", async () => {
    const server = await buildApp({ db, now: () => clock });
    const p = await player();
    const a = action({ type: "upgrade", building: "refinery" });
    expect(p.ref.apply(a).ok).toBe(true);
    const answers = [];
    for (let i = 0; i < 10; i++) {
      answers.push(await send(server, p.token, { action: a }));
      later(100);
    }
    expect(answers.map((r) => r.statusCode)).toEqual(Array(10).fill(200));
    expect(answers.filter((r) => r.json().replayed === true)).toHaveLength(9);
    expect(answers.map((r) => r.json().version)).toEqual(Array(10).fill(2));
    expect(await appliedIds(p.id)).toBe(1);
    await expectRules(server, p);
  });

  it("an unknown action type, fields the server does not expect (a city, a time, another player, __proto__), a huge body", async () => {
    const server = await buildApp({ db, now: () => clock });
    const p = await player();
    const other = await player();
    const a = action({ type: "upgrade", building: "refinery" });
    const rich = { ...newPlayerState(), stock: { oil: 1e9, fish: 1e9, wood: 1e9, rope: 1e9 } };
    for (const body of [
      { action: { ...a, type: "buyPearls" } },
      { action: { ...a, type: "setStock", stock: rich.stock } },
      { action: a, state: rich },
      { action: { ...a, stock: rich.stock } },
      { action: a, version: 99 },
      { action: { ...a, at: clock.getTime() + 86_400_000 } },
      { action: a, now: "2030-01-01T00:00:00.000Z" },
      { action: { ...a, speed: 1000 } },
      { action: a, playerId: other.id },
      { action: { ...a, playerId: other.id } },
      `{"action":${JSON.stringify(a)},"__proto__":{"admin":true}}`,
      `{"action":{"id":"${a.id}","type":"upgrade","building":"refinery","__proto__":{"pearls":1e9}}}`,
    ]) {
      await expectInvalid(server, p, body);
    }
    const huge = await send(server, p.token, { action: { ...a, padding: "x".repeat(ACTION_MAX_BYTES) } });
    expect(huge.statusCode).toBe(413);
    expect(huge.json()).toEqual(ACTION_REFUSED.tooLarge);
    expect(await appliedIds(p.id)).toBe(0);
    await expectRules(server, p);
    // The other player was never touched.
    await expectRules(server, other);
  });

  it("a client whose saved city was edited (stock × 100, every level 30) gets the server's city back, unchanged by the edit", async () => {
    const server = await buildApp({ db, now: () => clock });
    const p = await player();
    const edited = {
      ...newPlayerState(),
      stock: Object.fromEntries(Object.entries(newPlayerState().stock).map(([k, v]) => [k, v * 100])),
      buildings: Object.fromEntries(Object.keys(newPlayerState().buildings).map((k) => [k, 30])),
    };
    // What the edited client believes it can afford: the server judges each action on its own city.
    for (const building of ["refinery", "fishery", "lumberyard", "shelters"] as const) {
      later(2000);
      const a = action({ type: "upgrade", building });
      const rules = p.ref.apply(a);
      const res = await send(server, p.token, { action: a });
      expect(res.statusCode).toBe(rules.ok ? 200 : 422);
      expectCity(res.json(), p.ref);
    }
    // The edited city itself, sent along: never read.
    await expectInvalid(server, p, { action: action({ type: "upgrade", building: "harbor" }), state: edited });
    const shown = p.ref.now();
    expect(shown.stock.oil).toBeLessThan(edited.stock.oil!);
    expect(Object.values(shown.buildings).every((l) => l < 30)).toBe(true);
    await expectRules(server, p);
  });

  it("a client with a faster clock: the server's city moves with the server's clock only", async () => {
    const server = await buildApp({ db, now: () => clock });
    const p = await player();
    await expectApplied(server, p, action({ type: "upgrade", building: "refinery" }));
    // Thirty actions in ten real seconds, as fast as a sped-up client would send them.
    for (let i = 0; i < 30; i++) {
      later(333);
      const res = await send(server, p.token, { action: action({ type: "readReport", reportId: "r1" }) });
      expect(res.statusCode).toBe(200);
    }
    const res = await server.inject({ method: "GET", url: "/city", headers: { authorization: `Bearer ${p.token}` } });
    const job = res.json().state.queue[0];
    const expected = p.ref.now().queue[0]!;
    expect(job).toEqual(json(expected));
    // Ten seconds of work done on the upgrade, not more.
    expect(expected.duration - expected.left).toBeCloseTo(9.99, 5);
    await expectRules(server, p);
  });

  it("an action id another player already used: applied normally for this player, whose answer says nothing of the other's", async () => {
    const server = await buildApp({ db, now: () => clock });
    const a = await player();
    const b = await player();
    const id = randomUUID();
    await expectApplied(server, a, action({ id, type: "upgrade", building: "refinery" }));
    later(1000);
    // Other content under the same id: for b it is a new action, not a reused id.
    const other = action({ id, type: "upgrade", building: "fishery" });
    expect(b.ref.apply(other).ok).toBe(true);
    const res = await send(server, b.token, { action: other });
    expect(res.statusCode).toBe(200);
    expect(res.json()).not.toHaveProperty("replayed");
    expectCity(res.json(), b.ref);
    expect(res.json().version).toBe(2);
    expect(res.json().state.queue.map((j: { id: string }) => j.id)).toEqual(["fishery"]);
    // The very same action under the same id: still applied for b, as b's own.
    const c = await player();
    const same = action({ id, type: "upgrade", building: "refinery" });
    expect(c.ref.apply(same).ok).toBe(true);
    const again = await send(server, c.token, { action: same });
    expect(again.json()).not.toHaveProperty("replayed");
    expect(again.json().version).toBe(2);
    for (const p of [a, b, c]) await expectRules(server, p);
  });

  it("research: one already in progress, the Observatory too low, at its maximum, or unknown", async () => {
    const server = await buildApp({ db, now: () => clock });
    const base = newPlayerState();
    const observatory = { ...base, buildings: { ...base.buildings, observatory: 1 }, stock: { oil: 9000, fish: 9000, wood: 9000, rope: 3 } };
    const p = await player(observatory);
    await expectApplied(server, p, action({ type: "research", tech: "refining" }));
    later(1000);
    await expectRefused(server, p, action({ type: "research", tech: "nets" }), "Research is already in progress");
    await expectRefused(server, p, action({ type: "research", tech: "refining" }), "Research is already in progress");

    const low = await player({ ...observatory, buildings: { ...observatory.buildings, observatory: 1 } });
    await expectRefused(server, low, action({ type: "research", tech: "warehouses" }), "Observatory level 2 required");
    const done = await player({ ...observatory, techs: { veterans: 1 } });
    await expectRefused(server, done, action({ type: "research", tech: "veterans" }), "This research is at max level");
    for (const tech of ["teleport", "toString", "__proto__"]) await expectInvalid(server, done, { action: { ...action({ type: "research", tech: "nets" }), tech } });
    // Without an Observatory at all.
    const none = await player();
    await expectRefused(server, none, action({ type: "research", tech: "refining" }), "Observatory level 1 required");
  });

  it("rafts: a slot already taken, a slot the Lighthouse does not light yet, beyond its limit, the shipyard busy, an unknown slot", async () => {
    const server = await buildApp({ db, now: () => clock });
    const base = newPlayerState();
    const inner = RAFT_SLOTS.filter((s) => s.ring === 3).map((s) => s.key);
    const outer = RAFT_SLOTS.filter((s) => s.ring === 4).map((s) => s.key);
    const lit = { ...base, buildings: { ...base.buildings, lighthouse: 4 }, stock: { oil: 9000, fish: 9000, wood: 9000, rope: 50 } };
    const sound = { hp: RAFT_MAX_HP, building: null, level: 0 };

    const p = await player({ ...lit, rafts: { [inner[0]!]: sound } });
    await expectRefused(server, p, action({ type: "dockRaft", slot: inner[0]! }), "A raft is already moored here");
    await expectRefused(server, p, action({ type: "dockRaft", slot: outer[0]! }), "The Lighthouse's light doesn't reach this far yet");
    await expectApplied(server, p, action({ type: "dockRaft", slot: inner[1]! }));
    later(1000);
    await expectRefused(server, p, action({ type: "dockRaft", slot: inner[2]! }), "The shipyard is busy");

    const full = await player({ ...lit, rafts: Object.fromEntries(inner.slice(0, raftCap(4)).map((k) => [k, sound])) });
    await expectRefused(server, full, action({ type: "dockRaft", slot: inner[raftCap(4)]! }), "Upgrade the Lighthouse to moor more rafts");
    for (const slot of ["0,0", "1,-3", "toString", "__proto__"]) await expectInvalid(server, full, { action: { ...action({ type: "dockRaft", slot: inner[0]! }), slot } });

    // The raft being built is moored by the server's clock, not before.
    later(RAFT_BUILD_TIME * 1000 - 2000);
    await expectRules(server, p);
    expect(p.ref.now().rafts[inner[1]!]).toBeUndefined();
    later(1000);
    await expectRules(server, p);
    expect(p.ref.now().rafts[inner[1]!]).toEqual(sound);
  });
  it("buildings on rafts: a raft taken, no raft, an unknown type, a third copy, above level 3, the shipyard busy, the resources, a level sent", async () => {
    const server = await buildApp({ db, now: () => clock });
    const base = newPlayerState();
    const inner = RAFT_SLOTS.filter((s) => s.ring === 3).map((s) => s.key);
    const [a, b, c, d] = inner as [string, string, string, string];
    const free = { hp: RAFT_MAX_HP, building: null, level: 0 };
    const rich = { oil: 9000, fish: 9000, wood: 9000, rope: 50 };
    const city = {
      ...base,
      buildings: { ...base.buildings, lighthouse: 6 },
      stock: rich,
      rafts: { [a]: { hp: RAFT_MAX_HP, building: "greenhouse" as const, level: 3 }, [b]: { hp: RAFT_MAX_HP, building: "greenhouse" as const, level: 1 }, [c]: free },
    };

    const p = await player(city);
    await expectRefused(server, p, action({ type: "installOnRaft", slot: a, building: "smokehouse" }), "This raft already has a building");
    await expectRefused(server, p, action({ type: "installOnRaft", slot: d, building: "smokehouse" }), "There is no raft here");
    await expectRefused(server, p, action({ type: "upgradeRaft", slot: d }), "There is no raft here");
    await expectRefused(server, p, action({ type: "upgradeRaft", slot: c }), "Put a building on this raft first");
    await expectRefused(server, p, action({ type: "installOnRaft", slot: c, building: "greenhouse" }), "Each type is limited to 2 rafts");
    await expectRefused(server, p, action({ type: "upgradeRaft", slot: a }), "Max level");
    for (const building of ["casino", "toString", "__proto__", ""]) await expectInvalid(server, p, { action: { ...action({ type: "installOnRaft", slot: c, building: "watchtower" }), building } });
    for (const slot of ["0,0", "1,-3", "toString"]) await expectInvalid(server, p, { action: { ...action({ type: "upgradeRaft", slot: b }), slot } });
    // The level and the cost are the rule's.
    await expectInvalid(server, p, { action: { ...action({ type: "upgradeRaft", slot: b }), level: 3 } });
    await expectInvalid(server, p, { action: { ...action({ type: "installOnRaft", slot: c, building: "watchtower" }), level: 3 } });
    const poor = await player({ ...city, stock: { oil: 119, fish: 9000, wood: 9000, rope: 50 } });
    await expectRefused(server, poor, action({ type: "installOnRaft", slot: c, building: "watchtower" }), "Not enough resources");

    await expectApplied(server, p, action({ type: "installOnRaft", slot: c, building: "watchtower" }));
    expect(p.ref.now().yard).toMatchObject({ slot: c, kind: "install", building: "watchtower" });
    later(1000);
    await expectRefused(server, p, action({ type: "upgradeRaft", slot: b }), "The shipyard is busy");
    await expectRefused(server, p, action({ type: "dockRaft", slot: d }), "The shipyard is busy");
  });

  it("from shipyard to fleet: the server puts the Watchtower on its raft by its clock, then a fleet sails with it", async () => {
    const server = await buildApp({ db, now: () => clock });
    const base = newPlayerState();
    const slot = RAFT_SLOTS.find((s) => s.ring === 3)!.key;
    const p = await player({ ...base, buildings: { ...base.buildings, lighthouse: 4 }, stock: { oil: 9000, fish: 9000, wood: 9000, rope: 50 }, rafts: { [slot]: { hp: RAFT_MAX_HP, building: null, level: 0 } } });
    await expectApplied(server, p, action({ type: "installOnRaft", slot, building: "watchtower" }));
    later(RAFT_INSTALL_TIME * 1000 - 1000);
    await expectRules(server, p);
    expect(p.ref.now().rafts[slot]).toMatchObject({ building: null, level: 0 });
    later(1000);
    await expectRules(server, p);
    expect(p.ref.now().rafts[slot]).toMatchObject({ building: "watchtower", level: 1 });
    await expectApplied(server, p, action({ type: "upgradeRaft", slot }));
    later(raftUpgradeTime(1) * 1000);
    await expectRules(server, p);
    expect(p.ref.now().rafts[slot]).toMatchObject({ building: "watchtower", level: 2 });
    await expectApplied(server, p, action({ type: "sail", site: "camp-1" }));
    expect(p.ref.now().fleets[0]!.watchtowers).toBe(2);
  });

  it("captains: a lead not owned, the Logbook without Pearls or at max level, shards short, a captain owned or at 5 stars, numbers sent", async () => {
    const server = await buildApp({ db, now: () => clock });
    const base = newPlayerState();
    const p = await player({ ...base, pearls: 49, shards: { sel: 9, tom: 9 } });
    await expectRefused(server, p, action({ type: "setLead", captain: "mira" }), "Recruit this captain first");
    await expectRefused(server, p, action({ type: "logbook" }), "Not enough Pearls");
    await expectRefused(server, p, action({ type: "unlockCaptain", captain: "sel" }), "You need 10 shards");
    await expectRefused(server, p, action({ type: "unlockCaptain", captain: "tom" }), "You already have this captain");
    await expectRefused(server, p, action({ type: "addStar", captain: "sel" }), "Recruit this captain first");
    await expectRefused(server, p, action({ type: "addStar", captain: "tom" }), "You need 10 shards");
    for (const type of ["setLead", "unlockCaptain", "addStar"] as const) {
      for (const captain of ["blackbeard", "toString", "__proto__", ""]) await expectInvalid(server, p, { action: { ...action({ type, captain: "tom" }), captain } });
      await expectInvalid(server, p, { action: { ...action({ type, captain: "tom" }), shards: 10 } });
    }
    for (const extra of [{ xp: 400 }, { pearls: 0 }, { captain: "tom" }]) await expectInvalid(server, p, { action: { ...action({ type: "logbook" }), ...extra } });

    const max = await player({ ...base, captains: { tom: { level: 20, xp: 0, stars: 5 } }, shards: { tom: 30 } });
    await expectRefused(server, max, action({ type: "logbook" }), "Your lead captain is at max level");
    await expectRefused(server, max, action({ type: "addStar", captain: "tom" }), "Max stars");
  });

  it("from camp to captain: the captain who sailed gains the experience, the camp's captain the shards, by the server's clock", async () => {
    const server = await buildApp({ db, now: () => clock });
    const base = newPlayerState();
    const p = await player({ ...base, troops: { boarders: 200, harpooners: 200, crossbowmen: 200 }, captains: { tom: { level: 1, xp: 70, stars: 1 }, isa: { level: 2, xp: 0, stars: 1 } }, shards: { sel: 9 } });
    await expectApplied(server, p, action({ type: "sail", site: "camp-1" }));
    // Another captain leads now: the experience still goes to Old Tom, who sailed.
    await expectApplied(server, p, action({ type: "setLead", captain: "isa" }));
    later(8 * 3600_000);
    await expectRules(server, p);
    const back = p.ref.now();
    expect(back.reports[0]).toMatchObject({ win: true, captainXp: { id: "tom", xp: 30, levels: 1 }, shards: { id: "sel", count: 1 } });
    expect(back.captains.tom).toEqual({ level: 2, xp: 20, stars: 1 });
    expect(back.captains.isa).toEqual({ level: 2, xp: 0, stars: 1 });
    expect(back.shards).toEqual({ sel: 10 });
    await expectApplied(server, p, action({ type: "unlockCaptain", captain: "sel" }));
    await expectApplied(server, p, action({ type: "setLead", captain: "sel" }));
    await expectApplied(server, p, action({ type: "logbook" }));
    expect(p.ref.now().captains.sel).toEqual({ level: 1, xp: 40, stars: 1 });
    expect(p.ref.now().pearls).toBe(back.pearls - 50);
  });

  it("training: no Barracks, one already underway, not enough resources, an unknown troop type, a number of soldiers sent", async () => {
    const server = await buildApp({ db, now: () => clock });
    const base = newPlayerState();
    const barracks = { ...base, buildings: { ...base.buildings, barracks: 2 }, stock: { oil: 9000, fish: 9000, wood: 9000, rope: 3 } };

    await expectRefused(server, await player(), action({ type: "train", troop: "boarders" }), "Build the Barracks first");
    const poor = await player({ ...barracks, stock: { oil: 9000, fish: 119, wood: 9000, rope: 3 } });
    await expectRefused(server, poor, action({ type: "train", troop: "boarders" }), "Not enough resources");

    const p = await player(barracks);
    for (const troop of ["archers", "toString", "__proto__", ""]) await expectInvalid(server, p, { action: { ...action({ type: "train", troop: "boarders" }), troop } });
    await expectInvalid(server, p, { action: { ...action({ type: "train", troop: "boarders" }), count: 5000 } });
    await expectApplied(server, p, action({ type: "train", troop: "harpooners" }));
    later(1000);
    await expectRefused(server, p, action({ type: "train", troop: "crossbowmen" }), "Training is already underway");
    // The batch the server set: Barracks level × 20, never what a client would like.
    expect(p.ref.now().training).toMatchObject({ troop: "harpooners", count: 40 });
  });

  it("done when: a player who lost all their troops at sea trains new ones, and the server decides when they arrive", async () => {
    const server = await buildApp({ db, now: () => clock });
    const base = newPlayerState();
    const p = await player({ ...base, buildings: { ...base.buildings, barracks: 1 }, troops: emptyTroops() });
    await expectRefused(server, p, action({ type: "sail", site: "camp-1" }), "You do not have enough troops");
    await expectApplied(server, p, action({ type: "train", troop: "crossbowmen" }));
    later(trainTime(20) * 1000 - 1000);
    await expectRules(server, p);
    expect(p.ref.now().troops).toEqual(emptyTroops());
    later(1000);
    await expectRules(server, p);
    expect(p.ref.now().troops).toEqual({ ...emptyTroops(), crossbowmen: 20 });
    expect(p.ref.now().training).toBeNull();
    await expectApplied(server, p, action({ type: "sail", site: "camp-1" }));
  });
  it("veterans: no Doctrine, Barracks below 3, one work already underway, fewer than 10, not enough resources, an unknown troop, a number sent", async () => {
    const server = await buildApp({ db, now: () => clock });
    const base = newPlayerState();
    const ready = {
      ...base,
      buildings: { ...base.buildings, barracks: 3 },
      techs: { veterans: 1 },
      troops: { boarders: 30, harpooners: 9, crossbowmen: 20 },
      stock: { oil: 9000, fish: 9000, wood: 9000, rope: 3 },
    };
    const doctrine = "You need the Veteran Doctrine research at the Observatory and Barracks at level 3.";

    await expectRefused(server, await player({ ...ready, techs: {} }), action({ type: "promote", troop: "boarders" }), doctrine);
    await expectRefused(server, await player({ ...ready, buildings: { ...ready.buildings, barracks: 2 } }), action({ type: "promote", troop: "boarders" }), doctrine);
    const poor = await player({ ...ready, stock: { oil: 39, fish: 9000, wood: 9000, rope: 3 } });
    await expectRefused(server, poor, action({ type: "promote", troop: "boarders" }), "Not enough resources");

    const p = await player(ready);
    await expectRefused(server, p, action({ type: "promote", troop: "harpooners" }), "You need 10 harpooners to promote.");
    for (const troop of ["archers", "toString", "__proto__", ""]) await expectInvalid(server, p, { action: { ...action({ type: "promote", troop: "boarders" }), troop } });
    await expectInvalid(server, p, { action: { ...action({ type: "promote", troop: "boarders" }), count: 30 } });
    await expectApplied(server, p, action({ type: "promote", troop: "boarders" }));
    // Exactly 10, never what a client would like.
    expect(p.ref.now().training).toMatchObject({ kind: "promote", troop: "boarders", count: 10 });
    expect(p.ref.now().troops.boarders).toBe(20);
    later(1000);
    await expectRefused(server, p, action({ type: "promote", troop: "crossbowmen" }), "Training is already underway");
    await expectRefused(server, p, action({ type: "train", troop: "crossbowmen" }), "Training is already underway");
  });

  it("from Barracks to battle: the server decides when the veterans arrive, they all sail, and the survivors come home", async () => {
    const server = await buildApp({ db, now: () => clock });
    const base = newPlayerState();
    const p = await player({ ...base, buildings: { ...base.buildings, barracks: 3, infirmary: 1 }, techs: { veterans: 1 } });
    await expectApplied(server, p, action({ type: "promote", troop: "crossbowmen" }));
    later(PROMOTE_TIME * 1000 - 1000);
    await expectRules(server, p);
    expect(p.ref.now().veterans).toEqual(emptyTroops());
    later(1000);
    await expectRules(server, p);
    expect(p.ref.now().veterans).toEqual({ ...emptyTroops(), crossbowmen: 10 });
    await expectApplied(server, p, action({ type: "sail", site: "camp-1" }));
    expect(p.ref.now().veterans).toEqual(emptyTroops());
    expect(p.ref.now().fleets[0]!.veterans).toEqual({ ...emptyTroops(), crossbowmen: 10 });
    later(8 * 3600_000);
    await expectRules(server, p);
    const back = p.ref.now();
    const report = back.reports[0]!;
    expect(back.fleets).toEqual([]);
    expect(report.veteranSent).toEqual({ ...emptyTroops(), crossbowmen: 10 });
    expect(report.infirmary).toBe(true);
    expect(back.veterans.crossbowmen).toBe(10 - report.veteranLosses!.crossbowmen);
    // The wounded are soldiers only.
    expect(back.wounded).toEqual(report.wounded);
  });

  it("healing: no Infirmary, no wounded, one already underway, not enough fish, a field the server does not expect", async () => {
    const server = await buildApp({ db, now: () => clock });
    const base = newPlayerState();
    const wounded = { boarders: 12, harpooners: 5, crossbowmen: 3 };
    const infirmary = { ...base, buildings: { ...base.buildings, infirmary: 1 }, wounded, stock: { oil: 9000, fish: 9000, wood: 9000, rope: 3 } };

    await expectRefused(server, await player({ ...infirmary, buildings: base.buildings }), action({ type: "heal" }), "Build the Infirmary first");
    await expectRefused(server, await player({ ...infirmary, wounded: emptyTroops() }), action({ type: "heal" }), "No wounded to heal");
    const poor = await player({ ...infirmary, stock: { oil: 9000, fish: 39, wood: 9000, rope: 3 } });
    await expectRefused(server, poor, action({ type: "heal" }), "Not enough resources");

    const p = await player(infirmary);
    for (const extra of [{ count: 500 }, { wounded: { boarders: 60, harpooners: 0, crossbowmen: 0 } }, { troop: "boarders" }]) await expectInvalid(server, p, { action: { ...action({ type: "heal" }), ...extra } });
    await expectApplied(server, p, action({ type: "heal" }));
    // The wounded the server had, never a number a client chose.
    expect(p.ref.now().healing?.wounded).toEqual(wounded);
    later(1000);
    await expectRefused(server, p, action({ type: "heal" }), "No wounded to heal");
    const busy = await player({ ...p.ref.now(), wounded: { boarders: 1, harpooners: 0, crossbowmen: 0 } });
    await expectRefused(server, busy, action({ type: "heal" }), "Healing is already underway");
  });

  it("from battle to ranks: the wounded of a fleet are healed, and the server decides when they are back", async () => {
    const server = await buildApp({ db, now: () => clock });
    const base = newPlayerState();
    const p = await player({ ...base, buildings: { ...base.buildings, infirmary: 1 } });
    await expectApplied(server, p, action({ type: "sail", site: "camp-1" }));
    // The fleet fights and comes home on the server's clock.
    later(8 * 3600_000);
    await expectRules(server, p);
    const back = p.ref.now();
    const saved = totalTroops(back.wounded);
    expect(back.fleets).toEqual([]);
    expect(saved).toBeGreaterThan(0);
    await expectApplied(server, p, action({ type: "heal" }));
    // Whole milliseconds: the healing time can hold a fraction of a second.
    later(Math.ceil(healTime(saved) * 1000) - 1000);
    await expectRules(server, p);
    expect(totalTroops(p.ref.now().troops)).toBe(totalTroops(back.troops));
    later(1000);
    await expectRules(server, p);
    expect(totalTroops(p.ref.now().troops)).toBe(totalTroops(back.troops) + saved);
    expect(p.ref.now().healing).toBeNull();
  });
});
