import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("server", () => {
  it("answers on /health", async () => {
    const res = await (await buildApp()).inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it("serves the shared rules", async () => {
    const res = await (await buildApp()).inject({ method: "GET", url: "/rules/buildings/refinery/1" });
    expect(res.json()).toEqual({ id: "refinery", level: 1, cost: { wood: 140, fish: 60 }, seconds: 60 });
  });

  it("rejects an unknown building", async () => {
    const res = await (await buildApp()).inject({ method: "GET", url: "/rules/buildings/casino/1" });
    expect(res.statusCode).toBe(404);
  });

  it("rejects an invalid level", async () => {
    const res = await (await buildApp()).inject({ method: "GET", url: "/rules/buildings/lighthouse/-1" });
    expect(res.statusCode).toBe(400);
  });
});
