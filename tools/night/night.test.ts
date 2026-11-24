import { describe, expect, it } from "vitest";
import { aim, playNight, still, summarize, toTable } from "./simulate.js";

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe("the Night's simulator", () => {
  it("plays the same Night the same way", () => {
    expect(playNight(2, 9, aim)).toEqual(playNight(2, 9, aim));
  });

  it("a beam left still loses every Night, Night 1 never before its third wave", () => {
    for (let night = 1; night <= 5; night++)
      for (const seed of SEEDS) {
        const r = playNight(night, seed, still);
        expect(r.won, `Night ${night}, seed ${seed}`).toBe(false);
        if (night === 1) expect(r.wave).toBeGreaterThan(2);
      }
  });

  it("a perfect aim wins Night 1 on every seed", () => {
    for (const seed of SEEDS) expect(playNight(1, seed, aim).won, `seed ${seed}`).toBe(true);
  });

  it("sums up each Night and bot as a table", () => {
    const rows = summarize([1, 2], [still, aim]);
    expect(rows).toHaveLength(10);
    expect(toTable(rows).split("\n")).toHaveLength(12);
  });
});
