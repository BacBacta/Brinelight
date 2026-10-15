import type * as THREE from "three";

/** 0: full quality. 1: pixel ratio 1. 2: no shadows either. */
export type QualityStep = 0 | 1 | 2;

export const QUALITY_MIN_FPS = 30;
/** Length of one frame-rate measurement, in seconds. */
export const QUALITY_WINDOW = 3;

/** Lowers quality by one step when the frame rate falls under 30, never below step 2. */
export function nextQualityStep(fps: number, step: QualityStep): QualityStep {
  if (step >= 2 || fps >= QUALITY_MIN_FPS) return step;
  return (step + 1) as QualityStep;
}

export function applyQualityStep(renderer: THREE.WebGLRenderer, sun: THREE.DirectionalLight, step: QualityStep): void {
  if (step >= 1) renderer.setPixelRatio(1);
  if (step >= 2) {
    renderer.shadowMap.enabled = false;
    sun.castShadow = false;
  }
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
