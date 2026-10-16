import type { BuildingId, TechId, TroopType } from "@brinelight/shared";
import type { Kit, SceneHandle } from "../scene/index.js";
import type { PlayerState } from "../state/index.js";
import { createCityBuildings } from "./buildings.js";
import { createLabels } from "./labels.js";
import { createQueue } from "./queue.js";
import { createRaftSheet } from "./raftSheet.js";
import { createCityRafts } from "./rafts.js";
import { createSheet } from "./sheet.js";

export type City = {
  /** Shows the state: models, labels, queue and open sheet. */
  update(state: PlayerState): void;
  /** Closes the open sheet, when you leave the city. */
  closeSheet(): void;
};

/** The 9 buildings on their plots, the raft slots around the island, their labels, their sheets and the queue. */
export function createCity(
  kit: Kit,
  scene: SceneHandle,
  canvas: HTMLCanvasElement,
  root: HTMLElement,
  game: {
    state(): PlayerState;
    upgrade(id: BuildingId): void;
    research(tech: TechId): void;
    train(troop: TroopType): void;
    dockRaft(slot: string): void;
    toCity(): void;
    /** How much faster than real time the city runs: the server's speed when signed in. */
    speed(): number;
  },
): City {
  const buildings = createCityBuildings(kit, (o) => scene.add(o));
  const rafts = createCityRafts(kit, (o) => scene.add(o));
  const labels = createLabels(root, scene);
  const queue = createQueue(root, () => game.toCity());
  const sheet = createSheet(root, {
    upgrade: (id) => game.upgrade(id),
    research: (tech) => game.research(tech),
    train: (troop) => game.train(troop),
    close: () => {
      sheet.close();
      buildings.select(null);
    },
  });
  const raftSheet = createRaftSheet(root, { dock: (slot) => game.dockRaft(slot), close: () => raftSheet.close() });

  scene.onFrame((now, view) => {
    if (view !== "city") return;
    buildings.animate(now);
    rafts.animate(now);
    labels.place(sheet.current);
  });

  // A tap opens a sheet; a drag turns the camera and opens nothing.
  let down: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener("pointerup", (e) => {
    if (!down || scene.view !== "city") return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8;
    down = null;
    if (moved) return;
    // The nearest shape wins: a building, or a raft slot.
    const hit = scene.pick(e.clientX, e.clientY, [...buildings.hits, ...rafts.hits])[0];
    const id = hit?.object.userData.building as BuildingId | undefined;
    const slot = hit ? rafts.slotOf(hit) : null;
    sheet.close();
    raftSheet.close();
    buildings.select(null);
    if (id) {
      sheet.open(id, game.state(), game.speed());
      buildings.select(id);
    } else if (slot) {
      raftSheet.open(slot, game.state(), game.speed());
    }
  });

  return {
    closeSheet() {
      sheet.close();
      raftSheet.close();
      buildings.select(null);
    },
    update(state) {
      buildings.refresh(state);
      rafts.refresh(state);
      raftSheet.update(state, game.speed());
      labels.update(state);
      queue.update(state, game.speed());
      sheet.update(state, game.speed());
    },
  };
}
