import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createNonce, openDatabase, schema, type Database } from "../src/db/index.js";
import { schedulePurge } from "../src/purge.js";

let database: Database;
beforeAll(async () => {
  database = await openDatabase(undefined);
}, 30_000);
afterAll(async () => {
  await database.close();
});

const T0 = new Date("2026-10-15T12:00:00Z");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("purge timer", () => {
  it("does not keep the process alive, purges on its schedule and stops with the server", async () => {
    const { db } = database;
    await db.execute(sql`truncate auth_nonces`);
    const app = await buildApp({ db });
    let clock = new Date(T0.getTime() + 3600_000);
    const timer = schedulePurge(app, db, () => clock, 20);
    expect(timer.hasRef()).toBe(false);

    await createNonce(db, "aaaaaaaaaaaaaaaa", T0, new Date(T0.getTime() + 60_000));
    await wait(80);
    expect(await db.select().from(schema.authNonces)).toHaveLength(0);

    await app.close();
    await createNonce(db, "bbbbbbbbbbbbbbbb", T0, new Date(T0.getTime() + 60_000));
    clock = new Date(T0.getTime() + 7200_000);
    await wait(80);
    expect(await db.select().from(schema.authNonces)).toHaveLength(1);
  });
});
