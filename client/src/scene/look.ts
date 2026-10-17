/**
 * The light of the city and of the sea (docs/art-direction.md, Light; week 6, task 4): a fixed, warm late afternoon. A
 * cream-to-turquoise sky, a warm, low sun with long, soft shadows, and a haze the far sea melts into.
 */
import * as THREE from "three";
import type { Sky } from "./sky.js";

export type Look = {
  /** The sky's gradient, top to horizon. */
  sky: readonly [top: string, middle: string, horizon: string];
  fog: { color: string; near: number; far: number };
  sun: { color: string; intensity: number };
  /** The light from the sky and from the ground (HemisphereLight). */
  hemi: { sky: string; ground: string; intensity: number };
};

/**
 * Where the sun stands, seen from the city's center: low in the west-southwest (about 26° up), to the left of the camera
 * and a little behind it. The faces turned to the camera are lit, and the shadows fall long to the back right.
 */
export const SUN_POSITION = { x: -14, y: 8.5, z: 9.5 } as const;

/** The city: the camera stands 25 to 40 from the island, and the haze starts behind it. */
export const CITY_CALM: Look = {
  sky: ["#5FB8C9", "#BFE3DA", "#FFE6BE"],
  fog: { color: "#DCE6DA", near: 32, far: 80 },
  sun: { color: "#FFC98A", intensity: 3.6 },
  hemi: { sky: "#FFE6C7", ground: "#4F6B3A", intensity: 0.85 },
};

/** The sea map: the same light, seen from higher (its camera stands 40 to 80 above the water). */
export const SEA_CALM: Look = {
  sky: ["#5FB8C9", "#BFE3DA", "#FFE6BE"],
  fog: { color: "#DCE6DA", near: 55, far: 120 },
  sun: { color: "#FFC98A", intensity: 3.2 },
  hemi: { sky: "#FFE6C7", ground: "#3A6B8A", intensity: 1 },
};

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
