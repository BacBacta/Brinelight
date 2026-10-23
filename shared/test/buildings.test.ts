import { describe, expect, it } from "vitest";
import { BUILDERS, BUILDING_IDS, STARTING_BUILDINGS, advanceQueue, canUpgrade, maxLevel, startUpgrade, upgradeCost, upgradePearls, upgradeTime, LIGHTHOUSE_MAX, LIGHTHOUSE_PEARLS, QUICK_LEVELS, TIME_SCALE, type BuildingId, type UpgradeJob } from "../src/index.js";

const stock = { oil: 10_000, fish: 10_000, wood: 10_000, rope: 0 };

describe("buildings", () => {
  it("knows the 9 buildings", () => {
    expect(BUILDING_IDS).toHaveLength(9);
  });

  it("Refinery level 1 cost matches the prototype", () => {
    // 90 × 1.6 = 144 → 140; 40 × 1.6 = 64 → 60
    expect(upgradeCost("refinery", 1)).toEqual({ wood: 140, fish: 60 });
  });

  it("Lighthouse: ×1.4 a level in cost and ×1.35 in time (the prototype's ×1.62 and ×1.55 were rebalanced, docs/balance.md)", () => {
    // 180 × 1.4² = 352.8 → 350; 120 × 1.4² = 235.2 → 240
    expect(upgradeCost("lighthouse", 2)).toEqual({ wood: 350, oil: 240 });
    // 180 × 1.4¹⁴ = 20,001.6 → 20,000
    expect(upgradeCost("lighthouse", 14).wood).toBe(20000);
    // 9 × 1.35⁵ = 40.4 prototype seconds (5 → 6, past the quick levels); 9 × 1.35¹⁴ = 601.6, about 2.5 real days
    expect(upgradeTime("lighthouse", 5)).toBe(Math.round(9 * 1.35 ** 5 * TIME_SCALE));
    expect(upgradeTime("lighthouse", 14) / 86400).toBeCloseTo(2.5, 2);
  });

  it("Lighthouse past level 15: ×1.3 a level in cost and ×1.2 in time, the levels up to 15 unchanged", () => {
    // 15 → 16 keeps ×1.4 and ×1.35: 180 × 1.4¹⁵ = 28,002 → 28,000; 9 × 1.35¹⁵ = 812 prototype seconds.
    expect(upgradeCost("lighthouse", 15)).toEqual({ wood: 28000, oil: 18670 });
    expect(upgradeTime("lighthouse", 15)).toBe(Math.round(9 * 1.35 ** 15 * TIME_SCALE));
    // 16 → 17: 180 × 1.4¹⁵ × 1.3 = 36,403 → 36,400; 9 × 1.35¹⁵ × 1.2.
    expect(upgradeCost("lighthouse", 16)).toEqual({ wood: 36400, oil: 24270 });
    expect(upgradeTime("lighthouse", 16)).toBe(Math.round(9 * 1.35 ** 15 * 1.2 * TIME_SCALE));
    // 29 → 30, the longest: 180 × 1.4¹⁵ × 1.3¹⁴ = 1,102,550 wood; 9 × 1.35¹⁵ × 1.2¹⁴, about 43.4 real days.
    expect(upgradeCost("lighthouse", 29).wood).toBe(1102550);
    expect(upgradeTime("lighthouse", 29) / 86400).toBeCloseTo(43.4, 1);
    let total = 0;
    for (let l = 15; l < LIGHTHOUSE_MAX; l++) total += upgradeTime("lighthouse", l);
    expect(total / 86400).toBeCloseTo(243.5, 1);
    // The other buildings keep one growth.
    expect(upgradeCost("refinery", 20).wood).toBe(Math.round((90 * 1.6 ** 20) / 10) * 10);
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

  it("a 6 s prototype duration equals 36 real minutes (the Refinery's growth, past the quick levels)", () => {
    expect(6 * TIME_SCALE).toBe(2160);
    expect(upgradeTime("refinery", 5)).toBe(Math.round(6 * 1.5 ** 5 * TIME_SCALE));
  });

  describe("the quick first levels (owner's decision, 23 October: A of docs/studies/early-game.md)", () => {
    // The owner's table (docs/tasks/early-start.md), in real seconds, by the level reached: 1, 1, 2, 5 and 15 minutes.
    it("caps an upgrade to levels 1 to 5 at 1, 1, 2, 5 and 15 minutes", () => {
      expect(QUICK_LEVELS).toEqual({ 1: 60, 2: 60, 3: 120, 4: 300, 5: 900 });
    });

    it("every island building, level by level: the owner's table exactly", () => {
      const table: Record<BuildingId, number[]> = {
        lighthouse: [60, 60, 120, 300, 900],
        refinery: [60, 60, 120, 300, 900],
        fishery: [60, 60, 120, 300, 900],
        lumberyard: [60, 60, 120, 300, 900],
        shelters: [60, 60, 120, 300, 900],
        barracks: [60, 60, 120, 300, 900],
        harbor: [60, 60, 120, 300, 900],
        observatory: [60, 60, 120, 300, 900],
        infirmary: [60, 60, 120, 300, 900],
      };
      for (const id of BUILDING_IDS) expect([0, 1, 2, 3, 4].map((l) => upgradeTime(id, l)), id).toEqual(table[id]);
    });

    it("from level 6 on, the times are the growth's own, unchanged (4 h 02 for the Lighthouse, 6 h 05 for the Barracks)", () => {
      expect(upgradeTime("lighthouse", 5)).toBe(14528);
      expect(upgradeTime("refinery", 5)).toBe(16403);
      expect(upgradeTime("shelters", 5)).toBe(19136);
      expect(upgradeTime("barracks", 5)).toBe(21870);
      expect(upgradeTime("lighthouse", 9)).toBe(48256);
    });

    it("the costs do not change: only the time", () => {
      expect(upgradeCost("lighthouse", 2)).toEqual({ wood: 350, oil: 240 });
      expect(upgradeCost("lighthouse", 4)).toEqual({ wood: 690, oil: 460 });
      expect(upgradeCost("barracks", 0)).toEqual({ wood: 140, oil: 60, fish: 60 });
    });
  });

  it("the Lighthouse caps the other buildings", () => {
    expect(maxLevel("refinery", { ...STARTING_BUILDINGS, lighthouse: 4 })).toBe(4);
    expect(maxLevel("lighthouse", STARTING_BUILDINGS)).toBe(LIGHTHOUSE_MAX);
  });

  it("accepts a valid upgrade", () => {
    expect(canUpgrade("refinery", { buildings: STARTING_BUILDINGS, stock, pearls: 0, queue: [] })).toEqual({ ok: true });
  });

  it("refuses when the Lighthouse is too low", () => {
    const b = { ...STARTING_BUILDINGS, refinery: 2 };
    expect(canUpgrade("refinery", { buildings: b, stock, pearls: 0, queue: [] })).toEqual({ ok: false, reason: "Upgrade the Lighthouse first" });
  });

  it("refuses when the builders are busy", () => {
    const r = canUpgrade("lumberyard", { buildings: STARTING_BUILDINGS, stock, pearls: 0, queue: ["refinery", "fishery"] });
    expect(r.ok).toBe(false);
    expect(BUILDERS).toBe(2);
  });

  it("refuses a building that is already being upgraded", () => {
    const r = canUpgrade("refinery", { buildings: STARTING_BUILDINGS, stock, pearls: 0, queue: ["refinery"] });
    expect(r).toEqual({ ok: false, reason: "This building is already being upgraded" });
  });

  it("refuses without enough resources", () => {
    const r = canUpgrade("lighthouse", { buildings: STARTING_BUILDINGS, stock: { oil: 0, fish: 0, wood: 0, rope: 0 }, pearls: 0, queue: [] });
    expect(r).toEqual({ ok: false, reason: "Not enough resources" });
  });

  it("the Lighthouse's last levels ask Pearls: 5,000 for level 26 up to 9,000 for level 30, 35,000 in all", () => {
    expect([25, 26, 27, 28, 29].map((l) => upgradePearls("lighthouse", l))).toEqual([5000, 6000, 7000, 8000, 9000]);
    expect(Object.values(LIGHTHOUSE_PEARLS).reduce((a, b) => a + b, 0)).toBe(35_000);
    // No other level, and no other building, asks Pearls.
    for (let l = 0; l < 25; l++) expect(upgradePearls("lighthouse", l)).toBe(0);
    expect(upgradePearls("refinery", 27)).toBe(0);
    const rich = { oil: 1e9, fish: 1e9, wood: 1e9, rope: 1e9 };
    const at = (lighthouse: number) => ({ ...STARTING_BUILDINGS, lighthouse });
    expect(canUpgrade("lighthouse", { buildings: at(27), stock: rich, pearls: 6999, queue: [] })).toEqual({ ok: false, reason: "You need 7,000 Pearls for this level." });
    expect(canUpgrade("lighthouse", { buildings: at(27), stock: rich, pearls: 7000, queue: [] })).toEqual({ ok: true });
    expect(canUpgrade("lighthouse", { buildings: at(24), stock: rich, pearls: 0, queue: [] })).toEqual({ ok: true });
    // Resources first: a player short of both is told about the resources.
    expect(canUpgrade("lighthouse", { buildings: at(27), stock, pearls: 0, queue: [] })).toEqual({ ok: false, reason: "Not enough resources" });
    // Started, the upgrade takes its Pearls.
    const r = startUpgrade("lighthouse", { buildings: at(29), stock: rich, pearls: 10_000, queue: [] });
    expect(r.ok && r.pearls).toBe(1000);
  });
});

describe("upgrade queue", () => {
  const start = { buildings: { ...STARTING_BUILDINGS }, stock: { ...stock }, pearls: 0, queue: [] as UpgradeJob[] };

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
