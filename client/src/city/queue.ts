import { BUILDINGS, BUILDERS, TECHS, seaSite, totalTroops, type Fleet } from "@brinelight/shared";
import { ICONS } from "../ui/icons.js";
import type { PlayerState } from "../state/index.js";
import { formatTimeLeft } from "./format.js";
import { fleetPosition } from "../sea/fleets.js";
import { progress } from "./suggest.js";
import { healingName } from "./infirmary.js";
import { batchName } from "./training.js";

const fleetLabel = (f: Fleet): string => `Fleet · ${f.phase === "back" ? "home" : (seaSite(f.site)?.name ?? "")}`;

/** What the badge shown at sea says: how many upgrades are in progress, or nothing when there is none. */
export const buildBadge = (state: PlayerState): { count: number; label: string } | null =>
  state.queue.length === 0
    ? null
    : { count: state.queue.length, label: `${state.queue.length} upgrade${state.queue.length > 1 ? "s" : ""} in progress. Back to the city` };

/**
 * The builders' queue and the fleets at sea, top left: what is going on and how long is left.
 * At sea the list would hide the top of the map, so a small hammer badge stands in for it; tapping it goes back to the city.
 */
export function createQueue(root: HTMLElement, onCity: () => void) {
  const el = document.createElement("div");
  el.className = "queue";
  el.setAttribute("aria-label", `Your ${BUILDERS} builders`);
  root.appendChild(el);
  const badge = document.createElement("button");
  badge.className = "build-badge";
  badge.hidden = true;
  badge.addEventListener("click", onCity);
  root.appendChild(badge);
  return {
    update(state: PlayerState, speed: number) {
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
      el.innerHTML =
        state.queue.map((j) => row(`${BUILDINGS[j.id].name} Lv ${state.buildings[j.id] + 1}`, progress(j), j.left)).join("") +
        (state.research ? row(`Research · ${TECHS[state.research.id].name}`, progress(state.research), state.research.left) : "") +
        (state.training ? row(batchName(state.training.count, state.training.troop), progress(state.training), state.training.left) : "") +
        (state.healing ? row(healingName(totalTroops(state.healing.wounded)), progress(state.healing), state.healing.left) : "") +
        (state.yard ? row("Shipyard · raft", progress(state.yard), state.yard.left) : "") +
        state.fleets.map((f) => row(fleetLabel(f), fleetPosition(f), f.left)).join("");
    },
  };
}
