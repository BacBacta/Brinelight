import type { BuildingId } from "@brinelight/shared";
import type { Kit, SceneHandle } from "../scene/index.js";
import type { PlayerState } from "../state/index.js";
import { createCityBuildings } from "./buildings.js";
import { createLabels } from "./labels.js";
import { createQueue } from "./queue.js";
import { createSheet } from "./sheet.js";
import "./city.css";

export type City = {
  /** Shows the state: models, labels, queue and open sheet. */
  update(state: PlayerState): void;
};

/** The 9 buildings on their plots, their labels, their sheets and the builders' queue. */
export function createCity(
  kit: Kit,
  scene: SceneHandle,
  canvas: HTMLCanvasElement,
  root: HTMLElement,
  game: { state(): PlayerState; upgrade(id: BuildingId): void; speed: number },
): City {
  const buildings = createCityBuildings(kit, (o) => scene.add(o));
  const labels = createLabels(root, scene);
  const queue = createQueue(root);
  const sheet = createSheet(root, {
    upgrade: (id) => game.upgrade(id),
    close: () => {
      sheet.close();
      buildings.select(null);
    },
  });

  scene.onFrame((now) => {
    buildings.animate(now);
    labels.place();
  });

  // A tap opens a sheet; a drag turns the camera and opens nothing.
  let down: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener("pointerup", (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8;
    down = null;
    if (moved) return;
    const hit = scene.pick(e.clientX, e.clientY, buildings.hits)[0];
    const id = hit?.object.userData.building as BuildingId | undefined;
    if (id) {
      sheet.open(id, game.state(), game.speed);
      buildings.select(id);
    } else {
      sheet.close();
      buildings.select(null);
    }
  });

  return {
    update(state) {
      buildings.refresh(state);
      labels.update(state);
      queue.update(state, game.speed);
      sheet.update(state, game.speed);
    },
  };
}
