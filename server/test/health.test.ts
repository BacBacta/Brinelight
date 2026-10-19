import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openDatabase, type Database } from "../src/db/index.js";
import { BACKUP_FILE, RESTORE_FILE, databaseUp } from "../src/health.js";

const NOW = new Date("2026-10-20T12:00:00Z");
const hoursAgo = (h: number) => String(Math.floor(NOW.getTime() / 1000 - h * 3600));

let database: Database;
let dir: string;
beforeEach(async () => {
  database = await openDatabase(undefined);
  dir = await mkdtemp(join(tmpdir(), "brinelight-status-"));
});
afterEach(async () => {
  await database.close().catch(() => {});
  await rm(dir, { recursive: true, force: true });
});

/** The server as online: a database and a status folder. */
const get = async (statusDir: string | null = dir) => {
  const app = await buildApp({ db: database.db, config: { ...loadConfig({}), statusDir }, now: () => NOW });
  const res = await app.inject({ method: "GET", url: "/health" });
  return { code: res.statusCode, body: res.json() };
};

describe("/health tells the truth", () => {
  it("all well: the database answers, last night's backup, the last test restore passed", async () => {
    await writeFile(join(dir, BACKUP_FILE), `${hoursAgo(5)}\n`);
    await writeFile(join(dir, RESTORE_FILE), `ok ${hoursAgo(30)}\n`);
    expect(await get()).toEqual({ code: 200, body: { ok: true, service: "brinelight", version: "0.1.0", database: "ok", backup: "ok", restore: "ok" } });
  });

  it("the database stopped: 503, database down", async () => {
    await writeFile(join(dir, BACKUP_FILE), hoursAgo(5));
    await database.close();
    const { code, body } = await get();
    expect(code).toBe(503);
    expect(body).toMatchObject({ ok: false, database: "down", backup: "ok" });
  });

  it("a database that does not answer in time is down", async () => {
    const stuck = { execute: () => new Promise(() => {}) } as unknown as Database["db"];
    expect(await databaseUp(stuck, 50)).toBe(false);
  });

  it("a backup 25 hours old is fine; 27 hours old is late, and the server is not ok", async () => {
    await writeFile(join(dir, BACKUP_FILE), hoursAgo(25));
    expect(await get()).toMatchObject({ code: 200, body: { ok: true, backup: "ok" } });
    await writeFile(join(dir, BACKUP_FILE), hoursAgo(27));
    expect(await get()).toMatchObject({ code: 503, body: { ok: false, backup: "late", database: "ok" } });
  });

  it("no backup yet, or an unreadable one: not ok", async () => {
    expect(await get()).toMatchObject({ code: 503, body: { ok: false, backup: "none" } });
    await writeFile(join(dir, BACKUP_FILE), "yesterday");
    expect(await get()).toMatchObject({ code: 503, body: { ok: false, backup: "late" } });
  });

  it("a failed test restore: 503, restore failed; none yet does not count", async () => {
    await writeFile(join(dir, BACKUP_FILE), hoursAgo(1));
    expect(await get()).toMatchObject({ code: 200, body: { ok: true, restore: "none" } });
    await writeFile(join(dir, RESTORE_FILE), `failed ${hoursAgo(2)}\n`);
    expect(await get()).toMatchObject({ code: 503, body: { ok: false, restore: "failed", backup: "ok" } });
  });

  it("without a status folder (development), only the database is checked", async () => {
    expect(await get(null)).toEqual({ code: 200, body: { ok: true, service: "brinelight", version: "0.1.0", database: "ok" } });
  });
});
