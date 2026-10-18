import { describe, expect, it } from "vitest";
import {
  CAPTAIN_MAX_LEVEL, RECRUIT_ODDS, addXp, attackBonus, rarityFromRoll, skillFactor, xpNeeded,
  TECHS, canResearch, observatoryRequired, techCost,
  RAFT_SLOTS, applyMistDamage, canAddRaft, raftCap, raftCost, raftEffect, repairCost, slotOpen,
  STARTING_BUILDINGS, power,
} from "../src/index.js";

const rich = { oil: 99_999, fish: 99_999, wood: 99_999, rope: 99 };

describe("captains", () => {
  it("the published odds add up to 100%", () => {
    expect(Object.values(RECRUIT_ODDS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("roll: 0-4 admiral, 5-29 commander, 30-99 officer", () => {
    expect(rarityFromRoll(4)).toBe("admiral");
    expect(rarityFromRoll(5)).toBe("commander");
    expect(rarityFromRoll(29)).toBe("commander");
    expect(rarityFromRoll(30)).toBe("officer");
    expect(() => rarityFromRoll(100)).toThrow();
  });

  it("experience can raise several levels at once", () => {
    // level 1 → 2 costs 80, 2 → 3 costs 160
    expect(addXp({ level: 1, xp: 0 }, 250)).toEqual({ level: 3, xp: 10, levelsGained: 2 });
  });

  it("the level is capped at 20", () => {
    expect(addXp({ level: 19, xp: 0 }, 1_000_000).level).toBe(CAPTAIN_MAX_LEVEL);
    expect(xpNeeded(5)).toBe(400);
  });

  it("each level strengthens the skill by 4%", () => {
    expect(skillFactor(6)).toBeCloseTo(1.2, 9);
    expect(attackBonus("commander", 6)).toBeCloseTo(1 + 0.15 * 1.2, 9);
  });
});

describe("research", () => {
  it("10 techs, only one of them single-level", () => {
    expect(Object.keys(TECHS)).toHaveLength(10);
    expect(TECHS.veterans.max).toBe(1);
  });

  it("the required Observatory level rises with research", () => {
    expect(observatoryRequired("refining", 0)).toBe(1);
    expect(observatoryRequired("refining", 2)).toBe(3);
    expect(observatoryRequired("veterans", 0)).toBe(3);
  });

  it("the first level of Refining costs 180 wood and 110 oil", () => {
    expect(techCost("refining", 0)).toEqual({ wood: 180, oil: 110 });
  });

  it("refuses research while another is in progress", () => {
    expect(canResearch("refining", { techs: {}, observatory: 3, busy: true, stock: rich }).ok).toBe(false);
  });

  it("refuses without a high enough Observatory", () => {
    expect(canResearch("veterans", { techs: {}, observatory: 2, busy: false, stock: rich })).toEqual({ ok: false, reason: "Observatory level 3 required" });
  });

  it("refuses beyond the max level", () => {
    expect(canResearch("veterans", { techs: { veterans: 1 }, observatory: 9, busy: false, stock: rich }).ok).toBe(false);
  });
});

describe("rafts", () => {
  it("39 slots: 17 in the inner ring, 22 in the outer ring", () => {
    expect(RAFT_SLOTS).toHaveLength(39);
    expect(RAFT_SLOTS.filter((s) => s.ring === 3)).toHaveLength(17);
  });

  it("rafts unlock at Lighthouse level 4", () => {
    expect(raftCap(3)).toBe(0);
    expect(raftCap(4)).toBe(6);
    expect(raftCap(7)).toBe(17);
    expect(raftCap(30)).toBe(39);
  });

  it("the outer ring opens at Lighthouse level 8", () => {
    expect(slotOpen(4, 7)).toBe(false);
    expect(slotOpen(4, 8)).toBe(true);
  });

  it("raft cost rises with the number moored", () => {
    expect(raftCost(0)).toEqual({ wood: 350, rope: 1 });
    expect(raftCost(3)).toEqual({ wood: 580, rope: 2 });
  });

  it("refuses a raft when the Lighthouse is too low", () => {
    const r = canAddRaft({ rafts: {}, lighthouse: 3, slot: "-3,0", stock: rich, yardBusy: false });
    expect(r).toEqual({ ok: false, reason: "Upgrade the Lighthouse to moor more rafts" });
  });

  it("refuses a slot that is taken or unknown", () => {
    const rafts = { "-3,0": { hp: 100, building: null, level: 0 } };
    expect(canAddRaft({ rafts, lighthouse: 4, slot: "-3,0", stock: rich, yardBusy: false }).ok).toBe(false);
    expect(canAddRaft({ rafts, lighthouse: 4, slot: "9,9", stock: rich, yardBusy: false }).ok).toBe(false);
  });

  it("a damaged raft only counts for half", () => {
    const rafts = { a: { hp: 40, building: "greenhouse" as const, level: 2 } };
    expect(raftEffect(rafts, "greenhouse")).toBe(1);
  });

  it("the Mist damages rafts only if the Lighthouse did not hold", () => {
    const rafts = { a: { hp: 100, building: null, level: 0 } };
    expect(applyMistDamage(rafts, true).a?.hp).toBe(100);
    expect(applyMistDamage(rafts, false).a?.hp).toBe(65);
    // One Mist not held on one raft: 35 points × 2 oil.
    expect(repairCost({ "3,0": { hp: 65, building: null, level: 0 } })).toEqual({ oil: 70 });
  });
});

describe("power", () => {
  it("a starting city has a stable power", () => {
    const p = power({ buildings: STARTING_BUILDINGS, troops: { boarders: 25, harpooners: 25, crossbowmen: 25 }, veterans: { boarders: 0, harpooners: 0, crossbowmen: 0 }, captains: [{ rarity: "officer", stars: 1, level: 1 }], techs: {}, rafts: {} });
    expect(p).toBe(2218);
  });
});
