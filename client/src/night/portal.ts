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
import { createNightAudio } from "./audio.js";
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
  /** The game's Sounds switch (Settings), and turning it. */
  soundOn(): boolean;
  toggleSound(): void;
};

export function startPortal(d: PortalDeps): { city(): N.PortalCity } {
  document.body.classList.add("portal");
  const opened = openCity(d.store);
  let city = opened.city;
  if (opened.rejected) d.toast("Your saved city could not be read. A copy was kept.", true);
  let night: NightHandle | null = null;
  // The Night's sounds and music: from the first tap, the Sounds switch obeyed.
  const audio = createNightAudio(() => d.soundOn());
  setInterval(() => audio.refresh(), 500);
  // M turns the sounds off and on, by Night and by Day.
  addEventListener("keydown", (e) => {
    if (e.code !== "KeyM") return;
    d.toggleSound();
    audio.refresh();
    if (day.shown) showDay();
  });
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
    city = N.dailyNow(city, Date.now() / 1000);
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
      city = N.dailyAfterUpgrade(r.city, Date.now() / 1000);
      keep();
      showDay();
    },
    night: (k) => begin(k),
    sound: () => {
      d.toggleSound();
      audio.refresh();
    },
    soundOn: () => d.soundOn(),
    chest(points) {
      const r = N.openDailyChest(city, Date.now() / 1000, points);
      if (!r.ok) return d.toast(r.reason, true);
      city = r.city;
      keep();
      showDay();
    },
    recruit() {
      const r = N.recruitDaily(city, Date.now() / 1000);
      if (!r.ok) return d.toast(r.reason, true);
      city = r.city;
      keep();
      const p = N.CAPTAIN_POWERS[r.captain];
      const rank = r.rarity[0]!.toUpperCase() + r.rarity.slice(1);
      d.toast(city.captains.unlocked.includes(r.captain) && city.captains.shards[r.captain] >= N.SHARDS_TO_UNLOCK ? `${p.captain} (${rank}) joins you!` : `${p.captain} (${rank}): ${N.RECRUIT_SHARDS[r.rarity]} shards.`);
      showDay();
    },
    lead(id) {
      const r = N.setLead(city, id);
      if (!r.ok) {
        d.toast(r.reason, true);
        return;
      }
      city = r.city;
      keep();
      showDay();
    },
  });

  function begin(k: number = N.nextNight(city)): void {
    day.hide();
    night = startNight(d.scene, d.canvas, d.root, {
      night: k === N.ENDLESS && N.endlessOpen(city) ? N.ENDLESS : Math.min(k, N.nextNight(city)),
      seed: d.newSeed(),
      powers: N.cityPowers(city),
      onAim: () => measure.beamMoved(),
      onSound: (s) => audio.play(s),
      onOver(n) {
        measure.nightEnded(n.night, n.wave, n.phase === "won" ? "won" : "lost");
        measure.save();
        const r = N.dawn(city, n);
        if (r.ok) {
          city = N.dailyAfterNight(r.city, n, Date.now() / 1000);
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

  // What the city made while you were away (the device's clock, given to the rules), at each return.
  const arrive = () => {
    const r = N.collectAway(city, Date.now() / 1000);
    city = r.city;
    keep();
    if (r.gained.wood > 0 || r.gained.fish > 0) {
      d.toast(`While you were away: ${r.gained.wood} wood and ${r.gained.fish} fish.`);
      if (day.shown) showDay();
    }
  };
  document.addEventListener("visibilitychange", () => !document.hidden && arrive());
  arrive();

  d.showLevels(city.buildings);
  if (city.played === 0) begin();
  else showDay();
  return { city: () => city };
}
