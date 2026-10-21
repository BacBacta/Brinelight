import { BUILDING_IDS, RAFT_SLOTS, yardSlot, type BuildingId, type RaftBuildingId, type TechId, type TroopType } from "@brinelight/shared";
import type { SceneHandle } from "../scene/index.js";
import type { PlayerState } from "../state/index.js";
import { coastAt } from "../scene/coast.js";
import { createCityBuildings, plotPosition } from "./buildings.js";
import { createLabels } from "./labels.js";
import { createQueue } from "./queue.js";
import { createRaftSheet } from "./raftSheet.js";
import { RAFT_FILL, createCityRafts, raftSlots, slotPosition } from "./rafts.js";
import { createVillage } from "./village.js";
import { createLife } from "./life/index.js";
import { createFabric } from "./fabric/index.js";
import { createLand, landSlotsOf } from "./land/index.js";
import type { LandSlots } from "./land/field.js";
import { landShown } from "./words.js";
import { createSheet } from "./sheet.js";
import { terrainName, shownShape, lanternHeight, levelShape, loadStage, radarAt, showLevel, stageName } from "./staged.js";

export type City = {
  /** Shows the state: models, labels, queue and open sheet. */
  update(state: PlayerState): void;
  /** Closes the open sheet, when you leave the city. */
  closeSheet(): void;
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
/** Before the Lighthouse 5, no land is won: the island alone. */
const NO_LAND: LandSlots = { won: [], flooded: [], filling: null, free: [] };

export function createCity(
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
  const buildings = createCityBuildings((o) => scene.add(o));
  // The floating village made in Blender draws the rafts, their walkways and buildings, and the shipyard's raft.
  const village = createVillage((o) => scene.add(o), RAFT_SLOTS.length);
  const rafts = createCityRafts((o) => scene.add(o), coastAt, village);
  // From the Lighthouse 5, the rafts are land won on the sea, welded to the island (owner): one mesh, built in the game.
  const land = createLand((o) => scene.add(o));
  let landOn = false;
  /** The land shown (or the island given back): its outline stays on screen in the normal view, as the rafts did. */
  const showLand = () => {
    const edge = (land.slots?.won ?? []).flatMap((c) => Array.from({ length: 8 }, (_, i) => ({ x: c.x + Math.cos((i * Math.PI) / 4) * 1.25, z: c.z + Math.sin((i * Math.PI) / 4) * 1.25 })));
    scene.useLand(landOn ? land.object : null, edge, landOn ? land.grid : null);
  };
  land.onBuilt = showLand;
  // The "!" over each flooded plot (owner): it says the plot needs draining, as the raft's sheet does.
  const marks = document.createElement("div");
  marks.className = "labels city flood-marks";
  marks.setAttribute("aria-hidden", "true");
  root.appendChild(marks);
  let flooded: { key: string; el: HTMLElement }[] = [];
  const showMarks = (keys: readonly string[]) => {
    if (keys.join() === flooded.map((f) => f.key).join()) return;
    marks.textContent = "";
    flooded = keys.map((key) => {
      const el = document.createElement("div");
      el.className = "flood";
      el.textContent = "!";
      marks.appendChild(el);
      return { key, el };
    });
  };
  // The island's life (meeting 4): its survivors, animals and plants.
  const life = createLife((o) => scene.add(o));
  // The city fabric (owner, 21 October): houses, streets, squares, equipment, fields and the port, decor only.
  const fabric = createFabric((o) => scene.add(o));
  fabric.onPlan = (plan) => {
    life.useFabric(plan.taken, plan.smoke);
    land.setFabric(plan.taken, plan.trees);
  };
  // Labels float just above each model at its level.
  const labels = createLabels(root, scene, (id, levels) => shownShape(id, Math.max(1, levels[id])).height + LABEL_GAP, { badges: true, panels: () => panelRects() });
  // The island's look follows the Lighthouse's era.
  const showGround = (lighthouse: number) => scene.useTerrain(terrainName(lighthouse));
  // The Lighthouse made in Blender: its stage's model, shown at its level.
  let lighthouseShown = -1;
  const showLighthouse = (level: number) => {
    showGround(level);
    if (level === lighthouseShown) return;
    lighthouseShown = level;
    void loadStage(stageName("lighthouse", level)).then((model) => {
      if (lighthouseShown !== level) return;
      showLevel(model, "lighthouse", level);
      scene.useLighthouseStage(model, lanternHeight(level), levelShape("lighthouse", level).height);
      const at = radarAt(level);
      if (!at) scene.useLighthouseRadar(null);
      else void loadStage("lighthouse-radar").then((radar) => lighthouseShown === level && scene.useLighthouseRadar(radar, at));
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
      scene.unfocus();
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
    village.setCloseness(scene.closeness());
    village.setDimness(scene.dimness());
    fabric.setDimness(scene.dimness());
    fabric.animate(now);
    // Placing a raft: a free slot's sheet is open.
    const open = raftSheet.current;
    rafts.setPlacing(open !== null && !game.state().rafts[open] && yardSlot(game.state().yard) !== open);
    rafts.animate(now);
    life.animate(now, scene.closeness(), scene.cityCamera, scene.dimness());
    buildings.animate(now);
    labels.place(sheet.current);
    for (const f of flooded) {
      const at = slotPosition(f.key);
      const p = scene.project(at.x, 0.45, at.z);
      f.el.style.display = p.visible ? "" : "none";
      if (p.visible) f.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
    }
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
      const all = buildings.volumes(game.state());
      scene.focus(
        all[id],
        BUILDING_IDS.filter((o) => o !== id).map((o) => all[o]),
      );
    } else {
      scene.unfocus();
      if (slot) raftSheet.open(slot, game.state(), game.speed());
    }
  });

  return {
    closeSheet() {
      sheet.close();
      raftSheet.close();
      buildings.select(null);
      scene.unfocus();
    },
    update(state) {
      showLighthouse(state.buildings.lighthouse);
      buildings.refresh(state);
      // Every building stays whole in the normal view, between the cards (main.ts).
      scene.setBuildings(Object.values(buildings.volumes(state)));
      rafts.refresh(state);
      const on = landShown(state.buildings.lighthouse);
      const toggled = on !== landOn;
      landOn = on;
      // A land built again shows once ready (land.onBuilt): the one shown stays until then.
      const builtNow = land.update(state, on);
      if (toggled && !builtNow) showLand();
      showMarks(on ? raftSlots(state).filter((x) => x.view === "damaged").map((x) => x.key) : []);
      life.update(state);
      fabric.update(state, on ? landSlotsOf(state) : NO_LAND);
      // The foam goes around the rafts afloat and the shipyard at work.
      // The foam hugs the raft (inside its room), so the water between two rafts shows.
      // On the land won, a flooded plot is still water (no foam over it); the land itself is the shore.
      const asLand = on;
      scene.setMoored(raftSlots(state).filter((s) => s.view !== "free").map((s) => (asLand && s.view === "damaged" ? { ...slotPosition(s.key), r: 0.8, still: true } : { ...slotPosition(s.key), r: RAFT_FILL * 0.8 })));
      raftSheet.update(state, game.speed());
      labels.update(state, game.speed());
      queue.update(state, game.speed());
      sheet.update(state, game.speed());
    },
  };
}
