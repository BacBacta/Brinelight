import { describe, expect, it } from "vitest";
import { night as N } from "@brinelight/shared";
import { NIGHT_REACH, bearingOf, seaToWorld } from "../src/night/view.js";

const coast = () => 5;

describe("the Night on the island's sea", () => {
  it("0° is north (up the screen, −z), 90° east (+x), clockwise", () => {
    const n = seaToWorld(0, 20, coast);
    expect(n.x).toBeCloseTo(0, 9);
    expect(n.z).toBeLessThan(0);
    const e = seaToWorld(90, 20, coast);
    expect(e.x).toBeGreaterThan(0);
    expect(e.z).toBeCloseTo(0, 9);
    expect(seaToWorld(180, 20, coast).z).toBeGreaterThan(0);
  });

  it("the rules' coast is the island's coast; the edge of the sea is the Night's reach", () => {
    const at = (d: number) => Math.hypot(seaToWorld(30, d, coast).x, seaToWorld(30, d, coast).z);
    expect(at(N.COAST_RADIUS)).toBeCloseTo(5, 9);
    expect(at(N.SEA_RADIUS)).toBeCloseTo(NIGHT_REACH, 9);
    expect(at(18)).toBeGreaterThan(at(12));
  });

  it("a point on the water gives its bearing back", () => {
    for (const b of [0, 45, 90, 179, 270, 359]) {
      const p = seaToWorld(b, 20, coast);
      expect(bearingOf(p.x, p.z)).toBeCloseTo(b, 6);
    }
    expect(bearingOf(0, 0)).toBe(null);
  });
});
