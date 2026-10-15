/**
 * Week 2: the city scene from the prototype (island, sea, sky, Lighthouse),
 * driven by the player's state, which produces with the shared rules and is saved locally,
 * with the 9 buildings, their sheets, the builders' queue, the top bar and the bottom menu.
 * The week 1 rules table stays available with ?rules.
 * The reference prototype stays playable at /prototype/.
 */
import type { BuildingId } from "@brinelight/shared";
import { createCity, type City } from "./city/index.js";
import { showRules } from "./rules.js";
import { startScene } from "./scene/index.js";
import { createUi } from "./ui/index.js";
import { DEV_SPEED, SAVE_EVERY_MS, browserStore, elapse, loadGame, saveGame, upgrade, type PlayerState } from "./state/index.js";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

if (new URLSearchParams(location.search).has("rules")) {
  showRules(app);
} else {
  document.body.classList.add("scene");
  app.innerHTML = `<canvas id="cv" aria-label="3D view of your city"></canvas><p class="loading" role="status">Loading your city…</p>`;
  const status = app.querySelector<HTMLParagraphElement>(".loading")!;
  const canvas = app.querySelector<HTMLCanvasElement>("#cv")!;

  const store = browserStore();
  let state: PlayerState = loadGame(store, Date.now());
  const save = () => saveGame(store, state, Date.now());

  const ui = createUi(app);
  ui.update(state);

  let city: City | null = null;
  const startUpgrade = (id: BuildingId) => {
    const r = upgrade(state, id);
    if (!r.ok) {
      // The sheet shows the reason too; the toast answers the tap.
      ui.toast(r.reason, "bad", "!");
      return;
    }
    state = r.state;
    city?.update(state);
    ui.update(state);
    save();
  };

  const scene = startScene(canvas, {
    onLoaded: (kit) => {
      status.remove();
      city = createCity(kit, scene, canvas, app, { state: () => state, upgrade: startUpgrade, speed: DEV_SPEED });
      city.update(state);
    },
    onError: () => (status.textContent = "Could not load the 3D models. Reload the page."),
  });

  let shownLevel = -1;
  const showLighthouse = () => {
    if (state.buildings.lighthouse === shownLevel) return;
    shownLevel = state.buildings.lighthouse;
    scene.setLighthouseLevel(shownLevel);
  };
  showLighthouse();

  let last = performance.now();
  let frame = 0;
  let uiAt = 0;
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    const before = state.queue.length;
    state = elapse(state, Math.max(0, now - last) / 1000, DEV_SPEED);
    last = now;
    showLighthouse();
    // The interface follows the state 4 times a second, and at once when an upgrade ends.
    if (now - uiAt > 250 || state.queue.length !== before) {
      uiAt = now;
      city?.update(state);
      ui.update(state);
      if (state.queue.length !== before) save();
    }
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
