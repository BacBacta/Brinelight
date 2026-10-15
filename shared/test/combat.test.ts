import { describe, expect, it } from "vitest";
import { BEATS, effective, odds, pirateCamp, pirateLoot, resolveCombat, strengths } from "../src/index.js";

const army = { boarders: 25, harpooners: 25, crossbowmen: 25 };

describe("combat", () => {
  it("level 1 pirate camp: 15 / 44 / 15, as in the prototype", () => {
    expect(pirateCamp(1)).toEqual({ boarders: 15, harpooners: 44, crossbowmen: 15 });
  });

  it("the triangle is complete with no short loop", () => {
    expect(BEATS).toEqual({ boarders: "harpooners", harpooners: "crossbowmen", crossbowmen: "boarders" });
  });

  it("known prototype scenario: 90 vs 89, victory, 12 losses per type", () => {
    const r = resolveCombat({ troops: army, enemy: pirateCamp(1), captain: { cls: "collect", rarity: "officer", level: 1 } });
    expect(r.attack).toBeCloseTo(90, 6);
    expect(Math.round(r.defense)).toBe(89);
    expect(r.win).toBe(true);
    expect(r.losses).toEqual({ boarders: 12, harpooners: 12, crossbowmen: 12 });
    expect(r.survivors).toEqual({ boarders: 13, harpooners: 13, crossbowmen: 13 });
  });

  it("combat is deterministic", () => {
    const input = { troops: army, enemy: pirateCamp(3) };
    expect(resolveCombat(input)).toEqual(resolveCombat(input));
  });

  it("a defeat costs 70% of the troops", () => {
    const r = resolveCombat({ troops: army, enemy: pirateCamp(6) });
    expect(r.win).toBe(false);
    expect(r.lossRate).toBeCloseTo(0.7, 9);
    expect(r.losses.boarders).toBe(18);
  });

  it("a crushing victory costs at least 5%", () => {
    const r = resolveCombat({ troops: { boarders: 500, harpooners: 500, crossbowmen: 500 }, enemy: pirateCamp(1) });
    expect(r.lossRate).toBeCloseTo(0.05, 9);
  });

  it("a veteran counts as 1.8 soldiers", () => {
    expect(effective({ boarders: 10, harpooners: 0, crossbowmen: 0 }, { boarders: 10, harpooners: 0, crossbowmen: 0 }).boarders).toBeCloseTo(28, 9);
  });

  it("an admiral captain of the matching class gives +25% at level 1", () => {
    const solo = { boarders: 0, harpooners: 0, crossbowmen: 50 };
    const enemy = { boarders: 1, harpooners: 0, crossbowmen: 0 };
    const without = strengths({ troops: solo, enemy }).attack;
    const withCaptain = strengths({ troops: solo, enemy, captain: { cls: "crossbowmen", rarity: "admiral", level: 1 } }).attack;
    expect(withCaptain / without).toBeCloseTo(1.25, 9);
  });

  it("Tempered Blades research adds 6% attack per level", () => {
    const a = strengths({ troops: army, enemy: pirateCamp(1) }).attack;
    const b = strengths({ troops: army, enemy: pirateCamp(1), techs: { blades: 2 } }).attack;
    expect(b / a).toBeCloseTo(1.12, 9);
  });

  it("Double Hulls research cuts losses by 8% per level", () => {
    const r = resolveCombat({ troops: army, enemy: pirateCamp(6), techs: { hulls: 1 } });
    expect(r.lossRate).toBeCloseTo(0.7 * 0.92, 9);
  });

  it("without an infirmary, no wounded are saved", () => {
    const r = resolveCombat({ troops: army, enemy: pirateCamp(6) });
    expect(r.wounded).toEqual({ boarders: 0, harpooners: 0, crossbowmen: 0 });
  });

  it("the infirmary saves half the losses, up to its bed count", () => {
    const r = resolveCombat({ troops: army, enemy: pirateCamp(6), hospital: { capacity: 60, occupied: 0 } });
    expect(r.wounded).toEqual({ boarders: 9, harpooners: 9, crossbowmen: 9 });
    const full = resolveCombat({ troops: army, enemy: pirateCamp(6), hospital: { capacity: 60, occupied: 50 } });
    expect(full.wounded.boarders + full.wounded.harpooners + full.wounded.crossbowmen).toBe(10);
  });

  it("displayed odds follow the balance of strength", () => {
    expect(odds({ troops: { boarders: 300, harpooners: 300, crossbowmen: 300 }, enemy: pirateCamp(1) })).toBe("easy");
    expect(odds({ troops: army, enemy: pirateCamp(1) })).toBe("close");
    expect(odds({ troops: army, enemy: pirateCamp(6) })).toBe("hard");
  });

  it("loot grows with the camp level", () => {
    expect(pirateLoot(3)).toEqual({ oil: 210, wood: 210, pearls: 28, rope: 1, fragments: 3 });
  });
});
