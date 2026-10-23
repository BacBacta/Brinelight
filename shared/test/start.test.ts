import { describe, expect, it } from "vitest";
import { STARTING_CAPTAIN, STARTING_LEAD, STARTING_MORALE, STARTING_PEARLS, STARTING_STOCK, STARTING_SURVIVORS, STARTING_TROOPS, advance, newPlayerState, parseState } from "../src/index.js";

describe("starting values (prototype)", () => {
  it("stock: 1,400 oil, 800 fish, 2,000 wood, 3 rope (the richer start, owner's decision of 23 October; was 380, 420, 520)", () => {
    expect(STARTING_STOCK).toEqual({ oil: 1400, fish: 800, wood: 2000, rope: 3 });
  });

  it("only a new city gets the richer start: a stored city keeps its own stock, and its job under way its own time", () => {
    expect(newPlayerState().stock).toEqual(STARTING_STOCK);
    const stored = { ...newPlayerState(), stock: { oil: 380, fish: 420, wood: 520, rope: 3 }, queue: [{ id: "fishery" as const, left: 3240, duration: 3240 }] };
    const read = parseState(JSON.parse(JSON.stringify(stored)))!;
    expect(read.stock).toEqual(stored.stock);
    expect(read.queue).toEqual(stored.queue);
    // The Fishery's level 2 started before the update (54 min) ends at its own time, not at the quick one (1 min).
    expect(advance(read, 60).queue).toEqual([{ id: "fishery", left: 3180, duration: 3240 }]);
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
});
