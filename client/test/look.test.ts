import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CITY_CALM, CITY_MIST, SEA_CALM, SEA_MIST, SUN_POSITION, addLook, mixLook, type Look } from "../src/scene/look.js";
import { createLighthouse } from "../src/scene/lighthouse.js";
import { createVeil } from "../src/scene/veil.js";
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

describe("the Mist's mood (its look only)", () => {
  it("grey-violet, its fog closer, its veil, beams and leaden water fully there; none of them in calm weather", () => {
    expect([CITY_CALM.veil, CITY_CALM.beams, CITY_CALM.lead]).toEqual([0, 0, 0]);
    expect([CITY_MIST.veil, CITY_MIST.beams, CITY_MIST.lead]).toEqual([1, 1, 1]);
    // At sea the camera looks down: no horizon to veil.
    expect([SEA_MIST.veil, SEA_MIST.beams, SEA_MIST.lead]).toEqual([0, 1, 1]);
    for (const look of [CITY_MIST, SEA_MIST]) {
      const fog = new THREE.Color(look.fog.color);
      expect(fog.b).toBeGreaterThan(fog.g);
      expect(look.sun.intensity).toBeLessThan(CITY_CALM.sun.intensity / 2);
    }
    // "Fog eats the sea from 20 m away" (docs/art-direction.md).
    expect(CITY_MIST.fog.near).toBeLessThanOrEqual(20);
  });

  it("a fade from one to the other: colors and numbers, from the first to the second", () => {
    expect(mixLook(CITY_CALM, CITY_MIST, 0)).toEqual({ ...CITY_CALM, sky: CITY_CALM.sky.map((c) => c.toUpperCase()), fog: { ...CITY_CALM.fog, color: CITY_CALM.fog.color.toUpperCase() }, sun: { ...CITY_CALM.sun, color: CITY_CALM.sun.color.toUpperCase() }, hemi: { ...CITY_CALM.hemi, sky: CITY_CALM.hemi.sky.toUpperCase(), ground: CITY_CALM.hemi.ground.toUpperCase() } });
    const end = mixLook(CITY_CALM, CITY_MIST, 1);
    expect([end.fog.color, end.sky[2], end.veil, end.lead]).toEqual([CITY_MIST.fog.color, CITY_MIST.sky[2], 1, 1]);
    const half = mixLook(CITY_CALM, CITY_MIST, 0.5);
    expect(half.fog.near).toBe((CITY_CALM.fog.near + CITY_MIST.fog.near) / 2);
    expect(half.beams).toBe(0.5);
  });

  it("the Lighthouse's beams: hidden until the Mist", () => {
    const lh = createLighthouse();
    const beams = () => {
      const out: boolean[] = [];
      lh.group.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m && m.blending === THREE.AdditiveBlending) out.push(o.parent!.visible);
      });
      return out;
    };
    expect(beams()).toEqual([false, false]);
    lh.setBeams(1);
    expect(beams()).toEqual([true, true]);
    lh.setBeams(0);
    expect(beams()).toEqual([false, false]);
  });

  it("the veil on the horizon: not drawn in calm weather", () => {
    const veil = createVeil();
    expect(veil.mesh.visible).toBe(false);
    veil.set(0.6);
    expect(veil.mesh.visible).toBe(true);
    expect((veil.mesh.material as THREE.MeshBasicMaterial).opacity).toBe(0.6);
    expect((veil.mesh.material as THREE.MeshBasicMaterial).fog).toBe(false);
    veil.set(0);
    expect(veil.mesh.visible).toBe(false);
  });
});
