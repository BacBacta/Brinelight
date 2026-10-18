import { BUILDINGS, canUpgrade, maxLevel, upgradeCost, upgradeTime, type BuildingId, type TechId, type TroopType } from "@brinelight/shared";
import { stokeHtml } from "./lighthouse.js";
import type { PlayerState } from "../state/index.js";
import { actionButton, box, chip, costLine, createSheetView, progressBar, why } from "../ui/components.js";
import { costEntries, formatDuration, formatTimeLeft } from "./format.js";
import { bedsHtml, infirmaryHtml } from "./infirmary.js";
import { researchHtml } from "./research.js";
import { progress } from "./suggest.js";
import { trainingHtml } from "./training.js";

/**
 * The sheet of a building: level, upgrade cost and duration, and why you cannot upgrade when the button is off.
 * Once built, the Observatory's sheet also lists the research, the Barracks' sheet the training and the veterans, and the Infirmary's
 * sheet its wounded and their healing; the Infirmary's sheet shows its beds at every level. The Lighthouse's sheet has the
 * order to stoke it in the Mist.
 */
export function createSheet(root: HTMLElement, actions: { upgrade(id: BuildingId): void; research(tech: TechId): void; train(troop: TroopType): void; promote(troop: TroopType): void; heal(): void; stoke(on: boolean): void; close(): void }) {
  let current: BuildingId | null = null;
  const sheet = createSheetView(root, "", (act, data) => {
    if (!current) return;
    if (act === "close") actions.close();
    if (act === "upgrade") actions.upgrade(current);
    if (act === "research" && data.tech) actions.research(data.tech as TechId);
    if (act === "train" && data.troop) actions.train(data.troop as TroopType);
    if (act === "promote" && data.troop) actions.promote(data.troop as TroopType);
    if (act === "heal") actions.heal();
    if (act === "stoke") actions.stoke(data.on !== "true");
  });

  const render = (id: BuildingId, state: PlayerState, speed: number) => {
    const level = state.buildings[id];
    const job = state.queue.find((j) => j.id === id);
    const check = canUpgrade(id, { buildings: state.buildings, stock: state.stock, queue: state.queue.map((j) => j.id) });
    const next = level < maxLevel(id, state.buildings);
    const left = job ? formatTimeLeft(job.left / speed) : "";
    const extra = id === "lighthouse" ? stokeHtml(state) : level === 0 ? "" : id === "observatory" ? researchHtml(state, speed) : id === "barracks" ? trainingHtml(state, speed) : id === "infirmary" ? infirmaryHtml(state, speed) : "";
    const info = id === "infirmary" ? bedsHtml(state.buildings) : "";
    const k = [id, level, left, info, extra, job ? progress(job).toFixed(2) : "", check.ok ? "ok" : check.reason, costEntries(upgradeCost(id, level)).map(([r, v]) => state.stock[r] >= v).join()].join("|");
    if (sheet.drawn(k)) return;

    let body: string;
    if (job) {
      body = progressBar(progress(job));
    } else if (next) {
      body =
        box(
          level === 0 ? "Build" : `Upgrade to level ${level + 1}`,
          costLine(state.stock, upgradeCost(id, level)) + `<p class="p" style="font-size:12.5px;margin-top:6px">Time: ${formatDuration(upgradeTime(id, level) / speed)}</p>`,
        ) + actionButton(level === 0 ? "Build" : "Upgrade", check, "gold xl", "upgrade");
    } else {
      body = check.ok ? "" : why(check.reason);
    }
    sheet.draw(
      BUILDINGS[id].name,
      `<p class="p">${BUILDINGS[id].description}</p>` +
        `<div class="row">${chip(`Level ${level}${level === 0 ? " (not built)" : ""}`, "gold")}${job ? chip(`Building · ${left}`, "ok") : ""}</div>` +
        info +
        body +
        extra,
    );
  };

  return {
    get current() {
      return current;
    },
    open(id: BuildingId, state: PlayerState, speed: number) {
      current = id;
      sheet.show();
      render(id, state, speed);
    },
    close() {
      current = null;
      sheet.hide();
    },
    update(state: PlayerState, speed: number) {
      if (current) render(current, state, speed);
    },
  };
}
