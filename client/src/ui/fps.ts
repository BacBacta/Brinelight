import type { SceneHandle } from "../scene/index.js";
import { MIN_WINDOW, fpsAvg, fpsFrame, fpsMin, modelsLoaded, newFpsMeter, screenLine } from "./fpsMeter.js";

const VIEW_NAMES = { city: "City", sea: "Sea" } as const;

/**
 * The ?fps counter: a small box in the bottom left corner, just above the bottom menu, refreshed every second. It catches no tap.
 * One capture of it tells everything (owner, before the S22's test): the frame rate now, the minimum and the mean of the
 * last 10 seconds, the quality step, the screen's size and pixel ratio, the draw calls and triangles.
 */
export function createFpsCounter(root: HTMLElement, scene: SceneHandle) {
  const el = document.createElement("div");
  el.className = "fps";
  el.setAttribute("aria-hidden", "true");
  root.appendChild(el);
  let meter = newFpsMeter(scene.view);
  let shownAt = 0;
  const round = (v: number | null) => (v === null ? "–" : v.toFixed(0));

  scene.onFrame((_now, view) => {
    const t = performance.now() / 1000;
    meter = fpsFrame(meter, t, view);
    if (t - shownAt < 1) return;
    shownAt = t;
    const s = scene.stats();
    el.textContent =
      `${round(meter.avg)} FPS · ${MIN_WINDOW} s: min ${round(fpsMin(meter))} · mean ${round(fpsAvg(meter))}\n` +
      `Quality ${s.step} ${s.forced ? "forced" : "auto"} · ${VIEW_NAMES[view]}${s.mood === "mist" ? " · Mist" : ""}\n` +
      `${screenLine(innerWidth, innerHeight, devicePixelRatio || 1)}\n` +
      `${s.calls} calls · ${(s.triangles / 1000).toFixed(1)} k tris${s.post ? ` · finish +${s.post}` : ""}`;
  });

  return {
    /** Starts the warm-up: the minimum ignores the first seconds after the models load. */
    modelsLoaded() {
      meter = modelsLoaded(meter, performance.now() / 1000);
    },
  };
}
