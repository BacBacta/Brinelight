import { describe, expect, it } from "vitest";
import { BUILDERS, BUILDING_IDS, STARTING_BUILDINGS, advanceQueue, canUpgrade, maxLevel, startUpgrade, upgradeCost, upgradePearls, upgradeTime, COST_PAST_15, WOOD_WORTH, storeCap, DAY, HOUR, LIGHTHOUSE_MAX, LIGHTHOUSE_PEARLS, QUICK_LEVELS, type BuildingId, type UpgradeJob } from "../src/index.js";

const stock = { oil: 10_000, fish: 10_000, wood: 10_000, rope: 0 };

describe("buildings", () => {
  it("knows the 9 buildings", () => {
    expect(BUILDING_IDS).toHaveLength(9);
  });

  it("Refinery level 1 cost matches the prototype", () => {
    // 90 × 1.6 = 144 → 140; 40 × 1.6 = 64 → 60
    expect(upgradeCost("refinery", 1)).toEqual({ wood: 140, fish: 60 });
  });

  it("Lighthouse: ×1.4 a level in cost (the prototype's ×1.62 was rebalanced, docs/balance.md)", () => {
    // 180 × 1.4² = 352.8 → 350; 120 × 1.4² = 235.2 → 240
    expect(upgradeCost("lighthouse", 2)).toEqual({ wood: 350, oil: 240 });
    // 180 × 1.4¹⁴ = 20,001.6 → 20,000
    expect(upgradeCost("lighthouse", 14).wood).toBe(20000);
  });

  it("Lighthouse past level 15: ×1.3 a level in cost, the levels up to 15 unchanged", () => {
    // 15 → 16 keeps ×1.4: 180 × 1.4¹⁵ = 28,002 → 28,000.
    expect(upgradeCost("lighthouse", 15)).toEqual({ wood: 28000, oil: 18670 });
    // 16 → 17: 180 × 1.4¹⁵ × 1.3 = 36,403 → 36,400.
    expect(upgradeCost("lighthouse", 16)).toEqual({ wood: 36400, oil: 24270 });
    // 29 → 30: 180 × 1.4¹⁵ × 1.3¹⁴ = 1,102,550 wood.
    expect(upgradeCost("lighthouse", 29).wood).toBe(1102550);
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

    it("the costs do not change: only the time", () => {
      expect(upgradeCost("lighthouse", 2)).toEqual({ wood: 350, oil: 240 });
      expect(upgradeCost("lighthouse", 4)).toEqual({ wood: 690, oil: 460 });
      expect(upgradeCost("barracks", 0)).toEqual({ wood: 140, oil: 60, fish: 60 });
    });
  });

  describe("the build times of levels 6 to 30 (owner's decision, 24 October: the slower curve of docs/studies/durations.md)", () => {
    // The owner's table, in minutes, by the level reached, 6 to 30.
    const MINUTES = {
      lighthouse: [44, 72, 106, 148, 200, 263, 339, 431, 539, 668, 819, 997, 1205, 1446, 1726, 2050, 2422, 2849, 3339, 3898, 4535, 5260, 6082, 7012, 8064],
      producers: [40, 64, 92, 125, 165, 213, 269, 335, 413, 503, 608, 729, 868, 1028, 1211, 1419, 1656, 1925, 2229, 2572, 2959, 3394, 3882, 4429, 5040],
      shelters: [41, 66, 96, 132, 176, 228, 290, 364, 450, 552, 670, 808, 967, 1150, 1360, 1601, 1876, 2189, 2545, 2948, 3404, 3918, 4498, 5149, 5880],
      large: [42, 69, 100, 139, 186, 242, 310, 391, 486, 598, 730, 883, 1061, 1267, 1504, 1777, 2090, 2447, 2854, 3318, 3843, 4438, 5110, 5867, 6720],
    };
    const GROUP: Record<BuildingId, keyof typeof MINUTES> = {
      lighthouse: "lighthouse",
      refinery: "producers",
      fishery: "producers",
      lumberyard: "producers",
      shelters: "shelters",
      infirmary: "shelters",
      barracks: "large",
      harbor: "large",
      observatory: "large",
    };
    const minutes = (id: BuildingId) => Array.from({ length: 25 }, (_, i) => upgradeTime(id, i + 5) / 60);

    it("every building, level by level: the owner's table exactly", () => {
      for (const id of BUILDING_IDS) expect(minutes(id), id).toEqual(MINUTES[GROUP[id]]);
      // As a player reads them: Lighthouse 6 in 44 min, 10 in 3 h 20, 30 in 5 d 14 h; the Refinery's 30 in 3 d 12 h.
      expect(upgradeTime("lighthouse", 9)).toBe(3 * HOUR + 20 * 60);
      expect(upgradeTime("lighthouse", 29)).toBe(5 * DAY + 14 * HOUR + 24 * 60);
      expect(upgradeTime("refinery", 29)).toBe(3 * DAY + 12 * HOUR);
    });

    it("rises at every level, and less and less from 5 → 6 on (4 → 5 is ×3): no cliff", () => {
      for (const id of BUILDING_IDS) {
        let before = 3;
        for (let l = 5; l < LIGHTHOUSE_MAX; l++) {
          const r = upgradeTime(id, l) / upgradeTime(id, l - 1);
          expect(r, `${id} ${l + 1}`).toBeGreaterThan(1);
          expect(r, `${id} ${l + 1}`).toBeLessThanOrEqual(before + 1e-3);
          before = r;
        }
      }
    });

    it("the Lighthouse is the longest of its level, then the Barracks, Harbor and Observatory, the Shelters and Infirmary, the producers", () => {
      for (let l = 5; l < LIGHTHOUSE_MAX; l++) {
        expect(upgradeTime("lighthouse", l)).toBeGreaterThan(upgradeTime("barracks", l));
        expect(upgradeTime("barracks", l)).toBeGreaterThan(upgradeTime("shelters", l));
        expect(upgradeTime("shelters", l)).toBeGreaterThan(upgradeTime("refinery", l));
      }
    });

    it("never weeks: at most 5 days 14 hours, the Lighthouse's 30", () => {
      for (const id of BUILDING_IDS) for (let l = 0; l < LIGHTHOUSE_MAX; l++) expect(upgradeTime(id, l)).toBeLessThanOrEqual(upgradeTime("lighthouse", 29));
      expect(upgradeTime("lighthouse", 29)).toBeLessThan(6 * DAY);
    });
  });

  describe("the costs past level 15 (owner's decision, 24 October: docs/studies/costs.md)", () => {
    // The owner's values, by the level reached: every building but the Lighthouse.
    const VALUES = {
      refinery: { 16: { wood: 48420, fish: 40350 }, 20: { wood: 76190, fish: 63490 }, 25: { wood: 134270, fish: 111890 }, 30: { wood: 236640, fish: 197190 } },
      fishery: { 16: { wood: 43050, oil: 29850 }, 20: { wood: 67730, oil: 46970 }, 25: { wood: 119370, oil: 82780 }, 30: { wood: 210370, oil: 145890 } },
      lumberyard: { 16: { fish: 56490, oil: 24210 }, 20: { fish: 88890, oil: 38100 }, 25: { fish: 156660, oil: 67150 }, 30: { fish: 276090, oil: 118340 } },
      shelters: { 16: { wood: 59180, fish: 58280 }, 20: { wood: 93120, fish: 91710 }, 25: { wood: 164110, fish: 161620 }, 30: { wood: 289220, fish: 284820 } },
      barracks: { 16: { wood: 75330, oil: 53350, fish: 54700 }, 20: { wood: 118530, oil: 83950, fish: 86070 }, 25: { wood: 208880, oil: 147950, fish: 151680 }, 30: { wood: 368110, oil: 260720, fish: 267300 } },
      harbor: { 16: { wood: 80710, oil: 75140 }, 20: { wood: 126990, oil: 118230 }, 25: { wood: 223810, oil: 208360 }, 30: { wood: 394430, oil: 367200 } },
      observatory: { 16: { wood: 86080, oil: 83900 }, 20: { wood: 135450, oil: 132030 }, 25: { wood: 238710, oil: 232670 }, 30: { wood: 420700, oil: 410050 } },
      infirmary: { 16: { wood: 64570, fish: 83390 }, 20: { wood: 101590, fish: 131220 }, 25: { wood: 179040, fish: 231250 }, 30: { wood: 315530, fish: 407550 } },
    } as const;

    it("every building, at levels 16, 20, 25 and 30: the owner's values exactly", () => {
      for (const [id, levels] of Object.entries(VALUES)) {
        for (const [level, cost] of Object.entries(levels)) expect(upgradeCost(id as BuildingId, Number(level) - 1), `${id} ${level}`).toEqual(cost);
      }
    });

    it("up to level 15, and the Lighthouse at every level, the costs do not change", () => {
      // ×1.6 a level to 15: the Refinery's level 15 costs 90 × 1.6¹⁴ wood and 40 × 1.6¹⁴ fish.
      expect(upgradeCost("refinery", 14)).toEqual({ wood: Math.round((90 * 1.6 ** 14) / 10) * 10, fish: Math.round((40 * 1.6 ** 14) / 10) * 10 });
      expect(upgradeCost("lighthouse", 29)).toEqual({ wood: 1102550, oil: 735040 });
    });

    it("each level from 16 costs ×1.12 the level before, then a third of its wood is asked in oil and fish, at their worth in wood", () => {
      expect([COST_PAST_15.from, COST_PAST_15.growth, COST_PAST_15.woodShare]).toEqual([15, 1.12, 1 / 3]);
      expect(WOOD_WORTH).toEqual({ oil: 42 / 11, fish: 42 / 14 });
      // The Barracks' level 16: 1.12 × its level 15, rounded; a third of the wood out, half of it into oil, half into fish.
      const at15 = upgradeCost("barracks", 14);
      const grown = { wood: Math.round((at15.wood! * 1.12) / 10) * 10, oil: Math.round((at15.oil! * 1.12) / 10) * 10, fish: Math.round((at15.fish! * 1.12) / 10) * 10 };
      const moved = grown.wood / 3;
      expect(upgradeCost("barracks", 15)).toEqual({
        wood: Math.round((grown.wood - moved) / 10) * 10,
        oil: Math.round((grown.oil + moved / 2 / (42 / 11)) / 10) * 10,
        fish: Math.round((grown.fish + moved / 2 / (42 / 14)) / 10) * 10,
      });
      // The Lumberyard costs no wood: only the growth.
      const lumber = upgradeCost("lumberyard", 14);
      expect(upgradeCost("lumberyard", 15)).toEqual({ fish: Math.round((lumber.fish! * 1.12) / 10) * 10, oil: Math.round((lumber.oil! * 1.12) / 10) * 10 });
    });

    it("a building keeps the resources it costs: no new one appears", () => {
      for (const id of BUILDING_IDS) for (let l = 15; l < LIGHTHOUSE_MAX; l++) expect(Object.keys(upgradeCost(id, l)).sort(), `${id} ${l}`).toEqual(Object.keys(upgradeCost(id, 14)).sort());
    });

    it("every level fits in the storage, at most 2,597,893 (Lighthouse 30, every Sealed Warehouses)", () => {
      const most = storeCap(LIGHTHOUSE_MAX, { warehouses: 3 });
      for (const id of BUILDING_IDS) for (let l = 0; l < LIGHTHOUSE_MAX; l++) for (const v of Object.values(upgradeCost(id, l))) expect(v, `${id} ${l + 1}`).toBeLessThanOrEqual(most);
    });
  });

  it("the Lighthouse caps the other buildings", () => {
    expect(maxLevel("refinery", { ...STARTING_BUILDINGS, lighthouse: 4 })).toBe(4);
    expect(maxLevel("lighthouse", STARTING_BUILDINGS)).toBe(LIGHTHOUSE_MAX);
  });

  it("accepts a valid upgrade", () => {
    expect(canUpgrade("refinery", { buildings: STARTING_BUILDINGS, stock, pearls: 0, survivors: 8, queue: [] })).toEqual({ ok: true });
  });

  it("refuses when the Lighthouse is too low", () => {
    const b = { ...STARTING_BUILDINGS, refinery: 2 };
    expect(canUpgrade("refinery", { buildings: b, stock, pearls: 0, survivors: 8, queue: [] })).toEqual({ ok: false, reason: "Upgrade the Lighthouse first" });
  });

  it("refuses when the builders are busy", () => {
    const r = canUpgrade("lumberyard", { buildings: STARTING_BUILDINGS, stock, pearls: 0, survivors: 8, queue: ["refinery", "fishery"] });
    expect(r.ok).toBe(false);
    expect(BUILDERS).toBe(2);
  });

  it("refuses a building that is already being upgraded", () => {
    const r = canUpgrade("refinery", { buildings: STARTING_BUILDINGS, stock, pearls: 0, survivors: 8, queue: ["refinery"] });
    expect(r).toEqual({ ok: false, reason: "This building is already being upgraded" });
  });

  it("refuses without enough resources", () => {
    const r = canUpgrade("lighthouse", { buildings: STARTING_BUILDINGS, stock: { oil: 0, fish: 0, wood: 0, rope: 0 }, pearls: 0, survivors: 8, queue: [] });
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
    expect(canUpgrade("lighthouse", { buildings: at(27), stock: rich, pearls: 6999, survivors: 8, queue: [] })).toEqual({ ok: false, reason: "You need 7,000 Pearls for this level." });
    expect(canUpgrade("lighthouse", { buildings: at(27), stock: rich, pearls: 7000, survivors: 8, queue: [] })).toEqual({ ok: true });
    expect(canUpgrade("lighthouse", { buildings: at(24), stock: rich, pearls: 0, survivors: 8, queue: [] })).toEqual({ ok: true });
    // Resources first: a player short of both is told about the resources.
    expect(canUpgrade("lighthouse", { buildings: at(27), stock, pearls: 0, survivors: 8, queue: [] })).toEqual({ ok: false, reason: "Not enough resources" });
    // Started, the upgrade takes its Pearls.
    const r = startUpgrade("lighthouse", { buildings: at(29), stock: rich, pearls: 10_000, survivors: 8, queue: [] });
    expect(r.ok && r.pearls).toBe(1000);
  });
});

describe("upgrade queue", () => {
  const start = { buildings: { ...STARTING_BUILDINGS }, stock: { ...stock }, pearls: 0, survivors: 8, queue: [] as UpgradeJob[] };

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
    expect(startUpgrade("lumberyard", { ...start, queue })).toEqual({ ok: false, reason: "Your builders are busy." });
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
