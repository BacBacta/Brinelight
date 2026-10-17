import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CITY_CALM, SEA_CALM, SUN_POSITION, addLook, type Look } from "../src/scene/look.js";
import type { Sky } from "../src/scene/sky.js";

/** A sky that keeps what it was painted with (the real one draws on a canvas). */
const fakeSky = () => {
  const painted: (readonly string[])[] = [];
  const sky: Sky = { texture: new THREE.CanvasTexture(null as unknown as HTMLCanvasElement), paint: (c) => void painted.push(c) };
  return { sky, painted };
};
const warmth = (hex: string) => {
  const c = new THREE.Color(hex);
  return c.r - c.b;
};

describe("the late afternoon's light", () => {
  it("a low sun in the west-southwest, to the camera's left (the camera looks from +z)", () => {
    const { x, y, z } = SUN_POSITION;
    const up = (Math.atan2(y, Math.hypot(x, z)) * 180) / Math.PI;
    expect(up).toBeGreaterThan(20);
    expect(up).toBeLessThan(30);
    expect(x).toBeLessThan(0);
    expect(z).toBeGreaterThan(0);
  });

  it("warm: a cream horizon under a turquoise top, a warm sun and a warm sky light, in the city as at sea", () => {
    for (const look of [CITY_CALM, SEA_CALM] as Look[]) {
      expect(warmth(look.sky[2])).toBeGreaterThan(0.1);
      expect(warmth(look.sky[0])).toBeLessThan(0);
      expect(warmth(look.sun.color)).toBeGreaterThan(0.3);
      expect(warmth(look.hemi.sky)).toBeGreaterThan(0.1);
      expect(look.fog.near).toBeLessThan(look.fog.far);
    }
    // The haze starts behind the island: the city's camera stands 25 to 40 from it.
    expect(CITY_CALM.fog.near).toBeGreaterThan(30);
  });

  it("set on a scene: its sky, fog, sun casting soft shadows, and the light of its sky and ground", () => {
    const scene = new THREE.Scene();
    const { sky, painted } = fakeSky();
    const { sun, hemi } = addLook(scene, sky, CITY_CALM, true);
    expect(painted).toEqual([CITY_CALM.sky]);
    expect(scene.background).toBe(sky.texture);
    const fog = scene.fog as THREE.Fog;
    expect([fog.near, fog.far, "#" + fog.color.getHexString()]).toEqual([32, 80, CITY_CALM.fog.color.toLowerCase()]);
    expect(sun.castShadow).toBe(true);
    expect(sun.position.toArray()).toEqual([SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z]);
    expect(sun.intensity).toBe(CITY_CALM.sun.intensity);
    expect(hemi.intensity).toBe(CITY_CALM.hemi.intensity);
    // At sea, no shadows.
    expect(addLook(new THREE.Scene(), fakeSky().sky, SEA_CALM, false).sun.castShadow).toBe(false);
  });
});
