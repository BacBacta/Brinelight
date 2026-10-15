import { BUILDINGS, BUILDERS } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { formatTimeLeft } from "./format.js";
import { progress } from "./suggest.js";

/** The builders' queue, top left: what is being built and how long is left. */
export function createQueue(root: HTMLElement) {
  const el = document.createElement("div");
  el.className = "queue";
  el.setAttribute("aria-label", `Your ${BUILDERS} builders`);
  root.appendChild(el);
  return {
    update(state: PlayerState, speed: number) {
      el.hidden = state.queue.length === 0;
      el.innerHTML = state.queue
        .map(
          (j) =>
            `<div><span class="n">${BUILDINGS[j.id].name} Lv ${state.buildings[j.id] + 1}</span>` +
            `<span class="pb"><i style="width:${(progress(j) * 100).toFixed(1)}%"></i></span>` +
            // Time left on the real clock: in development, DEV_SPEED makes it shorter.
            `<span class="t">${formatTimeLeft(j.left / speed)}</span></div>`,
        )
        .join("");
    },
  };
}
