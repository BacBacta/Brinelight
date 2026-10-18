import { describe, expect, it } from "vitest";
import { LIGHTHOUSE_MAX, STARTING_BUILDINGS, advanceStock, upgradeCost, netRates, oilAutonomy, storeCap, survivorCap, protoRatePerHour, type EconomyState } from "../src/index.js";

const base: EconomyState = { buildings: STARTING_BUILDINGS, techs: {}, rafts: {}, survivors: 8, morale: 84 };

describe("economy", () => {
  it("1 unit per prototype second equals 10 units per real hour", () => {
    expect(protoRatePerHour(1)).toBe(10);
  });

  it("storage: 2,500 per Lighthouse level + 1,500, and at least 1.25 times the next Lighthouse level's wood", () => {
    expect(storeCap(2)).toBe(6500);
    expect(storeCap(10)).toBe(26500);
    expect(storeCap(15)).toBe(39000);
    // From the Lighthouse 16, the next level's wood leads: 36,400 × 1.25 = 45,500.
    expect(storeCap(16)).toBe(45500);
    expect(storeCap(20)).toBe(129963);
    // The largest: 1.25 × 180 × 1.4¹⁵ × 1.3¹⁵ at the Lighthouse 30.
    expect(storeCap(LIGHTHOUSE_MAX)).toBe(1791650);
    for (let l = 2; l <= LIGHTHOUSE_MAX; l++) expect(storeCap(l), `Lighthouse ${l}`).toBeGreaterThanOrEqual(upgradeCost("lighthouse", l).wood! * 1.25);
    expect(storeCap(16, { warehouses: 2 })).toBe(Math.round(upgradeCost("lighthouse", 16).wood! * 1.25 * 1.3));
  });

  it("Sealed Warehouses research raises storage by 15% per level", () => {
    expect(storeCap(2, { warehouses: 2 })).toBe(Math.round(6500 * 1.3));
  });

  it("housing: 6 survivors + 4 per Shelters level", () => {
    expect(survivorCap(1)).toBe(10);
  });

  it("starting rates match the prototype", () => {
    const r = netRates(base);
    // oil: 1.1 − 0.25 × 2 = 0.6 /proto s → 6 /h
    expect(r.oil).toBeCloseTo(6, 6);
    // fish: 1.4 − 8 × 0.06 = 0.92 → 9.2 /h
    expect(r.fish).toBeCloseTo(9.2, 6);
    // wood: 4.2 /proto s → 42 /h (the prototype's 1.4 tripled, docs/balance.md)
    expect(r.wood).toBeCloseTo(42, 6);
  });

  it("morale at 90% or more gives +10% production", () => {
    const r = netRates({ ...base, morale: 95 });
    expect(r.wood).toBeCloseTo(46.2, 6);
  });

  it("the Mist, when not pushed back, cuts production by 30%", () => {
    const r = netRates(base, { mist: true, stoked: false });
    expect(r.wood).toBeCloseTo(42 * 0.7, 6);
  });

  it("stoking the Lighthouse multiplies its consumption by 2.2", () => {
    const r = netRates(base, { mist: true, stoked: true });
    // 1.1 − 0.25 × 2 × 2.2 = 0 → 0 /h
    expect(r.oil).toBeCloseTo(0, 6);
  });

  it("a level 2 Kelp Greenhouse adds 9 fish per hour", () => {
    const r = netRates({ ...base, rafts: { "-3,0": { hp: 100, building: "greenhouse", level: 2 } } });
    expect(r.fish - netRates(base).fish).toBeCloseTo(9, 6);
  });

  it("the Smokehouse reduces what survivors eat, never below half", () => {
    const many = { ...base, rafts: { a: { hp: 100, building: "smokehouse" as const, level: 3 }, b: { hp: 100, building: "smokehouse" as const, level: 3 } } };
    const eaten = netRates(base).fish - netRates({ ...many, survivors: 0 }).fish;
    const eatenWithSmokehouse = netRates(many).fish - netRates({ ...many, survivors: 0 }).fish;
    expect(eatenWithSmokehouse).toBeCloseTo(eaten * 0.5, 6);
  });

  it("the stock advances at a constant rate and stops at storage", () => {
    const s = advanceStock({ oil: 0, fish: 6000, wood: 100, rope: 0 }, { oil: 6, fish: 1000, wood: -1000 }, 3600, 6500);
    expect(s.oil).toBe(6);
    expect(s.fish).toBe(6500);
    expect(s.wood).toBe(0);
  });

  it("a stock already above the cap does not drop because of the cap", () => {
    const s = advanceStock({ oil: 9000, fish: 0, wood: 0, rope: 0 }, { oil: 10, fish: 0, wood: 0 }, 3600, 6500);
    expect(s.oil).toBe(9000);
  });

  it("oil lasts forever when production covers the stoked Lighthouse", () => {
    expect(oilAutonomy(base, 100)).toBe(Infinity);
  });

  it("oil duration is computed when the Lighthouse burns more than it gets", () => {
    const s = { ...base, buildings: { ...STARTING_BUILDINGS, lighthouse: 6 } };
    // 1.1 − 0.25 × 6 × 2.2 = −2.2 /proto s → −22 /h; 220 oil = 10 h
    expect(oilAutonomy(s, 220)).toBeCloseTo(10 * 3600, 3);
  });
});
