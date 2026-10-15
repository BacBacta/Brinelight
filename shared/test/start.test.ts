import { describe, expect, it } from "vitest";
import { OFFLINE_CAP, STARTING_CAPTAIN, STARTING_LEAD, STARTING_MORALE, STARTING_PEARLS, STARTING_STOCK, STARTING_SURVIVORS, STARTING_TROOPS } from "../src/index.js";

describe("starting values (prototype)", () => {
  it("stock: 380 oil, 420 fish, 520 wood, 3 rope", () => {
    expect(STARTING_STOCK).toEqual({ oil: 380, fish: 420, wood: 520, rope: 3 });
  });

  it("troops: 25 of each type", () => {
    expect(STARTING_TROOPS).toEqual({ boarders: 25, harpooners: 25, crossbowmen: 25 });
  });

  it("8 survivors and 84 morale", () => {
    expect(STARTING_SURVIVORS).toBe(8);
    expect(STARTING_MORALE).toBe(84);
  });

  it("200 Pearls", () => {
    expect(STARTING_PEARLS).toBe(200);
  });

  it("captain: Old Tom, level 1, 1 star", () => {
    expect(STARTING_CAPTAIN).toEqual({ id: "tom", level: 1, xp: 0, stars: 1 });
  });

  it("lead captain: Old Tom", () => {
    expect(STARTING_LEAD).toBe("tom");
  });

  it("offline cap: 8 real hours", () => {
    expect(OFFLINE_CAP).toBe(8 * 3600);
  });
});
