/**
 * The light of the city and of the sea (docs/art-direction.md, Light; week 6, task 4): a fixed, warm late afternoon. A
 * cream-to-turquoise sky, a warm, low sun with long, soft shadows, and a haze the far sea melts into. In the Mist, its
 * mood only (no rule: the Mist's mechanism comes in week 7): a grey-violet sky and fog, a light violet veil on the
 * horizon, leaden water, a dim sun, and the Lighthouse's beams sweeping, the only warm point.
 */
import * as THREE from "three";
import type { Sky } from "./sky.js";
import type { WaterOptions } from "./water.js";

export type Look = {
  /** The sky's gradient, top to horizon. */
  sky: readonly [top: string, middle: string, horizon: string];
  fog: { color: string; near: number; far: number };
  sun: { color: string; intensity: number };
  /** The light from the sky and from the ground (HemisphereLight). */
  hemi: { sky: string; ground: string; intensity: number };
  /** The violet veil on the horizon, the Lighthouse's beams, and how leaden the water is: 0 to 1. */
  veil: number;
  beams: number;
  lead: number;
};

/** The sea's mood: calm, or the Mist. Only its look: no rule depends on it. */
export type SeaMood = "calm" | "mist";

/**
 * Where the sun stands, seen from the city's center: low in the west-southwest (about 26° up), to the left of the camera
 * and a little behind it. The faces turned to the camera are lit, and the shadows fall long to the back right.
 */
export const SUN_POSITION = { x: -14, y: 8.5, z: 9.5 } as const;

/**
 * The city after the style pass (owner, after meeting 4: "a mix"): the warm, low sun of direction A,
 * golden, from the left and a little behind the camera, its shadows long and a little blue (a cool, weaker light from
 * the sky), A's contrast (less haze: no pastel veil), the sea's far side deeper but never night blue.
 */
export const CITY_STYLE: Look = {
  sky: ["#4FAFC4", "#A9DCD6", "#FFE2B4"],
  // A lighter, farther veil (owner, on the S22: it darkened the sea).
  fog: { color: "#CFEAE4", near: 60, far: 160 },
  sun: { color: "#FFB062", intensity: 4.6 },
  hemi: { sky: "#A6C2EC", ground: "#66733F", intensity: 0.74 },
  veil: 0,
  beams: 0,
  lead: 0,
};

/** The screen's exposure with CITY_STYLE (1.05 before, renderer.ts). */
export const STYLE_EXPOSURE = 1.15;

/** The city in the Mist: a uniform grey-violet sky, fog eating the far sea, a dim, cold sun (art direction). */
export const CITY_MIST: Look = {
  sky: ["#8E86B0", "#B3ADCB", "#C9C2DC"],
  fog: { color: "#B9B3D6", near: 18, far: 54 },
  sun: { color: "#D9D2E6", intensity: 1.3 },
  hemi: { sky: "#C9C2DC", ground: "#4A4F5A", intensity: 1.1 },
  veil: 1,
  beams: 1,
  lead: 1,
};

/** The sea map: the same light, seen from higher (its camera stands 40 to 80 above the water). */
export const SEA_CALM: Look = {
  sky: ["#5FB8C9", "#BFE3DA", "#FFE6BE"],
  fog: { color: "#DCE6DA", near: 55, far: 120 },
  sun: { color: "#FFC98A", intensity: 3.2 },
  hemi: { sky: "#FFE6C7", ground: "#3A6B8A", intensity: 1 },
  veil: 0,
  beams: 0,
  lead: 0,
};

/** The sea map in the Mist (its camera looks down: no horizon to veil). */
export const SEA_MIST: Look = {
  sky: ["#8E86B0", "#B3ADCB", "#C9C2DC"],
  fog: { color: "#B9B3D6", near: 42, far: 96 },
  sun: { color: "#D9D2E6", intensity: 1.2 },
  hemi: { sky: "#C9C2DC", ground: "#3E4A5C", intensity: 1.15 },
  veil: 0,
  beams: 1,
  lead: 1,
};

/** The look `t` of the way from `a` to `b` (0: a, 1: b): colors and numbers alike. */
export function mixLook(a: Look, b: Look, t: number): Look {
  const c = new THREE.Color();
  const color = (x: string, y: string) => "#" + c.set(x).lerp(new THREE.Color(y), t).getHexString().toUpperCase();
  const num = (x: number, y: number) => x + (y - x) * t;
  return {
    sky: [color(a.sky[0], b.sky[0]), color(a.sky[1], b.sky[1]), color(a.sky[2], b.sky[2])],
    fog: { color: color(a.fog.color, b.fog.color), near: num(a.fog.near, b.fog.near), far: num(a.fog.far, b.fog.far) },
    sun: { color: color(a.sun.color, b.sun.color), intensity: num(a.sun.intensity, b.sun.intensity) },
    hemi: { sky: color(a.hemi.sky, b.hemi.sky), ground: color(a.hemi.ground, b.hemi.ground), intensity: num(a.hemi.intensity, b.hemi.intensity) },
    veil: num(a.veil, b.veil),
    beams: num(a.beams, b.beams),
    lead: num(a.lead, b.lead),
  };
}

/**
 * The city's water after the style pass: B's light turquoise in the shallows along the shore and around
 * the rafts, turning to a clear blue, and a deep blue offshore, lighter than before (no night blue).
 */
export const CITY_WATER_STYLE: WaterOptions = { size: 160, near: "#2AA3CB", far: "#2A8DBC", radii: [9, 34], shallows: ["#73E2D3", "#30B5C8"], sky: ["#5FB8C9", "#BFE3DA", "#FFE6BE"] };

/** The sea map's water: one deep blue (its islands are small and many), reflecting the same sky. */
export const SEA_WATER: WaterOptions = { size: 400, near: "#1E7DBE", far: "#1E7DBE", radii: [0, 1], sky: SEA_CALM.sky };

/** The lights and the sky of a scene, which a look sets. */
export type LookParts = { scene: THREE.Scene; sky: Sky; sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight };

/** Sets a look on a scene: its sky, its fog, its sun and the light of its sky and ground. */
export function applyLook(parts: LookParts, look: Look): void {
  parts.sky.paint(look.sky);
  const fog = parts.scene.fog as THREE.Fog;
  fog.color.set(look.fog.color);
  fog.near = look.fog.near;
  fog.far = look.fog.far;
  parts.sun.color.set(look.sun.color);
  parts.sun.intensity = look.sun.intensity;
  parts.hemi.color.set(look.hemi.sky);
  parts.hemi.groundColor.set(look.hemi.ground);
  parts.hemi.intensity = look.hemi.intensity;
}

/** A scene's sky, fog and lights, set to a look; the sun at SUN_POSITION, casting shadows or not. */
export function addLook(scene: THREE.Scene, sky: Sky, look: Look, shadows: boolean): LookParts {
  scene.background = sky.texture;
  scene.fog = new THREE.Fog(look.fog.color, look.fog.near, look.fog.far);
  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.position.set(SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    // The island and its rafts, seen along the sun: ±10 covers them, the low sun's long shadows included.
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
  }
  scene.add(hemi, sun);
  const parts = { scene, sky, sun, hemi };
  applyLook(parts, look);
  return parts;
}
