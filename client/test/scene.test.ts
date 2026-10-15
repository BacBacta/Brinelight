import { describe, expect, it } from "vitest";
import { cameraDistance } from "../src/scene/camera.js";
import { lighthouseScale } from "../src/scene/lighthouse.js";
import { nextQualityStep } from "../src/scene/quality.js";

describe("cameraDistance (prototype values)", () => {
  it("is 17 in landscape and 24.5 in portrait below Lighthouse level 4", () => {
    expect(cameraDistance(16 / 9, 2)).toBe(17);
    expect(cameraDistance(412 / 915, 2)).toBe(24.5);
    expect(cameraDistance(16 / 9, 3)).toBe(17);
  });

  it("switches to portrait strictly below a 0.8 ratio", () => {
    expect(cameraDistance(0.8, 2)).toBe(17);
    expect(cameraDistance(0.79, 2)).toBe(24.5);
  });

  it("moves back from Lighthouse level 4", () => {
    expect(cameraDistance(16 / 9, 4)).toBeCloseTo(17 * 1.2);
    expect(cameraDistance(0.5, 4)).toBeCloseTo(24.5 * 1.4);
    expect(cameraDistance(16 / 9, 7)).toBeCloseTo(17 * 1.2);
  });

  it("moves back again from Lighthouse level 8", () => {
    expect(cameraDistance(16 / 9, 8)).toBeCloseTo(17 * 1.35);
    expect(cameraDistance(0.5, 8)).toBeCloseTo(24.5 * 1.6);
    expect(cameraDistance(0.5, 10)).toBeCloseTo(24.5 * 1.6);
  });
});

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
