import { BUILDINGS, BUILDING_IDS, type BuildingId } from "@brinelight/shared";
import { lighthouseScale, type SceneHandle } from "../scene/index.js";
import type { PlayerState } from "../state/index.js";
import { plotPosition } from "./buildings.js";
import { progress, suggestedUpgrades } from "./suggest.js";

/** Level labels above the buildings, as in the prototype. */
export function createLabels(root: HTMLElement, scene: SceneHandle) {
  const layer = document.createElement("div");
  layer.className = "labels city";
  layer.setAttribute("aria-hidden", "true");
  root.appendChild(layer);
  const els = {} as Record<BuildingId, { el: HTMLDivElement; key: string; bar: HTMLElement | null }>;
  for (const id of BUILDING_IDS) {
    const el = document.createElement("div");
    el.className = "bl";
    layer.appendChild(el);
    els[id] = { el, key: "", bar: null };
  }
  let lighthouseLevel = 0;

  return {
    /** Text, arrows and progress bars, from the state. */
    update(state: PlayerState) {
      lighthouseLevel = state.buildings.lighthouse;
      const suggested = suggestedUpgrades(state);
      for (const id of BUILDING_IDS) {
        const L = els[id];
        const level = state.buildings[id];
        const job = state.queue.find((j) => j.id === id);
        const up = suggested.includes(id);
        const key = `${level}|${!!job}|${up}`;
        if (L.key !== key) {
          L.key = key;
          const name = BUILDINGS[id].name;
          L.el.innerHTML =
            (up ? '<span class="up">↑</span>' : "") +
            (level === 0 && !job ? `<b class="new">＋ ${name}</b>` : `<b>${name} <i>${level}</i></b>`) +
            (job ? '<span class="pb"><i></i></span>' : "");
          L.bar = L.el.querySelector(".pb i");
        }
        if (job && L.bar) L.bar.style.width = `${(progress(job) * 100).toFixed(1)}%`;
      }
    },
    /** Follows the camera: called on every frame. */
    place() {
      for (const id of BUILDING_IDS) {
        const { x, z } = plotPosition(id);
        const p = scene.project(x, id === "lighthouse" ? 3.3 * lighthouseScale(lighthouseLevel) : 1.9, z);
        const el = els[id].el;
        el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
        el.style.display = p.visible ? "" : "none";
      }
    },
  };
}
