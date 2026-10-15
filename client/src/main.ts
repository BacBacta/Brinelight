/**
 * Week 2: the city scene from the prototype (island, sea, sky, Lighthouse).
 * The week 1 rules table stays available with ?rules.
 * The reference prototype stays playable at /prototype/.
 */
import { STARTING_BUILDINGS } from "@brinelight/shared";
import { showRules } from "./rules.js";
import { startScene } from "./scene/index.js";
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
  // Starting level from the shared rules, until the game state arrives (task 2).
  scene.setLighthouseLevel(STARTING_BUILDINGS.lighthouse);
  import.meta.hot?.dispose(() => scene.dispose());
}
