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

describe("the hand on the beam", () => {
  it("a point of the screen gives the bearing of the water under it", async () => {
    const THREE = await import("three");
    const { pointerBearing } = await import("../src/night/view.js");
    // A camera high above the Lighthouse, looking straight down, north up the screen.
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 20, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const rect = { left: 0, top: 0, width: 400, height: 400 };
    expect(pointerBearing(200, 50, rect, camera, 0)).toBeCloseTo(0, 3);
    expect(pointerBearing(350, 200, rect, camera, 0)).toBeCloseTo(90, 3);
    expect(pointerBearing(200, 350, rect, camera, 0)).toBeCloseTo(180, 3);
    expect(pointerBearing(50, 200, rect, camera, 0)).toBeCloseTo(270, 3);
    // Right on the Lighthouse: no bearing.
    expect(pointerBearing(200, 200, rect, camera, 0)).toBe(null);
  });

  it("the keys turn the beam at their speed, either way, round past north", async () => {
    const { KEY_TURN, turnBy } = await import("../src/night/view.js");
    expect(turnBy(0, 1, 0.5)).toBeCloseTo(KEY_TURN / 2, 9);
    expect(turnBy(10, -1, 1 / KEY_TURN * 20)).toBeCloseTo(350, 9);
    expect(turnBy(350, 1, 1 / KEY_TURN * 20)).toBeCloseTo(10, 9);
    expect(turnBy(90, 0, 1)).toBe(90);
  });
});
