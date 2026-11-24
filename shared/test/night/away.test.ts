import { describe, expect, it } from "vitest";
import { AWAY_CAP_HOURS, awayRates, collectAway } from "../../src/rules/night/away.js";
import { CITY_SHAPE, newCity, parseCity } from "../../src/rules/night/city.js";

const H = 3600;

describe("what the city makes while you are away", () => {
  it("the first time, nothing: the clock is only set", () => {
    const r = collectAway(newCity(), 1_000_000);
    expect(r.gained).toEqual({ wood: 0, fish: 0 });
    expect(r.city.away).toBe(1_000_000);
  });

  it("wood and fish an hour, by the Lighthouse's level", () => {
    expect(awayRates(1)).toEqual({ wood: 30, fish: 23 });
    expect(awayRates(5).wood).toBeGreaterThan(awayRates(1).wood);
    const c = { ...newCity(), away: 1_000_000 };
    const r = collectAway(c, 1_000_000 + 2 * H);
    expect(r.gained).toEqual({ wood: 60, fish: 46 });
    expect(r.city.stock.wood).toBe(60);
    expect(r.city.away).toBe(1_000_000 + 2 * H);
  });

  it("never more than 4 hours' worth", () => {
    expect(AWAY_CAP_HOURS).toBe(4);
    const r = collectAway({ ...newCity(), away: 1_000_000 }, 1_000_000 + 30 * H);
    expect(r.gained).toEqual({ wood: 4 * 30, fish: 4 * 23 });
  });

  it("a clock moved back gives nothing, and starts the count again from now", () => {
    const r = collectAway({ ...newCity(), away: 2_000_000 }, 1_000_000);
    expect(r.gained).toEqual({ wood: 0, fish: 0 });
    expect(r.city.away).toBe(1_000_000);
    expect(collectAway({ ...newCity(), away: 1_000_000 }, Number.NaN).gained).toEqual({ wood: 0, fish: 0 });
  });

  it("a minute's worth or less is not counted, and not lost", () => {
    const r = collectAway({ ...newCity(), away: 1_000_000 }, 1_000_000 + 30);
    expect(r.gained).toEqual({ wood: 0, fish: 0 });
    expect(r.city.away).toBe(1_000_000);
  });

  it("the city keeps its clock; one saved before starts it now", () => {
    expect(newCity().away).toBe(0);
    const v4 = { ...newCity(), v: 4 } as Record<string, unknown>;
    delete v4.away;
    delete v4.daily;
    expect(parseCity(v4)).toEqual({ ...newCity(), v: CITY_SHAPE });
  });
});
