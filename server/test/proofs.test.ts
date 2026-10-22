/**
 * The Lighthouse's milestones recorded by the server (week 9, task 2), to be sealed on Solana at night. Runs on PGlite
 * with the other tests, and on a real PostgreSQL in the CI (job "postgres", with TEST_DATABASE_URL), where the table
 * comes from the migration 0004.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { HOUR, fromHex, leafBytes, newPlayerState, toHex, type GameAction, type PlayerState, type ProofWhen } from "@brinelight/shared";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { base58Encode } from "../src/auth/base58.js";
import { createSession, findOrCreatePlayer, openDatabase, schema, type Database, type Db } from "../src/db/index.js";
import { sha256 } from "../src/proofs/merkle.js";
import { checkTestDatabaseUrl } from "./testDatabase.js";

const TEST_URL = process.env.TEST_DATABASE_URL || undefined;
if (TEST_URL) checkTestDatabaseUrl(TEST_URL);

/** 22 October 2026, 12:00 UTC. */
const T0 = new Date("2026-10-22T12:00:00.000Z");
const DAY_MS = 24 * 3600_000;

let database: Database;
let db: Db;
let clock: Date;
beforeAll(async () => {
  database = await openDatabase(TEST_URL);
  db = database.db;
}, 60_000);
beforeEach(async () => {
  await db.execute(sql`truncate players, sessions, auth_nonces, cities, applied_actions, proofs cascade`);
  clock = T0;
});
afterAll(async () => {
  await database?.close();
});

const app = () => buildApp({ db, now: () => clock });
type App = Awaited<ReturnType<typeof app>>;

/** A signed-in player with a real-looking wallet (32 random bytes in base58), and their city stored at `clock`. */
async function player(state: PlayerState, wallet = base58Encode(randomBytes(32))) {
  const p = await findOrCreatePlayer(db, wallet, clock);
  const token = randomBytes(32).toString("base64url");
  await createSession(db, token, p.id, clock, new Date(clock.getTime() + 30 * DAY_MS));
  await db.insert(schema.cities).values({ playerId: p.id, state, version: 1, shape: 10, savedAt: clock });
  return { id: p.id, token, wallet };
}

/** A rich city at Lighthouse `level`, its next level ending `left` seconds after `clock` when given. */
function city(level: number, left?: number): PlayerState {
  const s = newPlayerState(clock.getTime() / 1000);
  return {
    ...s,
    buildings: { ...s.buildings, lighthouse: level, refinery: 3, fishery: 3, lumberyard: 3 },
    stock: { oil: 50_000, fish: 50_000, wood: 50_000, rope: 50_000 },
    queue: left === undefined ? [] : [{ id: "lighthouse", left, duration: left }],
  };
}

const upgradeOf = (building: "refinery" | "fishery", id = randomUUID()): GameAction => ({ id, type: "upgrade", building });
const send = (server: App, token: string, body: unknown) =>
  server.inject({ method: "POST", url: "/city/actions", headers: { authorization: `Bearer ${token}` }, payload: body as object });
const rows = async (playerId: string) => (await db.select().from(schema.proofs).where(eq(schema.proofs.playerId, playerId))).sort((a, b) => a.fact.localeCompare(b.fact));
const later = (ms: number) => (clock = new Date(clock.getTime() + ms));

