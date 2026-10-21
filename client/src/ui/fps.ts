import type { SceneHandle } from "../scene/index.js";
import { MIN_WINDOW, fpsAvg, fpsFrame, fpsMin, modelsLoaded, newFpsMeter, screenLine } from "./fpsMeter.js";
import { landClock } from "../city/land/index.js";

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
  // Each frame's time over the last 10 s: a hitch is one frame much longer than the others.
  const frames: [number, number][] = [];
  let last = 0;
  const longest = () => frames.reduce((m, [, d]) => Math.max(m, d), 0);

  scene.onFrame((_now, view) => {
    const t = performance.now() / 1000;
    if (last) frames.push([t, (t - last) * 1000]);
    last = t;
    while (frames.length && frames[0]![0] < t - MIN_WINDOW) frames.shift();
    meter = fpsFrame(meter, t, view);
    if (t - shownAt < 1) return;
    shownAt = t;
    const s = scene.stats();
    el.textContent =
      `${round(meter.avg)} FPS · ${MIN_WINDOW} s: min ${round(fpsMin(meter))} · mean ${round(fpsAvg(meter))}\n` +
      `Quality ${s.step} ${s.forced ? "forced" : "auto"} · ${VIEW_NAMES[view]}${s.mood === "mist" ? " · Mist" : ""}\n` +
      `${screenLine(innerWidth, innerHeight, devicePixelRatio || 1)}\n` +
      `${s.calls} calls · ${(s.triangles / 1000).toFixed(1)} k tris${s.post ? ` · finish +${s.post}` : ""}` +
    // The longest frame of the last 10 s; the land won on the sea's last rebuild: built aside (the display goes on),
    // then put in place on the display's thread (owner, to read on the S22).
    `\nLongest frame ${longest().toFixed(1)} ms` +
    (landClock.last !== null ? `\nLand built in ${landClock.last.aside.toFixed(1)} ms aside, shown in ${landClock.last.shown.toFixed(1)} ms` : "");
  });

  return {
    /** Starts the warm-up: the minimum ignores the first seconds after the models load. */
    modelsLoaded() {
      meter = modelsLoaded(meter, performance.now() / 1000);
    },
  };
}
