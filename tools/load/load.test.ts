import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../server/src/app.js";
import { loadConfig } from "../../server/src/config.js";
import { openDatabase, type Database } from "../../server/src/db/index.js";
import { outcomeOf, percentile, runLoad, summarize, waitBeforeNext } from "./load.js";

describe("the load test's measures", () => {
  it("p50 and p99", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 0.5)).toBe(50);
    expect(percentile(values, 0.99)).toBe(99);
    expect(percentile([], 0.99)).toBe(0);
  });

  it("only the rules' refusals are expected; a 429 or a 5xx is something to look at", () => {
    expect([200, 422, 429, 400, 409, 500, null].map(outcomeOf)).toEqual(["ok", "rules", "tooMany", "error", "error", "error", "error"]);
  });

  it("never more sign-ins than allowed in any 61 seconds", () => {
    expect(waitBeforeNext([], 0, 18)).toBe(0);
    const starts = Array.from({ length: 18 }, (_, i) => i * 1000);
    expect(waitBeforeNext(starts, 20_000, 18)).toBe(41_000);
    expect(waitBeforeNext(starts, 60_500, 18)).toBe(500);
    expect(waitBeforeNext(starts, 61_000, 18)).toBe(0);
    expect(waitBeforeNext(starts, 62_000, 18)).toBe(0);
  });

  it("a stage counts only its own answers", () => {
    const s = (at: number, ms: number, outcome: "ok" | "rules" | "error") => ({ at, ms, outcome, what: "action", status: outcome === "error" ? 500 : 200 });
    const r = summarize([s(0, 5, "ok"), s(1000, 10, "rules"), s(1500, 20, "error"), s(5000, 99, "ok")], 3, 1000, 3000);
    expect(r).toMatchObject({ players: 3, seconds: 2, requests: 2, perSecond: 1, rules: 1, errors: 1, examples: ["action → 500"] });
  });
});

describe("the load test against a real server", () => {
  let database: Database;
  let url = "";
  const close: (() => Promise<void>)[] = [];
  beforeAll(async () => {
    database = await openDatabase(undefined);
    const app = await buildApp({ db: database.db, config: loadConfig({}) });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    close.push(() => app.close(), () => database.close());
  });
  afterAll(async () => {
    for (const c of close) await c();
  });

  it("3 players sign in with throwaway keys and play: no error, no refusal but the rules'", async () => {
    const { stages, signIns } = await runLoad({
      url,
      origin: "http://localhost:5173",
      stages: [2, 3],
      stageSeconds: 2,
      actionEvery: [0.1, 0.3],
      launchEvery: [0.5, 1],
      signInsPerMinute: 18,
    });
    expect(signIns).toMatchObject({ players: 3, requests: 6, errors: 0, tooMany: 0 });
    expect(stages.map((s) => s.players)).toEqual([2, 3]);
    for (const s of stages) {
      expect(s.requests).toBeGreaterThan(5);
      expect(s).toMatchObject({ errors: 0, tooMany: 0 });
    }
  }, 30_000);
});
