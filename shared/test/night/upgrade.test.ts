import { describe, expect, it } from "vitest";
import { newCity, type PortalCity } from "../../src/rules/night/city.js";
import { nightLoot } from "../../src/rules/night/loot.js";
import { newNight, type NightState } from "../../src/rules/night/state.js";
import { dawn, upgradeCost, upgradeCity } from "../../src/rules/night/upgrade.js";
import { UPGRADE_BASE, UPGRADE_GROWTH } from "../../src/rules/night/values.js";

const rich = (c: PortalCity = newCity()): PortalCity => ({ ...c, stock: { wood: 100_000, fish: 100_000, pearls: 0 } });
const over = (phase: "won" | "lost", night = 1): NightState => ({ ...newNight(1, night), phase, wave: phase === "won" ? 5 : 3, burned: 20, oil: phase === "won" ? 50 : 0 });

describe("dawn: what a Night brings back comes into the city", () => {
  it("its loot into the store, one more Night played; a Night won opens the next", () => {
    const won = over("won");
    const r = dawn(newCity(), won);
    expect(r.ok && r.city).toMatchObject({ stock: nightLoot(won), won: 1, played: 1 });
  });

  it("a Night lost still pays, and opens nothing", () => {
    const lost = over("lost");
    const r = dawn(newCity(), lost);
    expect(r.ok && r.city.stock).toEqual(nightLoot(lost));
    expect(r.ok && r.city.won).toBe(0);
    expect(r.ok && r.city.played).toBe(1);
  });

  it("a Night won again does not lower the highest won", () => {
    const r = dawn({ ...newCity(), won: 3, played: 3 }, over("won", 2));
    expect(r.ok && r.city.won).toBe(3);
  });

  it("refuses a Night not over", () => {
    expect(dawn(newCity(), newNight(1, 1))).toEqual({ ok: false, reason: "The Night is not over yet." });
  });
});

describe("an upgrade, at once", () => {
  it("costs what its level says, growing a level", () => {
    expect(upgradeCost("lighthouse", 1)).toEqual(UPGRADE_BASE.lighthouse);
    expect(upgradeCost("infirmary", 0)).toEqual(UPGRADE_BASE.infirmary);
    const next = upgradeCost("refinery", 2);
    expect(next.wood).toBe(Math.round((UPGRADE_BASE.refinery.wood * UPGRADE_GROWTH) / 5) * 5);
    expect(upgradeCost("refinery", 3).wood).toBeGreaterThan(next.wood);
  });

  it("pays and raises the level at once", () => {
    const c = rich();
    const r = upgradeCity(c, "lighthouse");
    expect(r.ok && r.city.buildings.lighthouse).toBe(2);
    expect(r.ok && r.city.stock.wood).toBe(c.stock.wood - UPGRADE_BASE.lighthouse.wood);
    expect(r.ok && r.city.stock.fish).toBe(c.stock.fish - UPGRADE_BASE.lighthouse.fish);
    expect(c.buildings.lighthouse).toBe(1);
  });

  it("the first upgrade on offer, the Lighthouse, is paid by the poorest lost Night 1 (two waves held, no boat burned)", () => {
    const poorest = { ...over("lost"), burned: 0 };
    const lost = dawn(newCity(), poorest);
    expect(lost.ok && upgradeCity(lost.city, "lighthouse").ok).toBe(true);
  });

  it("refuses with a reason: what is missing, the Lighthouse first, the top level", () => {
    expect(upgradeCity(newCity(), "lighthouse")).toEqual({ ok: false, reason: "You need 80 more wood and 60 more fish." });
    expect(upgradeCity({ ...newCity(), stock: { wood: 80, fish: 0, pearls: 0 } }, "lighthouse")).toEqual({ ok: false, reason: "You need 60 more fish." });
    expect(upgradeCity(rich(), "refinery")).toEqual({ ok: false, reason: "Upgrade the Lighthouse first." });
    const top = rich({ ...newCity(), buildings: { ...newCity().buildings, lighthouse: 10 } });
    expect(upgradeCity(top, "lighthouse")).toEqual({ ok: false, reason: "Your Lighthouse is at its highest level." });
    // Built from 0: the Infirmary's first level waits for nothing but its cost.
    expect(upgradeCity(rich(), "infirmary").ok).toBe(true);
  });
});
