import { describe, expect, it } from "vitest";
import { night as N } from "@brinelight/shared";
import { burnedBetween } from "../src/night/effects.js";

const e = (id: number, distance: number, bearing = 0): N.Enemy => ({ id, family: "raider", bearing, distance, health: 10, lit: 0, fade: 0, stage: 0 });

describe("the Night's effects", () => {
  it("an enemy gone far from the coast was burned: a burst where it was; one gone on the coast landed: none", () => {
    const before = [e(1, 20, 90), e(2, N.COAST_RADIUS + 0.05, 180), e(3, 15)];
    const after = [e(3, 14.9)];
    expect(burnedBetween(before, after)).toEqual([{ bearing: 90, distance: 20 }]);
    expect(burnedBetween([], after)).toEqual([]);
  });
});
