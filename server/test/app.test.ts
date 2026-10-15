import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("serveur", () => {
  it("répond sur /health", async () => {
    const res = await buildApp().inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it("sert les règles partagées", async () => {
    const res = await buildApp().inject({ method: "GET", url: "/rules/buildings/raffinerie/1" });
    expect(res.json()).toEqual({ id: "raffinerie", level: 1, cost: { bois: 140, poisson: 60 }, seconds: 3240 });
  });

  it("refuse un bâtiment inconnu", async () => {
    const res = await buildApp().inject({ method: "GET", url: "/rules/buildings/casino/1" });
    expect(res.statusCode).toBe(404);
  });

  it("refuse un niveau invalide", async () => {
    const res = await buildApp().inject({ method: "GET", url: "/rules/buildings/phare/-1" });
    expect(res.statusCode).toBe(400);
  });
});
