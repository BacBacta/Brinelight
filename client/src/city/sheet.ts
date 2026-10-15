import { BUILDINGS, canUpgrade, maxLevel, upgradeCost, upgradeTime, type BuildingId } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { RESOURCE_NAMES, costEntries, formatAmount, formatDuration, formatTimeLeft } from "./format.js";
import { progress } from "./suggest.js";

/** The sheet of a building: level, upgrade cost and duration, and why you cannot upgrade when the button is off. */
export function createSheet(root: HTMLElement, actions: { upgrade(id: BuildingId): void; close(): void }) {
  const el = document.createElement("section");
  el.className = "sheet";
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
  });

  const render = (id: BuildingId, state: PlayerState, speed: number) => {
    const level = state.buildings[id];
    const job = state.queue.find((j) => j.id === id);
    const check = canUpgrade(id, { buildings: state.buildings, stock: state.stock, queue: state.queue.map((j) => j.id) });
    const next = level < maxLevel(id, state.buildings);
    const left = job ? formatTimeLeft(job.left / speed) : "";
    const k = [id, level, left, job ? progress(job).toFixed(2) : "", check.ok ? "ok" : check.reason, costEntries(upgradeCost(id, level)).map(([r, v]) => state.stock[r] >= v).join()].join("|");
    if (k === key) return;
    key = k;

    let body: string;
    if (job) {
      body = `<p class="chip ok">Building · ${left}</p><p class="pb"><i style="width:${(progress(job) * 100).toFixed(1)}%"></i></p>`;
    } else if (next) {
      const cost = costEntries(upgradeCost(id, level))
        .map(([r, v]) => `<span class="${state.stock[r] < v ? "no" : ""}">${formatAmount(v)} ${RESOURCE_NAMES[r]}</span>`)
        .join("");
      body =
        `<div class="box"><h3>${level === 0 ? "Build" : `Upgrade to level ${level + 1}`}</h3>` +
        `<div class="cost">${cost}</div><p class="small">Time: ${formatDuration(upgradeTime(id, level))}</p></div>` +
        `<button class="b gold" data-act="upgrade" ${check.ok ? "" : "disabled"}>${level === 0 ? "Build" : "Upgrade"}</button>` +
        (check.ok ? "" : `<p class="why" role="status">${check.reason}</p>`);
    } else {
      body = `<p class="why">${check.ok ? "" : check.reason}</p>`;
    }
    el.setAttribute("aria-label", BUILDINGS[id].name);
    el.innerHTML =
      `<header><h2>${BUILDINGS[id].name}</h2><button class="x" data-act="close" aria-label="Close">✕</button></header>` +
      `<p>${BUILDINGS[id].description}</p>` +
      `<p class="chip gold">Level ${level}${level === 0 ? " (not built)" : ""}</p>` +
      body;
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
