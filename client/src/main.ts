/**
 * Week 2: the city scene from the prototype (island, sea, sky, Lighthouse),
 * driven by the player's state, which produces with the shared rules and is saved locally,
 * with the 9 buildings, their sheets, the builders' queue, the top bar and the bottom menu,
 * and the sea view with its pirate camps, wrecks, fleets and combat reports.
 * The week 1 rules table stays available with ?rules.
 * The reference prototype stays playable at /prototype/.
 */
import { HOME, type BuildingId } from "@brinelight/shared";
import { createCity, type City } from "./city/index.js";
import { showRules } from "./rules.js";
import { forcedQuality, startScene, type View } from "./scene/index.js";
import { createSea, type Sea } from "./sea/index.js";
import { createFpsCounter } from "./ui/fps.js";
import { fpsWanted } from "./ui/fpsMeter.js";
import { createUi } from "./ui/index.js";
import { DEV_SPEED, SAVE_EVERY_MS, browserStore, elapse, loadGame, readReport, sail, saveGame, upgrade, type ActionResult, type PlayerState } from "./state/index.js";
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

  let city: City | null = null;
  let sea: Sea | null = null;
  const refresh = () => {
    city?.update(state);
    sea?.update(state);
    ui.update(state);
  };

  const showView = (v: View) => {
    scene.setView(v);
    document.body.classList.toggle("at-sea", v === "sea");
    city?.closeSheet();
    sea?.closeSheet();
  };
  const ui = createUi(app, showView);
  ui.update(state);

  /** An action from a sheet: applied, or refused with the reason of the shared rules in a toast. */
  const act = (r: ActionResult) => {
    if (!r.ok) {
      // The sheet shows the reason too; the toast answers the tap.
      ui.toast(r.reason, "bad", "!");
      return;
    }
    state = r.state;
    refresh();
    save();
  };
  const startUpgrade = (id: BuildingId) => act(upgrade(state, id));
  const sendFleet = (site: string) => {
    act(sail(state, site));
    sea?.closeSheet();
  };

  let fps: ReturnType<typeof createFpsCounter> | null = null;
  const scene = startScene(canvas, {
    home: HOME,
    quality: forcedQuality(location.search),
    onLoaded: (kit) => {
      status.remove();
      fps?.modelsLoaded();
      city = createCity(kit, scene, canvas, app, { state: () => state, upgrade: startUpgrade, toCity: () => ui.showView("city"), speed: DEV_SPEED });
      sea = createSea(kit, scene, canvas, app, {
        state: () => state,
        sail: sendFleet,
        readReport: () => {
          state = readReport(state);
          refresh();
          save();
        },
        soon: () => ui.toast("Coming soon", "", "~"),
        speed: DEV_SPEED,
      });
      refresh();
    },
    onError: () => (status.textContent = "Could not load the 3D models. Reload the page."),
  });

  // Measuring on a phone: ?fps shows the counter, ?quality=0|1|2 forces a quality step (docs/perf.md).
  if (fpsWanted(location.search)) fps = createFpsCounter(app, scene);

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
    const before = state;
    state = elapse(state, Math.max(0, now - last) / 1000, DEV_SPEED);
    last = now;
    showLighthouse();
    // The interface follows the state 4 times a second, and at once when an upgrade, a fleet step or a combat happens.
    const changed = state.queue.length !== before.queue.length || state.reports !== before.reports || state.fleets.map((f) => f.phase).join() !== before.fleets.map((f) => f.phase).join();
    if (now - uiAt > 250 || changed) {
      uiAt = now;
      refresh();
      if (changed) save();
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
