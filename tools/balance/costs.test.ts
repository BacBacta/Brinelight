import { describe, expect, it } from "vitest";
import { BUILDING_IDS, LIGHTHOUSE_MAX, TECHS, storeCap, upgradeCost } from "@brinelight/shared";
import { OPTIONS, RECOMMENDED, STORAGE_MAX, WOOD_WORTH, beforeCost, growth, lessWood, pastFifteen, walls } from "./costs.js";

describe("the costs study's options", () => {
  it("leave the Lighthouse and every level up to 15 as the rules have them", () => {
    for (const o of OPTIONS) {
      if (!o.cost) continue;
      for (let level = 0; level < LIGHTHOUSE_MAX; level++) expect(o.cost("lighthouse", level), `${o.id} ${level}`).toBeNull();
      for (const id of BUILDING_IDS) for (let level = 0; level < 15; level++) expect(o.cost(id, level), `${o.id} ${id} ${level}`).toBeNull();
    }
  });

  it("a growth: the level 16 costs it times the level 15, and so on", () => {
    const at15 = upgradeCost("refinery", 14);
    expect(growth(1.12)("refinery", 15)).toEqual({ wood: Math.round((at15.wood! * 1.12) / 10) * 10, fish: Math.round((at15.fish! * 1.12) / 10) * 10 });
    expect(growth(1.12)("refinery", 29)!.wood).toBe(Math.round((at15.wood! * 1.12 ** 15) / 10) * 10);
  });

  it("less wood: a third of it asked in oil and fish, at what they are worth in wood, shared equally", () => {
    const base = growth(1.12)("barracks", 20)!;
    const c = lessWood(growth(1.12), 1 / 3)("barracks", 20)!;
    const moved = base.wood! / 3;
    expect(c.wood).toBeCloseTo(base.wood! - moved, -1);
    expect(c.oil).toBeCloseTo(base.oil! + moved / 2 / WOOD_WORTH.oil, -1);
    expect(c.fish).toBeCloseTo(base.fish! + moved / 2 / WOOD_WORTH.fish, -1);
    // A building that costs only wood and oil: all of it in oil.
    const harbor = lessWood(growth(1.12), 1 / 3)("harbor", 20)!;
    const h = growth(1.12)("harbor", 20)!;
    expect(harbor.oil).toBeCloseTo(h.oil! + h.wood! / 3 / WOOD_WORTH.oil, -1);
    expect(harbor.fish).toBeUndefined();
  });

  it("the costs before 24 October: ×1.6 a level all the way, the rules' own then", () => {
    expect(beforeCost("refinery", 20)).toEqual({ wood: Math.round((90 * 1.6 ** 20) / 10) * 10, fish: Math.round((40 * 1.6 ** 20) / 10) * 10 });
    expect(beforeCost("refinery", 14)).toBeNull();
    expect(beforeCost("lighthouse", 20)).toBeNull();
  });

  it("the recommended option is the rules' own since 24 October, level by level", () => {
    for (const id of BUILDING_IDS) for (let level = 0; level < LIGHTHOUSE_MAX; level++) expect(lessWood(growth(1.12), 1 / 3)(id, level) ?? upgradeCost(id, level), `${id} ${level}`).toEqual(upgradeCost(id, level));
    expect(OPTIONS.find((o) => o.id === RECOMMENDED)!.cost).toBeNull();
  });

  it("the storage: the costs before 24 October never fit past levels 22 to 24; the recommended option always fits", () => {
    expect(STORAGE_MAX).toBe(storeCap(LIGHTHOUSE_MAX, { warehouses: TECHS.warehouses.max }));
    expect(walls(OPTIONS[0]!)).toMatchObject({ barracks: 22, refinery: 23, fishery: 24 });
    expect(walls(OPTIONS.find((o) => o.id === RECOMMENDED)!)).toEqual({});
  });

  it("what the city costs past 15 falls from billions to millions", () => {
    expect(pastFifteen(OPTIONS[0]!).wood).toBeGreaterThan(1e9);
    expect(pastFifteen(OPTIONS.find((o) => o.id === RECOMMENDED)!).wood).toBeLessThan(2e7);
  });
});
