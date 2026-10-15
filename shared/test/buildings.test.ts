import { describe, expect, it } from "vitest";
import { BUILDERS, BUILDING_IDS, STARTING_BUILDINGS, canUpgrade, maxLevel, upgradeCost, upgradeTime, LIGHTHOUSE_MAX, TIME_SCALE } from "../src/index.js";

const stock = { oil: 10_000, fish: 10_000, wood: 10_000, rope: 0 };

describe("buildings", () => {
  it("knows the 9 buildings", () => {
    expect(BUILDING_IDS).toHaveLength(9);
  });

  it("Refinery level 1 cost matches the prototype", () => {
    // 90 × 1.6 = 144 → 140; 40 × 1.6 = 64 → 60
    expect(upgradeCost("refinery", 1)).toEqual({ wood: 140, fish: 60 });
  });

  it("Lighthouse level 2 cost matches the prototype", () => {
    // 180 × 1.62² = 472.4 → 470; 120 × 1.62² = 314.9 → 310
    expect(upgradeCost("lighthouse", 2)).toEqual({ wood: 470, oil: 310 });
  });

  it("costs are rounded to the nearest ten", () => {
    for (const id of BUILDING_IDS) {
      for (let l = 0; l < 12; l++) {
        for (const v of Object.values(upgradeCost(id, l))) expect(v % 10).toBe(0);
      }
    }
  });

  it("costs go up at every level", () => {
    for (const id of BUILDING_IDS) {
      const a = Object.values(upgradeCost(id, 3)).reduce((x, y) => x + y, 0);
      const b = Object.values(upgradeCost(id, 4)).reduce((x, y) => x + y, 0);
      expect(b).toBeGreaterThan(a);
    }
  });

  it("a 6 s prototype duration equals 36 real minutes", () => {
    expect(upgradeTime("refinery", 0)).toBe(6 * TIME_SCALE);
    expect(upgradeTime("refinery", 0)).toBe(2160);
  });

  it("the Lighthouse caps the other buildings", () => {
    expect(maxLevel("refinery", { ...STARTING_BUILDINGS, lighthouse: 4 })).toBe(4);
    expect(maxLevel("lighthouse", STARTING_BUILDINGS)).toBe(LIGHTHOUSE_MAX);
  });

  it("accepts a valid upgrade", () => {
    expect(canUpgrade("refinery", { buildings: STARTING_BUILDINGS, stock, queue: [] })).toEqual({ ok: true });
  });

  it("refuses when the Lighthouse is too low", () => {
    const b = { ...STARTING_BUILDINGS, refinery: 2 };
    expect(canUpgrade("refinery", { buildings: b, stock, queue: [] })).toEqual({ ok: false, reason: "Upgrade the Lighthouse first" });
  });

  it("refuses when the builders are busy", () => {
    const r = canUpgrade("lumberyard", { buildings: STARTING_BUILDINGS, stock, queue: ["refinery", "fishery"] });
    expect(r.ok).toBe(false);
    expect(BUILDERS).toBe(2);
  });

  it("refuses a building that is already being upgraded", () => {
    const r = canUpgrade("refinery", { buildings: STARTING_BUILDINGS, stock, queue: ["refinery"] });
    expect(r).toEqual({ ok: false, reason: "This building is already being upgraded" });
  });

  it("refuses without enough resources", () => {
    const r = canUpgrade("lighthouse", { buildings: STARTING_BUILDINGS, stock: { oil: 0, fish: 0, wood: 0, rope: 0 }, queue: [] });
    expect(r).toEqual({ ok: false, reason: "Not enough resources" });
  });
});
