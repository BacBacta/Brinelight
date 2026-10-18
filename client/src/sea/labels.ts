import { SEA_SITES, distance, fleetSight, odds, pirateCamp } from "@brinelight/shared";
import type { SceneHandle } from "../scene/index.js";
import type { PlayerState } from "../state/index.js";
import { attackInput } from "./odds.js";

const COLORS = { blue: "#3D8BE0", green: "#3FAE4A", yellow: "#E0B23A", red: "#E2572F" } as const;

/** The name shown over a site, as in the prototype. */
export function siteLabel(id: string, state: PlayerState): string {
  const s = SEA_SITES.find((x) => x.id === id)!;
  if (s.kind === "camp") return `Pirates Lv ${state.world.camps[s.id] ?? s.level}`;
  if (s.kind === "city") return `${s.name} · ${s.level}`;
  return s.name;
}

/** Labels over the sea sites; pirate camps are colored by your odds; in the Mist, the camps and wrecks beyond your light fade. */
export function createSeaLabels(root: HTMLElement, scene: SceneHandle) {
  const layer = document.createElement("div");
  layer.className = "labels sea";
  layer.setAttribute("aria-hidden", "true");
  root.appendChild(layer);
  const els = SEA_SITES.map((s) => {
    const el = document.createElement("div");
    el.className = `sl ${s.kind}`;
    if (s.color) el.style.setProperty("--cc", COLORS[s.color]);
    layer.appendChild(el);
    return { s, el };
  });
  return {
    update(state: PlayerState) {
      const { reach } = fleetSight(state);
      for (const { s, el } of els) {
        el.classList.toggle("hid", (s.kind === "camp" || s.kind === "wreck") && distance(s) > reach);
        const text = siteLabel(s.id, state);
        if (el.textContent !== text) el.textContent = text;
        if (s.kind === "camp") el.dataset.d = odds(attackInput(state, pirateCamp(state.world.camps[s.id] ?? s.level ?? 1)));
      }
    },
    place() {
      for (const { s, el } of els) {
        const p = scene.project(s.x, s.kind === "grand" ? 5 : 2.6, s.z);
        // Hidden under the top bar and the bottom menu, as in the prototype.
        const ok = p.visible && p.x > 30 && p.x < innerWidth - 30 && p.y > 118 && p.y < innerHeight - 70;
        el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
        el.style.display = ok ? "" : "none";
      }
    },
  };
}
