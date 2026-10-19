import { describe, expect, it } from "vitest";
import { lighthouseScale } from "../src/scene/lighthouse.js";
import { nextQualityStep } from "../src/scene/quality.js";

describe("nextQualityStep (prototype values)", () => {
  it("keeps the step at 30 FPS or more", () => {
    expect(nextQualityStep(60, 0)).toBe(0);
    expect(nextQualityStep(30, 0)).toBe(0);
    expect(nextQualityStep(30, 1)).toBe(1);
  });

  it("lowers quality by one step under 30 FPS", () => {
    expect(nextQualityStep(29.9, 0)).toBe(1);
    expect(nextQualityStep(12, 1)).toBe(2);
  });

  it("never goes past step 2", () => {
    expect(nextQualityStep(5, 2)).toBe(2);
  });
});

describe("lighthouseScale (prototype values)", () => {
  it("grows with the level up to 1.25", () => {
    expect(lighthouseScale(2)).toBeCloseTo(0.91);
    expect(lighthouseScale(10)).toBe(1.25);
  });
});
