import { BUILDINGS, BUILDING_IDS, type BuildingId } from "@brinelight/shared";
import { lighthouseScale, type SceneHandle } from "../scene/index.js";
import type { PlayerState } from "../state/index.js";
import { plotPosition } from "./buildings.js";
import { layoutLabels, type LabelBox } from "./overlap.js";
import { progress, suggestedUpgrades } from "./suggest.js";

/** Level labels above the buildings, as in the prototype. */
export function createLabels(root: HTMLElement, scene: SceneHandle) {
  const layer = document.createElement("div");
  layer.className = "labels city";
  layer.setAttribute("aria-hidden", "true");
  root.appendChild(layer);
  type Label = { el: HTMLDivElement; key: string; bar: HTMLElement | null; w: number; h: number; compactW: number; compactH: number };
  const els = {} as Record<BuildingId, Label>;
  for (const id of BUILDING_IDS) {
    const el = document.createElement("div");
    el.className = "bl";
    layer.appendChild(el);
    els[id] = { el, key: "", bar: null, w: 0, h: 0, compactW: 0, compactH: 0 };
  }
  /** Sizes are measured once per text change, and only when the label is shown. */
  const measure = (L: Label) => {
    L.el.classList.remove("compact");
    L.w = L.el.offsetWidth;
    L.h = L.el.offsetHeight;
    L.el.classList.add("compact");
    L.compactW = L.el.offsetWidth;
    L.compactH = L.el.offsetHeight;
    L.el.classList.remove("compact");
  };
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
            (level === 0 && !job ? `<b class="new">＋<span class="nm"> ${name}</span></b>` : `<b><span class="nm">${name} </span><i>${level}</i></b>`) +
            (job ? '<span class="pb"><i></i></span>' : "");
          L.bar = L.el.querySelector(".pb i");
          L.w = 0;
        }
        if (job && L.bar) L.bar.style.width = `${(progress(job) * 100).toFixed(1)}%`;
      }
    },
    /**
     * Follows the camera: called on every frame. Labels that would overlap are moved up a little or reduced
     * to a badge (overlap.ts); the label of the selected building always keeps its full size.
     */
    place(selected: BuildingId | null) {
      const boxes: (LabelBox & { id: BuildingId })[] = [];
      for (const id of BUILDING_IDS) {
        const { x, z } = plotPosition(id);
        const p = scene.project(x, id === "lighthouse" ? 3.3 * lighthouseScale(lighthouseLevel) : 1.9, z);
        const L = els[id];
        L.el.style.display = p.visible ? "" : "none";
        if (!p.visible) continue;
        if (L.w === 0) measure(L);
        boxes.push({ id, x: p.x, y: p.y, w: L.w, h: L.h, depth: p.depth, compactW: L.compactW, compactH: L.compactH });
      }
      const places = layoutLabels(boxes, selected);
      for (const b of boxes) {
        const L = els[b.id];
        const pl = places[b.id]!;
        L.el.classList.toggle("compact", pl.compact);
        L.el.style.transform = `translate(${b.x.toFixed(1)}px,${(b.y + pl.dy).toFixed(1)}px)`;
      }
    },
  };
}
