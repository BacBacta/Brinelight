import { BUILDINGS, BUILDERS, TECHS, seaSite, totalTroops, trainingName, type Fleet } from "@brinelight/shared";
import { ICONS } from "../ui/icons.js";
import type { PlayerState } from "../state/index.js";
import { formatTimeLeft } from "./format.js";
import { fleetPosition } from "../sea/fleets.js";
import { progress } from "./suggest.js";
import { healingName } from "./infirmary.js";
import { yardName } from "./raftSheet.js";

const fleetLabel = (f: Fleet): string => `Fleet · ${f.phase === "back" ? "home" : (seaSite(f.site)?.name ?? "")}`;

/** What the badge shown at sea says: how many upgrades are in progress, or nothing when there is none. */
export const buildBadge = (state: PlayerState): { count: number; label: string } | null =>
  state.queue.length === 0
    ? null
    : { count: state.queue.length, label: `${state.queue.length} upgrade${state.queue.length > 1 ? "s" : ""} in progress. Back to the city` };

/** Rows the queue shows before "+N more": more would cover the island on a small phone. */
export const QUEUE_ROWS = 3;

/** The rows shown, and the button under them: "+N more" when some are folded away, "Show less" when unfolded, or none. */
export function queueFold(rows: number, expanded: boolean): { shown: number; button: string | null } {
  if (rows <= QUEUE_ROWS) return { shown: rows, button: null };
  return expanded ? { shown: rows, button: "Show less" } : { shown: QUEUE_ROWS, button: `+${rows - QUEUE_ROWS} more` };
}

/**
 * The builders' queue and the fleets at sea, top left: what is going on and how long is left. At most QUEUE_ROWS
 * rows, then a "+N more" button that unfolds the rest and folds it back.
 * At sea the list would hide the top of the map, so a small hammer badge stands in for it; tapping it goes back to the city.
 */
export function createQueue(root: HTMLElement, onCity: () => void) {
  const el = document.createElement("div");
  el.className = "queue";
  el.setAttribute("aria-label", `Your ${BUILDERS} builders`);
  root.appendChild(el);
  const list = document.createElement("div");
  list.className = "list";
  el.appendChild(list);
  // Kept across updates: the rows are drawn again every second, the button never, so a tap on it is never lost.
  const more = document.createElement("button");
  more.className = "more";
  more.hidden = true;
  el.appendChild(more);
  let expanded = false;
  let last: { state: PlayerState; speed: number } | null = null;
  let html = "";
  const badge = document.createElement("button");
  badge.className = "build-badge";
  badge.hidden = true;
  badge.addEventListener("click", onCity);
  root.appendChild(badge);
  const queue = {
    update(state: PlayerState, speed: number) {
      last = { state, speed };
      const b = buildBadge(state);
      badge.hidden = b === null;
      if (b && badge.getAttribute("aria-label") !== b.label) {
        badge.setAttribute("aria-label", b.label);
        badge.innerHTML = `${ICONS.hammer}<b>${b.count}</b>`;
      }
      el.hidden = state.queue.length === 0 && !state.research && !state.yard && !state.training && !state.healing && state.fleets.length === 0;
      // Time left on the real clock: a faster game time (DEV_SPEED, or the server's speed when signed in) makes it shorter.
      const row = (name: string, p: number, left: number) =>
        `<div><span class="n">${name}</span><span class="pb"><i style="width:${(p * 100).toFixed(1)}%"></i></span><span class="t">${formatTimeLeft(left / speed)}</span></div>`;
      const rows = [
        ...state.queue.map((j) => row(`${BUILDINGS[j.id].name} Lv ${state.buildings[j.id] + 1}`, progress(j), j.left)),
        ...(state.research ? [row(`Research · ${TECHS[state.research.id].name}`, progress(state.research), state.research.left)] : []),
        ...(state.training ? [row(trainingName(state.training), progress(state.training), state.training.left)] : []),
        ...(state.healing ? [row(healingName(totalTroops(state.healing.wounded)), progress(state.healing), state.healing.left)] : []),
        ...(state.yard ? [row(yardName(state)!, progress(state.yard), state.yard.left)] : []),
        ...state.fleets.map((f) => row(fleetLabel(f), fleetPosition(f), f.left)),
      ];
      // Folded again once nothing is left to fold.
      if (rows.length <= QUEUE_ROWS) expanded = false;
      const fold = queueFold(rows.length, expanded);
      const next = rows.slice(0, fold.shown).join("");
      if (next !== html) list.innerHTML = html = next;
      more.hidden = fold.button === null;
      if (fold.button !== null && more.textContent !== fold.button) {
        more.textContent = fold.button;
        more.setAttribute("aria-expanded", String(expanded));
      }
    },
  };
  more.addEventListener("click", () => {
    expanded = !expanded;
    if (last) queue.update(last.state, last.speed);
  });
  return queue;
}
