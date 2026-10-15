/**
 * Week 2: the city scene from the prototype (island, sea, sky, Lighthouse),
 * driven by the player's state, which produces with the shared rules and is saved locally.
 * The week 1 rules table stays available with ?rules.
 * The reference prototype stays playable at /prototype/.
 */
import { showRules } from "./rules.js";
import { startScene } from "./scene/index.js";
import { DEV_SPEED, SAVE_EVERY_MS, browserStore, loadGame, saveGame, tick, type PlayerState } from "./state/index.js";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

if (new URLSearchParams(location.search).has("rules")) {
  showRules(app);
} else {
  document.body.classList.add("scene");
  app.innerHTML = `<canvas id="cv" aria-label="3D view of your city"></canvas><p class="loading" role="status">Loading your city…</p>`;
  const status = app.querySelector<HTMLParagraphElement>(".loading")!;
  const scene = startScene(app.querySelector<HTMLCanvasElement>("#cv")!, {
    onLoaded: () => status.remove(),
    onError: () => (status.textContent = "Could not load the 3D models. Reload the page."),
  });

  const store = browserStore();
  let state: PlayerState = loadGame(store, Date.now());
  const save = () => saveGame(store, state, Date.now());

  let shownLevel = -1;
  const showLighthouse = () => {
    if (state.buildings.lighthouse === shownLevel) return;
    shownLevel = state.buildings.lighthouse;
    scene.setLighthouseLevel(shownLevel);
  };
  showLighthouse();

  let last = performance.now();
  let frame = 0;
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    state = tick(state, Math.max(0, now - last) / 1000, DEV_SPEED);
    last = now;
    showLighthouse();
  };
  frame = requestAnimationFrame(loop);

  const saveTimer = setInterval(save, SAVE_EVERY_MS);
  const onHide = () => document.visibilityState === "hidden" && save();
  document.addEventListener("visibilitychange", onHide);
  addEventListener("pagehide", save);

  if (import.meta.env.DEV) Object.defineProperty(window, "__state", { get: () => state, configurable: true });

  import.meta.hot?.dispose(() => {
    save();
    cancelAnimationFrame(frame);
    clearInterval(saveTimer);
    document.removeEventListener("visibilitychange", onHide);
    removeEventListener("pagehide", save);
    scene.dispose();
  });
}
