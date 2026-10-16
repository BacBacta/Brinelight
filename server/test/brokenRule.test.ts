/**
 * A rule that gives a city parseState refuses (a bug in the rules, imitated here): the server writes nothing,
 * answers server_error and logs the incident with the player id and the action type, never the city.
 * In a file of its own, because the mock replaces applyAction for the whole file.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import type * as Shared from "@brinelight/shared";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { createSession, findOrCreatePlayer, openDatabase, schema, type Database } from "../src/db/index.js";
import { SERVER_ERROR } from "../src/refusals.js";

vi.mock("@brinelight/shared", async (importOriginal) => {
  const real = await importOriginal<typeof Shared>();
  return {
    ...real,
    // As if a rule spent more Pearls than the city has.
    applyAction: (state: Shared.PlayerState): Shared.ActionResult => ({ ok: true, state: { ...state, pearls: -1 } }),
  };
});

const T0 = new Date("2026-10-15T12:00:00.000Z");
let database: Database;

beforeAll(async () => {
  database = await openDatabase(undefined);
  await database.db.execute(sql`truncate players cascade`);
}, 30_000);
afterAll(async () => {
  await database.close();
});

describe("a rule that gives a broken city", () => {
  it("nothing is written: 500 server_error, the incident logged with the player id and the action type only", async () => {
    const { db } = database;
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const server = await buildApp({ db, now: () => T0, logger: { level: "info", stream } });
    const p = await findOrCreatePlayer(db, `W${randomBytes(8).toString("hex")}`, T0);
    const token = randomBytes(32).toString("base64url");
    await createSession(db, token, p.id, T0, new Date(T0.getTime() + 24 * 3600_000));

    const res = await server.inject({
      method: "POST",
      url: "/city/actions",
      headers: { authorization: `Bearer ${token}` },
      payload: { action: { id: randomUUID(), type: "upgrade", building: "refinery" } },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual(SERVER_ERROR);
    // The city made for the new account is there, untouched; no action id is kept, so a retry is applied afresh.
    const [row] = await db.select().from(schema.cities).where(eq(schema.cities.playerId, p.id));
    expect(row).toMatchObject({ version: 1 });
    expect((row!.state as Shared.PlayerState).pearls).toBeGreaterThan(0);
    expect(await db.select().from(schema.appliedActions).where(eq(schema.appliedActions.playerId, p.id))).toEqual([]);
    const all = lines.join("");
    expect(all).toContain("City refused by parseState after an action");
    expect(all).toContain(`"playerId":"${p.id}"`);
    expect(all).toContain('"action":"upgrade"');
    for (const word of ['"buildings"', '"stock"', '"pearls"', '"state"']) expect(all, word).not.toContain(word);
  });
});
