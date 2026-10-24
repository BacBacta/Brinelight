import { LEVIATHAN_SITE, leviathanUp } from "@brinelight/shared";
import type { Kit, Models, SceneHandle } from "../scene/index.js";
import type { PlayerState } from "../state/index.js";
import { createFleetMarks } from "./fleets.js";
import { createSeaLabels } from "./labels.js";
import { createSeaMap } from "./map.js";
import { createSeaSheet } from "./sheet.js";

export type Sea = {
  /** Labels, open sheet and unread reports follow the state. */
  update(state: PlayerState): void;
  closeSheet(): void;
};

/** The sea view: the map, your fleets, the sheets of camps, wrecks, isles, shoals and the Leviathan, and the reports. */
export function createSea(
  kit: Kit,
  models: Models,
  scene: SceneHandle,
  canvas: HTMLCanvasElement,
  root: HTMLElement,
  game: {
    state(): PlayerState;
    sail(site: string): void;
    readReport(reportId: string): void;
    soon(): void;
    /** How much faster than real time the city runs: the server's speed when signed in. */
    speed(): number;
  },
): Sea {
  const map = createSeaMap(kit, models, (o) => scene.add(o, "sea"));
  const marks = createFleetMarks(
    models.boat,
    (o) => scene.add(o, "sea"),
    (o) => o.removeFromParent(),
  );
  const labels = createSeaLabels(root, scene);
  const sheet = createSeaSheet(root, { sail: (id) => game.sail(id), closeReport: (reportId) => game.readReport(reportId) });

  scene.onFrame((now, view) => {
    if (view !== "sea") return;
    const state = game.state();
    map.setLeviathan(leviathanUp(state.clock, state.server, state.leviathan));
    map.animate(now, scene.beams);
    marks.place(state.fleets, now);
    labels.place();
  });

  // A tap opens a sheet; a drag moves the map and opens nothing.
  let down: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener("pointerup", (e) => {
    if (!down || scene.view !== "sea") return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8;
    down = null;
    if (moved || sheet.showsReport) return;
    const id = scene.pick(e.clientX, e.clientY, map.hits)[0]?.object.userData.site as string | undefined;
    if (!id) return sheet.close();
    if (id.startsWith("camp-") || id.startsWith("wreck-") || id.startsWith("isle-") || id.startsWith("fish-") || id === LEVIATHAN_SITE) sheet.openSite(id, game.state(), game.speed());
    else {
      sheet.close();
      game.soon();
    }
  });

  return {
    update(state) {
      labels.update(state);
      const unread = state.reports.find((r) => !r.read);
      // An unread report opens by itself, one after another, wherever you are.
      if (unread && !sheet.showsReport) sheet.openReport(unread, state, game.speed());
      else sheet.update(state, game.speed());
    },
    closeSheet() {
      if (!sheet.showsReport) sheet.close();
    },
  };
}
