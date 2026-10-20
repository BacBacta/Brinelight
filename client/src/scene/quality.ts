import type * as THREE from "three";
import type { Water } from "./water.js";

/** 0: full quality. 1: pixel ratio 1, smaller shadows. 2: no shadows, plain water. */
export type QualityStep = 0 | 1 | 2;

/**
 * What each step keeps, to hold 30 FPS on an entry-level phone (week 6, task 4): the screen's pixel density, the
 * shadows' map (0: none), and the water's sky reflection, small ripples, moving foam and grid; with ?blender, the city's
 * finish too (post.ts: the lamps' glow and the color grade), at full quality only.
 */
export const QUALITY_STEPS: Record<
  QualityStep,
  { maxPixelRatio: number; shadowMap: number; reflections: boolean; ripples: boolean; foamMoves: boolean; waterSegments: number; finish: boolean }
> = {
  0: { maxPixelRatio: 2, shadowMap: 2048, reflections: true, ripples: true, foamMoves: true, waterSegments: 96, finish: true },
  1: { maxPixelRatio: 1, shadowMap: 1024, reflections: true, ripples: true, foamMoves: true, waterSegments: 96, finish: false },
  2: { maxPixelRatio: 1, shadowMap: 0, reflections: false, ripples: false, foamMoves: false, waterSegments: 48, finish: false },
};

export const QUALITY_MIN_FPS = 30;
/** Length of one frame-rate measurement, in seconds. */
export const QUALITY_WINDOW = 3;

/** Lowers quality by one step when the frame rate falls under 30, never below step 2. */
export function nextQualityStep(fps: number, step: QualityStep): QualityStep {
  if (step >= 2 || fps >= QUALITY_MIN_FPS) return step;
  return (step + 1) as QualityStep;
}

export function applyQualityStep(renderer: THREE.WebGLRenderer, sun: THREE.DirectionalLight, step: QualityStep, waters: readonly Water[]): void {
  const s = QUALITY_STEPS[step];
  renderer.setPixelRatio(Math.min(s.maxPixelRatio, devicePixelRatio || 1));
  renderer.shadowMap.enabled = s.shadowMap > 0;
  sun.castShadow = s.shadowMap > 0;
  if (s.shadowMap > 0 && sun.shadow.mapSize.x !== s.shadowMap) {
    sun.shadow.mapSize.set(s.shadowMap, s.shadowMap);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  for (const w of waters) w.setQuality(s);
}

/** Counts frames over 3 s windows and returns the new step when it changes, as in the prototype. */
export function createQualityMonitor() {
  let frames = 0;
  let time = 0;
  let step: QualityStep = 0;
  return {
    tick(dt: number): QualityStep | null {
      if (step >= 2) return null;
      frames++;
      time += dt;
      if (time <= QUALITY_WINDOW) return null;
      const next = nextQualityStep(frames / time, step);
      frames = 0;
      time = 0;
      if (next === step) return null;
      step = next;
      return step;
    },
  };
}

/** A quality step forced with ?quality=0, 1 or 2 in the URL, to compare steps on the same phone; null otherwise. */
export function forcedQuality(search: string): QualityStep | null {
  const v = new URLSearchParams(search).get("quality");
  return v === "0" || v === "1" || v === "2" ? (Number(v) as QualityStep) : null;
}
