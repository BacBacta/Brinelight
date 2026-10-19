import type { BuildingId, RaftBuildingId, TechId, TroopType } from "@brinelight/shared";
import { lighthouseScale, type BuildingModels, type Kit, type Models, type RaftBuildingModels, type SceneHandle } from "../scene/index.js";
import type { PlayerState } from "../state/index.js";
import { coastAt } from "../scene/coast.js";
import { createCityBuildings, plotPosition } from "./buildings.js";
import { createLabels } from "./labels.js";
import { createQueue } from "./queue.js";
import { createRaftSheet } from "./raftSheet.js";
import { RAFT_FILL, createCityRafts, raftSlots, slotPosition } from "./rafts.js";
import { createSheet } from "./sheet.js";
import { blenderLook } from "../scene/cityLook.js";
import { isStaged, lanternHeight, levelShape, loadStage, showLevel, stageName } from "./staged.js";

export type City = {
  /** Shows the state: models, labels, queue and open sheet. */
  update(state: PlayerState): void;
  /** Closes the open sheet, when you leave the city. */
  closeSheet(): void;
  /** The buildings on rafts, once loaded after the city shows. */
  useRaftBuildings(models: RaftBuildingModels): void;
};

/** The panels a city label never goes under: the top bar and its rows, the rail, the quest card, the open sheet, the tab bar. */
const PANELS = ".hud > *, .sub > *, .rail, .quest, .sheet, .nav, .queue";
function panelRects() {
  const out: { left: number; right: number; top: number; bottom: number }[] = [];
  for (const el of document.querySelectorAll(PANELS)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) out.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
  }
  return out;
}

/** Height of a building's label above its model's top. */
const LABEL_GAP = 0.25;

/** The 9 buildings on their plots, the raft slots around the island, their labels, their sheets and the queue. */
export function createCity(
  kit: Kit,
  models: BuildingModels,
  others: Models,
  scene: SceneHandle,
  canvas: HTMLCanvasElement,
  root: HTMLElement,
  game: {
    state(): PlayerState;
    upgrade(id: BuildingId): void;
    research(tech: TechId): void;
    train(troop: TroopType): void;
    promote(troop: TroopType): void;
    heal(): void;
    stoke(on: boolean): void;
    dockRaft(slot: string): void;
    installOnRaft(slot: string, building: RaftBuildingId): void;
    upgradeRaft(slot: string): void;
    repairRafts(): void;
    toCity(): void;
    /** How much faster than real time the city runs: the server's speed when signed in. */
    speed(): number;
  },
): City {
  const buildings = createCityBuildings(kit, models, (o) => scene.add(o));
  const rafts = createCityRafts(kit, others.raft, (o) => scene.add(o), coastAt);
  // Labels float just above each model at its full size (a smaller tier leaves them where they were, so they keep their
  // places among the others); the Lighthouse's grows with its level.
  const staged = (id: BuildingId) => blenderLook() && isStaged(id);
  const labels = createLabels(root, scene, (id, levels) =>
    staged(id)
      ? levelShape(id, Math.max(1, levels[id])).height + LABEL_GAP
      : id === "lighthouse"
        ? (models.lighthouse.height + LABEL_GAP) * lighthouseScale(levels.lighthouse)
        : models[id].height + LABEL_GAP,
    { badges: blenderLook(), panels: () => panelRects() },
  );
  // The Lighthouse made in Blender: its stage's model, shown at its level.
  let lighthouseShown = -1;
  const showLighthouse = (level: number) => {
    if (!staged("lighthouse") || level === lighthouseShown) return;
    lighthouseShown = level;
    void loadStage(stageName("lighthouse", level)).then((model) => {
      if (lighthouseShown !== level) return;
      showLevel(model, "lighthouse", level);
      scene.useLighthouseStage(model, lanternHeight(level), levelShape("lighthouse", level).height);
    });
  };
  const queue = createQueue(root, () => game.toCity());
  const sheet = createSheet(root, {
    upgrade: (id) => game.upgrade(id),
    research: (tech) => game.research(tech),
    train: (troop) => game.train(troop),
    promote: (troop) => game.promote(troop),
    heal: () => game.heal(),
    stoke: (on) => game.stoke(on),
    close: () => {
      sheet.close();
      buildings.select(null);
      if (blenderLook()) scene.unfocus();
    },
  });
  const raftSheet = createRaftSheet(root, {
    dock: (slot) => game.dockRaft(slot),
    install: (slot, building) => game.installOnRaft(slot, building),
    upgrade: (slot) => game.upgradeRaft(slot),
    repair: () => game.repairRafts(),
    close: () => raftSheet.close(),
  });

  scene.onFrame((now, view) => {
    if (view !== "city") return;
    rafts.animate(now);
    buildings.animate(now);
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
      if (blenderLook()) {
        const { x, z } = plotPosition(id);
        const level = Math.max(1, game.state().buildings[id]);
        const shape = staged(id) ? levelShape(id, level) : { height: id === "lighthouse" ? 3 : models[id].height, reach: 0.9 };
        scene.focus(x, z, shape.height, shape.reach);
      }
    } else {
      if (blenderLook()) scene.unfocus();
      if (slot) raftSheet.open(slot, game.state(), game.speed());
    }
  });

  return {
    useRaftBuildings(m) {
      rafts.useBuildings(m);
    },
    closeSheet() {
      sheet.close();
      raftSheet.close();
      buildings.select(null);
      if (blenderLook()) scene.unfocus();
    },
    update(state) {
      showLighthouse(state.buildings.lighthouse);
      buildings.refresh(state);
      rafts.refresh(state);
      // The foam goes around the rafts afloat and the shipyard at work.
      // The foam hugs the raft (inside its room), so the water between two rafts shows.
      scene.setMoored(raftSlots(state).filter((s) => s.view !== "free").map((s) => ({ ...slotPosition(s.key), r: RAFT_FILL * 0.8 })));
      raftSheet.update(state, game.speed());
      labels.update(state, game.speed());
      queue.update(state, game.speed());
      sheet.update(state, game.speed());
    },
  };
}
