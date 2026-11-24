/**
 * The portal's game (Hold the Light): Night, dawn, Day, and the next Night. The city is the rules' (night.PortalCity),
 * kept on the device (../portal/save.ts); a Night's loot goes home the moment it ends. A new player starts in Night 1 at
 * once; a player back finds their city.
 */
import { night as N } from "@brinelight/shared";
import type { SceneHandle } from "../scene/index.js";
import { createMeasure, measureHtml, readMeasures } from "../portal/measure.js";
import { openCity, saveCity } from "../portal/save.js";
import type { PortalStore } from "../portal/store.js";
import { createDay } from "./day.js";
import { startNight, type NightHandle } from "./index.js";

export type PortalDeps = {
  scene: SceneHandle;
  canvas: HTMLCanvasElement;
  root: HTMLElement;
  store: PortalStore | null;
  newSeed(): number;
  /** The island shows the city's buildings at their levels. */
  showLevels(levels: N.PortalCity["buildings"]): void;
  /** A refusal or a piece of news, in a toast. */
  toast(text: string, bad?: boolean): void;
};

export function startPortal(d: PortalDeps): { city(): N.PortalCity } {
  document.body.classList.add("portal");
  const opened = openCity(d.store);
  let city = opened.city;
  if (opened.rejected) d.toast("Your saved city could not be read. A copy was kept.", true);
  let night: NightHandle | null = null;
  // ?measure (gates A and B): counted on the device only, read out by the tester.
  const measure = createMeasure(d.store, () => Date.now());
  setInterval(() => measure.save(), 15_000);
  document.addEventListener("visibilitychange", () => document.hidden && measure.save());
  if (new URLSearchParams(location.search).has("measure")) {
    const panel = document.createElement("section");
    panel.className = "measure card";
    panel.innerHTML = `<h2>Sessions on this device</h2>${measureHtml(readMeasures(d.store))}<p><small>Kept on this device only. Nothing is sent.</small></p>`;
    d.root.append(panel);
  }

  const keep = () => saveCity(d.store, city);
  const showDay = () => {
    d.showLevels(city.buildings);
    day.show(city);
  };
  const day = createDay(d.root, {
    upgrade(b) {
      const r = N.upgradeCity(city, b);
      if (!r.ok) {
        d.toast(r.reason, true);
        return;
      }
      city = r.city;
      keep();
      showDay();
    },
    night: (k) => begin(k),
  });

  function begin(k: number = N.nextNight(city)): void {
    day.hide();
    night = startNight(d.scene, d.canvas, d.root, {
      night: Math.min(k, N.nextNight(city)),
      seed: d.newSeed(),
      powers: N.cityPowers(city),
      onAim: () => measure.beamMoved(),
      onOver(n) {
        measure.nightEnded(n.night, n.wave, n.phase === "won" ? "won" : "lost");
        measure.save();
        const r = N.dawn(city, n);
        if (r.ok) {
          city = r.city;
          keep();
        }
      },
      onDone() {
        night?.dispose();
        night = null;
        showDay();
      },
    });
  }

  // Taps on the 3D view are the beam's by Night; by Day they open none of the Brinelight on Solana's sheets.
  const tap = (e: PointerEvent) => {
    e.stopImmediatePropagation();
    night?.hold(e);
  };
  d.canvas.addEventListener("pointerdown", tap);
  d.canvas.addEventListener("pointerup", tap);

  d.showLevels(city.buildings);
  if (city.played === 0) begin();
  else showDay();
  return { city: () => city };
}
