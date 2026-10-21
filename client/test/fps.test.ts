import { describe, expect, it } from "vitest";
import { forcedQuality } from "../src/scene/quality.js";
import { GAP, MIN_WINDOW, WARMUP, fpsAvg, fpsFrame, fpsMin, fpsWanted, modelsLoaded, newFpsMeter, screenLine, type FpsMeter } from "../src/ui/fpsMeter.js";

/** Plays frames at `fps` from `from` for `seconds`, in one view. */
function play(m: FpsMeter, from: number, seconds: number, fps: number, view = "city"): FpsMeter {
  const n = Math.round(seconds * fps);
  for (let i = 1; i <= n; i++) m = fpsFrame(m, from + i / fps, view);
  return m;
}

describe("fps counter", () => {
  it("average of the last full second", () => {
    let m = modelsLoaded(newFpsMeter("city"), 0);
    m = fpsFrame(m, 0, "city");
    m = play(m, 0, 3, 60);
    expect(m.avg).toBeCloseTo(60, 0);
  });

  it("nothing before the first full second", () => {
    let m = fpsFrame(newFpsMeter("city"), 0, "city");
    m = play(m, 0, 0.5, 60);
    expect(m.avg).toBeNull();
    expect(fpsMin(m)).toBeNull();
  });

  it("the minimum ignores the first 5 seconds after the models load", () => {
    let m = modelsLoaded(newFpsMeter("city"), 0);
    m = fpsFrame(m, 0, "city");
    m = play(m, 0, WARMUP, 10); // slow start, ignored
    m = play(m, WARMUP, 3, 50);
    expect(fpsMin(m)).toBeCloseTo(50, 0);
  });

  it("no minimum before the models load", () => {
    let m = fpsFrame(newFpsMeter("city"), 0, "city");
    m = play(m, 0, 8, 60);
    expect(m.avg).toBeCloseTo(60, 0);
    expect(fpsMin(m)).toBeNull();
  });

  it("the minimum covers the last 10 seconds only", () => {
    let m = modelsLoaded(newFpsMeter("city"), -WARMUP);
    m = fpsFrame(m, 0, "city");
    m = play(m, 0, 2, 20); // a slow patch
    m = play(m, 2, 3, 60);
    expect(fpsMin(m)).toBeCloseTo(20, 0);
    m = play(m, 5, MIN_WINDOW + 1, 60); // the slow patch is now more than 10 s old
    expect(fpsMin(m)).toBeCloseTo(60, 0);
  });

  it("starts over after a change of view", () => {
    let m = modelsLoaded(newFpsMeter("city"), -WARMUP);
    m = fpsFrame(m, 0, "city");
    m = play(m, 0, 3, 20);
    expect(fpsMin(m)).toBeCloseTo(20, 0);
    m = fpsFrame(m, 3.01, "sea");
    expect(m.avg).toBeNull();
    expect(fpsMin(m)).toBeNull();
    m = play(m, 3.01, 3, 60, "sea");
    expect(fpsMin(m)).toBeCloseTo(60, 0);
  });

  it("starts over when you come back to the tab (a gap over 1 s)", () => {
    let m = modelsLoaded(newFpsMeter("city"), -WARMUP);
    m = fpsFrame(m, 0, "city");
    m = play(m, 0, 3, 20);
    m = fpsFrame(m, 3 + GAP + 0.5, "city"); // the tab was hidden
    expect(m.avg).toBeNull();
    expect(fpsMin(m)).toBeNull();
    m = play(m, 4.5, 3, 60);
    expect(fpsMin(m)).toBeCloseTo(60, 0);
  });

  it("a gap of exactly 1 s is still a slow frame, not a return", () => {
    let m = modelsLoaded(newFpsMeter("city"), -WARMUP);
    m = fpsFrame(m, 0, "city");
    m = play(m, 0, 2, 60);
    m = fpsFrame(m, 2 + GAP, "city");
    expect(m.avg).not.toBeNull();
    expect(fpsMin(m)!).toBeLessThan(5);
  });
});

describe("fps counter: the owner's capture (before the S22's test)", () => {
  it("the mean of the last 10 seconds, warm-up excluded, beside their minimum", () => {
    let m = modelsLoaded(newFpsMeter("city"), -WARMUP);
    m = fpsFrame(m, 0, "city");
    m = play(m, 0, 5, 30);
    m = play(m, 5, 5, 60);
    // About half at 30, half at 60 in the window (its oldest second may just have left it).
    expect(fpsAvg(m)!).toBeGreaterThan(44);
    expect(fpsAvg(m)!).toBeLessThan(48);
    expect(fpsMin(m)).toBeCloseTo(30, 0);
    m = play(m, 10, MIN_WINDOW + 1, 60);
    expect(fpsAvg(m)).toBeCloseTo(60, 0);
    expect(fpsAvg(fpsFrame(newFpsMeter("city"), 0, "city"))).toBeNull();
  });

  it("the screen's size in CSS pixels and its pixel ratio", () => {
    expect(screenLine(360, 780, 3)).toBe("360 × 780 px · ×3");
    expect(screenLine(412, 915, 2.625)).toBe("412 × 915 px · ×2.63");
  });
});

describe("URL parameters", () => {
  it("?fps shows the counter", () => {
    expect(fpsWanted("?fps")).toBe(true);
    expect(fpsWanted("?quality=1&fps")).toBe(true);
    expect(fpsWanted("")).toBe(false);
  });

  it("?quality=0, 1 or 2 forces a step; anything else leaves the automatic tuning", () => {
    expect(forcedQuality("?quality=0")).toBe(0);
    expect(forcedQuality("?fps&quality=2")).toBe(2);
    expect(forcedQuality("?quality=3")).toBeNull();
    expect(forcedQuality("?quality=")).toBeNull();
    expect(forcedQuality("")).toBeNull();
  });
});
