import { describe, expect, it } from "vitest";
import { HOUR } from "@brinelight/shared";
import { HARVEST_REFILL, VARIANTS, buildersAt, combine, failedMornings, harvestAmount, incomeBetween, lostPerDay, pct, raised, seaShare } from "./resources.js";
import type { Measures } from "./resources-rules.js";

const res = (oil: number, fish: number, wood: number) => ({ oil, fish, wood });
const none = res(0, 0, 0);

describe("the resources study's options (docs/studies/resources.md): proposed values, never in the game", () => {
  it("A: a producer of level L makes as the rules' level L + min(L, 5): double up to 5, then five levels more", () => {
    expect([1, 2, 3, 4, 5, 6, 10, 15, 20].map(raised)).toEqual([2, 4, 6, 8, 10, 11, 15, 20, 25]);
  });

  it("C: an isle or a shoal holds the map's amount, 10 % more a Lighthouse level, and fills again 8 hours after it is emptied", () => {
    expect(harvestAmount(600, 1)).toBe(600);
    expect(harvestAmount(600, 11)).toBeCloseTo(1200);
    expect(HARVEST_REFILL).toBe(8 * HOUR);
  });

  it("D: 2 builders, a third at Lighthouse 10, a fourth at 20", () => {
    expect([1, 9, 10, 19, 20, 30].map(buildersAt)).toEqual([2, 2, 3, 3, 4, 4]);
  });

  it("the variants: the options alone and together; E is A and C", () => {
    const e = VARIANTS.find((v) => v.id === "E")!;
    expect(e.production?.("lumberyard", 5)).toBe(10);
    expect(e.harvest?.refill).toBe(HARVEST_REFILL);
    expect(e.storageHours).toBeUndefined();
    expect(e.builders).toBeUndefined();
    expect(combine("B+D")).toMatchObject({ storageHours: 10, builders: buildersAt });
    const woodOil = VARIANTS.find((v) => v.id === "E-wood-oil")!;
    expect([woodOil.production?.("fishery", 5), woodOil.production?.("refinery", 5)]).toEqual([5, 10]);
  });
});

describe("what the study reads from a run", () => {
  const income: Measures["income"] = {
    9: { buildings: res(10, 10, 100), wrecks: res(90, 0, 0), isles: none, shoals: none, camps: none, rewards: none },
    10: { buildings: res(30, 60, 60), wrecks: res(60, 0, 0), isles: res(0, 0, 30), shoals: res(0, 40, 0), camps: res(10, 0, 10), rewards: res(0, 100, 0) },
  };

  it("the sea's share from a Lighthouse level: wrecks, isles, shoals and camps, against everything that came in", () => {
    const s = seaShare(income, 10);
    expect(s.oil).toBeCloseTo(70 / 100);
    expect(s.wood).toBeCloseTo(40 / 100);
    expect(s.fish).toBeCloseTo(40 / 200);
    expect(seaShare(income, 11).wood).toBeNull();
    expect(incomeBetween(income, 9, 10).wrecks).toEqual(res(90, 0, 0));
  });

  it("what the storage cut off a day, and the mornings a free builder could pay for nothing", () => {
    expect(lostPerDay({ 0: res(10, 0, 20), 1: res(30, 0, 0), 5: res(100, 0, 0) }, 0, 2)).toEqual(res(20, 0, 10));
    const m: Measures = {
      idle: {},
      lost: {},
      leftAtSea: {},
      income: {},
      mornings: [
        { day: 1, lighthouse: 6, builderFree: true, affordable: false },
        { day: 2, lighthouse: 7, builderFree: false, affordable: false },
        { day: 3, lighthouse: 7, builderFree: true, affordable: true },
      ],
    };
    expect(failedMornings(m)).toBe(1);
    expect([pct(90, 100), pct(110, 100), pct(null, 100)]).toEqual(["-10 %", "+10 %", "–"]);
  });
});
