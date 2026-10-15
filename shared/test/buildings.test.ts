import { describe, expect, it } from "vitest";
import { BUILDERS, BUILDING_IDS, STARTING_BUILDINGS, advanceQueue, canUpgrade, maxLevel, startUpgrade, upgradeCost, upgradeTime, LIGHTHOUSE_MAX, TIME_SCALE, type UpgradeJob } from "../src/index.js";

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

describe("upgrade queue", () => {
  const start = { buildings: { ...STARTING_BUILDINGS }, stock: { ...stock }, queue: [] as UpgradeJob[] };

  it("starting an upgrade pays the cost and adds the job with its fixed duration", () => {
    const r = startUpgrade("refinery", start);
    if (!r.ok) throw new Error(r.reason);
    expect(r.stock).toEqual({ oil: 10_000, fish: 10_000 - 60, wood: 10_000 - 140, rope: 0 });
    expect(r.queue).toEqual([{ id: "refinery", left: upgradeTime("refinery", 1), duration: upgradeTime("refinery", 1) }]);
  });

  it("refuses a third job: the builders are busy", () => {
    const queue: UpgradeJob[] = [
      { id: "refinery", left: 100, duration: 100 },
      { id: "fishery", left: 100, duration: 100 },
    ];
    expect(startUpgrade("lumberyard", { ...start, queue })).toEqual({ ok: false, reason: `Your ${BUILDERS} builders are busy` });
  });

  it("refuses with the reason of canUpgrade and changes nothing", () => {
    const poor = { ...start, stock: { oil: 0, fish: 0, wood: 0, rope: 0 } };
    expect(startUpgrade("refinery", poor)).toEqual({ ok: false, reason: "Not enough resources" });
  });

  it("a finished job raises the level, an unfinished one counts down", () => {
    const queue: UpgradeJob[] = [
      { id: "refinery", left: 50, duration: 3240 },
      { id: "fishery", left: 500, duration: 3240 },
    ];
    const r = advanceQueue(STARTING_BUILDINGS, queue, 50);
    expect(r.finished).toEqual(["refinery"]);
    expect(r.buildings.refinery).toBe(2);
    expect(r.buildings.fishery).toBe(1);
    expect(r.queue).toEqual([{ id: "fishery", left: 450, duration: 3240 }]);
  });

  it("jobs ending at the same moment finish in the order they were started", () => {
    const queue: UpgradeJob[] = [
      { id: "lighthouse", left: 10, duration: 10 },
      { id: "refinery", left: 10, duration: 10 },
    ];
    expect(advanceQueue(STARTING_BUILDINGS, queue, 60).finished).toEqual(["lighthouse", "refinery"]);
    expect(advanceQueue(STARTING_BUILDINGS, [...queue].reverse(), 60).finished).toEqual(["refinery", "lighthouse"]);
  });

  it("jobs finish in the order of their end time", () => {
    const queue: UpgradeJob[] = [
      { id: "lighthouse", left: 30, duration: 30 },
      { id: "refinery", left: 10, duration: 10 },
    ];
    expect(advanceQueue(STARTING_BUILDINGS, queue, 60).finished).toEqual(["refinery", "lighthouse"]);
  });

  it("never recomputes the duration of a job in progress", () => {
    // Duration fixed at start, even if it no longer matches upgradeTime for the current level.
    const queue: UpgradeJob[] = [{ id: "refinery", left: 70, duration: 77 }];
    expect(advanceQueue(STARTING_BUILDINGS, queue, 7).queue).toEqual([{ id: "refinery", left: 63, duration: 77 }]);
  });
});
