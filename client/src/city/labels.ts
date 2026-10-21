import { BUILDINGS, BUILDING_IDS, type BuildingId, type Buildings } from "@brinelight/shared";
import type { SceneHandle } from "../scene/index.js";
import type { PlayerState } from "../state/index.js";
import { plotPosition } from "./buildings.js";
import { layoutLabels, type LabelBox, type Rect } from "./overlap.js";
import { formatTimeLeft } from "./format.js";
import { possibleUpgrades, progress, suggestedUpgrades } from "./suggest.js";

/** A building's level on its label; at work, the level being built too: "29 → 30" (owner). */
export const levelText = (level: number, atWork: boolean): string => (atWork ? `${level} → ${level + 1}` : String(level));

/** Level labels above the buildings, as in the prototype. */
/** `heightOf` gives the height of a building's label above the ground, from its model and the levels (its tier, the Lighthouse's growth). */
/** How long a building's full label stays after its upgrade ends, in milliseconds. */
export const JUST_UPGRADED_MS = 6000;

/**
 * `badges` (week 8, with ?blender): a building shows nothing over it, unless you touched it (its full label), it is at
 * work (its full label and its timer), its upgrade can start (its level badge, with its arrow; in full when it is one
 * of the two suggested) or it was just upgraded (its full label for a few seconds); no label ever goes under one of
 * the `panels` (read four times a second).
 */
/**
 * What a building's label shows with badges, when not touched: its full label at work, suggested or just upgraded,
 * its level badge when its upgrade can start, nothing otherwise. Touched, it shows in full.
 */
export function badgeShown(o: { touched: boolean; atWork: boolean; suggested: boolean; justUpgraded: boolean; possible: boolean }): "none" | "badge" | "full" {
  if (o.touched || o.atWork || o.suggested || o.justUpgraded) return "full";
  return o.possible ? "badge" : "none";
}

export function createLabels(
  root: HTMLElement,
  scene: SceneHandle,
  heightOf: (id: BuildingId, levels: Buildings) => number,
  options: { badges?: boolean; panels?: () => Rect[] } = {},
) {
  const layer = document.createElement("div");
  layer.className = "labels city";
  layer.setAttribute("aria-hidden", "true");
  root.appendChild(layer);
  type Label = { el: HTMLDivElement; key: string; bar: HTMLElement | null; left: HTMLElement | null; w: number; h: number; compactW: number; compactH: number };
  const els = {} as Record<BuildingId, Label>;
  for (const id of BUILDING_IDS) {
    const el = document.createElement("div");
    el.className = "bl";
    layer.appendChild(el);
    els[id] = { el, key: "", bar: null, left: null, w: 0, h: 0, compactW: 0, compactH: 0 };
  }
  // The game's font can arrive after a first measure (font-display: swap): sizes are measured again once it is there,
  // or a label measured with the fallback font would be wider on screen than the layout thinks.
  document.fonts?.addEventListener("loadingdone", () => {
    for (const id of BUILDING_IDS) els[id].w = 0;
  });
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
  let levels: Buildings | null = null;
  // The buildings that may show their full label now, and when the ones just upgraded go back to their badge.
  const wantFull = new Set<BuildingId>();
  // With badges, the buildings that show anything at all when not touched.
  const shown = new Set<BuildingId>();
  const justUpgraded = new Map<BuildingId, number>();
  let panelRects: Rect[] = [];
  let panelsAt = -Infinity;

  return {
    /** Text, arrows, progress bars and the time left of the works, from the state (times sped up by `speed`, as the queue's). */
    update(state: PlayerState, speed = 1) {
      const now = performance.now();
      for (const id of BUILDING_IDS) if (levels && state.buildings[id] > levels[id]) justUpgraded.set(id, now + JUST_UPGRADED_MS);
      levels = state.buildings;
      const suggested = suggestedUpgrades(state);
      const possible = options.badges ? possibleUpgrades(state) : suggested;
      for (const id of BUILDING_IDS) {
        const L = els[id];
        const level = state.buildings[id];
        const job = state.queue.find((j) => j.id === id);
        const up = possible.includes(id);
        const show = badgeShown({ touched: false, atWork: !!job, suggested: suggested.includes(id), justUpgraded: (justUpgraded.get(id) ?? 0) > now, possible: up });
        if (show === "full") wantFull.add(id);
        else wantFull.delete(id);
        if (show !== "none") shown.add(id);
        else shown.delete(id);
        const key = `${level}|${!!job}|${up}`;
        if (L.key !== key) {
          L.key = key;
          const name = BUILDINGS[id].name;
          L.el.innerHTML =
            (up ? '<span class="up">↑</span>' : "") +
            (level === 0 && !job ? `<b class="new">＋<span class="nm"> ${name}</span></b>` : `<b><span class="nm">${name} </span><i>${levelText(level, !!job)}</i></b>`) +
            (job ? '<span class="pb"><i></i></span><small class="tl"></small>' : "");
          L.bar = L.el.querySelector(".pb i");
          L.left = L.el.querySelector(".tl");
          L.w = 0;
        }
        if (job && L.bar) L.bar.style.width = `${(progress(job) * 100).toFixed(1)}%`;
        if (job && L.left) {
          const text = formatTimeLeft(job.left / speed);
          if (L.left.textContent !== text) L.left.textContent = text;
        }
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
        const p = scene.project(x, levels ? heightOf(id, levels) : 0, z);
        const L = els[id];
        // With badges, a building with nothing to say shows nothing, until you touch it.
        const quiet = options.badges && !shown.has(id) && id !== selected;
        L.el.style.display = p.visible && !quiet ? "" : "none";
        if (!p.visible || quiet) continue;
        if (L.w === 0) measure(L);
        boxes.push({ id, x: p.x, y: p.y, w: L.w, h: L.h, depth: p.depth, compactW: L.compactW, compactH: L.compactH });
      }
      if (options.panels && performance.now() - panelsAt > 250) {
        panelRects = options.panels();
        panelsAt = performance.now();
      }
      const places = options.badges ? layoutLabels(boxes, selected, { full: wantFull, panels: panelRects }) : layoutLabels(boxes, selected);
      for (const b of boxes) {
        const L = els[b.id];
        const pl = places[b.id]!;
        L.el.classList.toggle("compact", pl.compact);
        if (pl.hidden) L.el.style.display = "none";
        L.el.style.transform = `translate(${b.x.toFixed(1)}px,${(b.y + pl.dy).toFixed(1)}px)`;
      }
    },
  };
}