describe("the milestones the server records", () => {
  it("a Lighthouse that ended while you were away: on the day its work ended, recorded at the next action", async () => {
    const server = await app();
    // Lighthouse 5 ends at 13:00 on 22 October; the next action comes three days later.
    const { id, token, wallet } = await player(city(4, HOUR));
    later(3 * DAY_MS);
    expect((await send(server, token, { action: upgradeOf("refinery") })).statusCode).toBe(200);
    const [r, ...more] = await rows(id);
    expect(more).toEqual([]);
    expect(r).toMatchObject({ fact: "lighthouse:5", when: "on", day: "2026-10-22", recordedAt: clock });
    // The leaf is the salted hash of the player's own wallet and fact: the player can redo it with their salt.
    expect(r!.salt).toMatch(/^[0-9a-f]{32}$/);
    const bytes = leafBytes({ salt: fromHex(r!.salt)!, wallet, fact: r!.fact, when: r!.when as ProofWhen, day: r!.day })!;
    expect(r!.leaf).toBe(toHex(sha256(bytes)));
  });

  it("a Lighthouse that ends during play: on the same day", async () => {
    const server = await app();
    const { id, token } = await player(city(9, 10 * 60));
    later(20 * 60_000);
    await send(server, token, { action: upgradeOf("refinery") });
    expect((await rows(id)).map((r) => [r.fact, r.when, r.day])).toEqual([
      ["lighthouse:10", "on", "2026-10-22"],
      ["lighthouse:5", "by", "2026-10-22"],
    ]);
  });

  it("a city already past two milestones: 5 and 10 by the day of its next save, and nothing more after", async () => {
    const server = await app();
    const { id, token } = await player(city(12));
    later(DAY_MS);
    await send(server, token, { action: upgradeOf("refinery") });
    expect((await rows(id)).map((r) => [r.fact, r.when, r.day])).toEqual([
      ["lighthouse:10", "by", "2026-10-23"],
      ["lighthouse:5", "by", "2026-10-23"],
    ]);
    const first = await rows(id);
    later(DAY_MS);
    await send(server, token, { action: upgradeOf("fishery") });
    expect(await rows(id)).toEqual(first);
  });

  it("each leaf has its own salt, so two players at the same milestone the same day have two different leaves", async () => {
    const server = await app();
    const a = await player(city(5));
    const b = await player(city(5));
    await send(server, a.token, { action: upgradeOf("refinery") });
    await send(server, b.token, { action: upgradeOf("refinery") });
    const [ra] = await rows(a.id);
    const [rb] = await rows(b.id);
    expect(ra!.salt).not.toBe(rb!.salt);
    expect(ra!.leaf).not.toBe(rb!.leaf);
  });

  it("an action replayed, a refused action, and an action that changes nothing record nothing", async () => {
    const server = await app();
    const poor = { ...city(12), stock: { oil: 0, fish: 0, wood: 0, rope: 0 } };
    const { id, token } = await player(poor);
    expect((await send(server, token, { action: upgradeOf("refinery") })).statusCode).toBe(422);
    expect(await send(server, token, { action: { id: randomUUID(), type: "readReport", reportId: "r1" } }).then((r) => r.statusCode)).toBe(200);
    expect(await rows(id)).toEqual([]);

    const rich = await player(city(4, HOUR));
    later(2 * 3600_000);
    const action = upgradeOf("refinery");
    await send(server, rich.token, { action });
    const once = await rows(rich.id);
    expect(once.map((r) => r.fact)).toEqual(["lighthouse:5"]);
    later(DAY_MS);
    expect((await send(server, rich.token, { action })).json()).toMatchObject({ replayed: true });
    expect(await rows(rich.id)).toEqual(once);
  });

  it("a city under Lighthouse 5 records nothing", async () => {
    const server = await app();
    const { id, token } = await player(city(3, HOUR));
    later(2 * 3600_000);
    await send(server, token, { action: upgradeOf("refinery") });
    expect(await rows(id)).toEqual([]);
  });

  it("a client can never send a milestone, a fact, a day or a proof: refused as invalid, nothing recorded", async () => {
    const server = await app();
    const { id, token } = await player(city(12));
    const a = upgradeOf("refinery");
    const bodies: unknown[] = [
      { action: { ...a, proof: { fact: "lighthouse:30" } } },
      { action: { ...a, fact: "lighthouse:30" } },
      { action: { ...a, day: "2026-01-01" } },
      { action: { ...a, milestone: 30 } },
      { action: { ...a, when: "on" } },
      { action: a, proof: { fact: "lighthouse:30", day: "2026-01-01" } },
      { action: a, milestones: ["lighthouse:30"] },
      { action: { id: randomUUID(), type: "proof", fact: "lighthouse:30" } },
      { action: { id: randomUUID(), type: "recordMilestone", level: 30 } },
    ];
    for (const body of bodies) {
      const res = await send(server, token, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
    }
    expect(await rows(id)).toEqual([]);
  });

  it("a wallet that does not fit the proof's format records nothing, and the game goes on", async () => {
    const server = await app();
    const { id, token } = await player(city(12), `W${randomBytes(8).toString("hex")}`);
    expect((await send(server, token, { action: upgradeOf("refinery") })).statusCode).toBe(200);
    expect(await rows(id)).toEqual([]);
  });

  it("a fact is recorded once per player, and a player deleted takes their rows with them", async () => {
    const server = await app();
    const { id, token } = await player(city(5));
    await send(server, token, { action: upgradeOf("refinery") });
    const [r] = await rows(id);
    await db.insert(schema.proofs).values({ ...r!, id: undefined, salt: "00".repeat(16) }).onConflictDoNothing();
    expect(await rows(id)).toEqual([r]);
    await db.delete(schema.players).where(eq(schema.players.id, id));
    expect(await db.select().from(schema.proofs)).toEqual([]);
  });
});
