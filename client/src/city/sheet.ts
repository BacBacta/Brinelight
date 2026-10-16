import { BUILDINGS, canUpgrade, maxLevel, upgradeCost, upgradeTime, type BuildingId, type TechId, type TroopType } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { resourceIcon } from "../ui/icons.js";
import { RESOURCE_NAMES, costEntries, formatAmount, formatDuration, formatTimeLeft } from "./format.js";
import { researchHtml } from "./research.js";
import { progress } from "./suggest.js";
import { trainingHtml } from "./training.js";

/**
 * The sheet of a building: level, upgrade cost and duration, and why you cannot upgrade when the button is off.
 * Once built, the Observatory's sheet also lists the research, and the Barracks' sheet the training.
 */
export function createSheet(root: HTMLElement, actions: { upgrade(id: BuildingId): void; research(tech: TechId): void; train(troop: TroopType): void; close(): void }) {
  const el = document.createElement("section");
  el.className = "sheet card";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  root.appendChild(el);
  let current: BuildingId | null = null;
  let key = "";

  el.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest("button");
    if (!t || !current) return;
    if (t.dataset.act === "close") actions.close();
    if (t.dataset.act === "upgrade") actions.upgrade(current);
    if (t.dataset.act === "research" && t.dataset.tech) actions.research(t.dataset.tech as TechId);
    if (t.dataset.act === "train" && t.dataset.troop) actions.train(t.dataset.troop as TroopType);
  });

  const render = (id: BuildingId, state: PlayerState, speed: number) => {
    const level = state.buildings[id];
    const job = state.queue.find((j) => j.id === id);
    const check = canUpgrade(id, { buildings: state.buildings, stock: state.stock, queue: state.queue.map((j) => j.id) });
    const next = level < maxLevel(id, state.buildings);
    const left = job ? formatTimeLeft(job.left / speed) : "";
    const extra = level === 0 ? "" : id === "observatory" ? researchHtml(state, speed) : id === "barracks" ? trainingHtml(state, speed) : "";
    const k = [id, level, left, extra, job ? progress(job).toFixed(2) : "", check.ok ? "ok" : check.reason, costEntries(upgradeCost(id, level)).map(([r, v]) => state.stock[r] >= v).join()].join("|");
    if (k === key) return;
    key = k;

    let body: string;
    if (job) {
      body = `<div class="pb"><i style="width:${(progress(job) * 100).toFixed(1)}%"></i></div>`;
    } else if (next) {
      const cost = costEntries(upgradeCost(id, level))
        .map(([r, v]) => `<span class="${state.stock[r] < v ? "no" : ""}" title="${RESOURCE_NAMES[r]}">${resourceIcon(r)}${formatAmount(v)}</span>`)
        .join("");
      body =
        `<div class="box"><h4>${level === 0 ? "Build" : `Upgrade to level ${level + 1}`}</h4>` +
        `<div class="cost">${cost}</div><p class="p" style="font-size:12.5px;margin-top:6px">Time: ${formatDuration(upgradeTime(id, level) / speed)}</p></div>` +
        // Still tappable when refused: the tap shows the reason in a toast too.
        `<button class="b gold xl" data-act="upgrade" aria-disabled="${!check.ok}">${level === 0 ? "Build" : "Upgrade"}</button>` +
        (check.ok ? "" : `<p class="why">${check.reason}</p>`);
    } else {
      body = check.ok ? "" : `<p class="why">${check.reason}</p>`;
    }
    el.setAttribute("aria-label", BUILDINGS[id].name);
    el.innerHTML =
      `<div class="sh-h"><h2>${BUILDINGS[id].name}</h2><button class="x" data-act="close" aria-label="Close">✕</button></div>` +
      `<div class="sh-b"><p class="p">${BUILDINGS[id].description}</p>` +
      `<div class="row"><span class="chip gold">Level ${level}${level === 0 ? " (not built)" : ""}</span>${job ? `<span class="chip ok">Building · ${left}</span>` : ""}</div>` +
      body +
      extra +
      `</div>`;
  };

  return {
    get current() {
      return current;
    },
    open(id: BuildingId, state: PlayerState, speed: number) {
      current = id;
      key = "";
      el.hidden = false;
      render(id, state, speed);
    },
    close() {
      current = null;
      el.hidden = true;
    },
    update(state: PlayerState, speed: number) {
      if (current) render(current, state, speed);
    },
  };
}
