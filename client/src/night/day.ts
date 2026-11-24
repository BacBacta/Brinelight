/**
 * The Day (Hold the Light): your city between the Nights. Each building says what it does for the Night, its cost, and
 * Upgrade, or why not in the rules' own words; the next Night is always one tap away. Pure where it can be.
 */
import { night as N } from "@brinelight/shared";
import { esc } from "../ui/components.js";
import { ICONS } from "../ui/icons.js";

export const DAY_TEXT = {
  title: "Your city",
  upgrade: "Upgrade",
  build: "Build",
  stock: "In store",
} as const;

const NAMES: Readonly<Record<N.CityBuilding, string>> = { lighthouse: "Lighthouse", refinery: "Refinery", infirmary: "Infirmary" };
const ICON: Readonly<Record<N.CityBuilding, string>> = { lighthouse: ICONS.lighthouse, refinery: ICONS.oil, infirmary: ICONS.wounded };

const pct = (x: number): string => `${Math.round(x * 100)}%`;

/** What a building does for the Night now, and at its next level. */
export function effectLine(b: N.CityBuilding, c: N.PortalCity): string {
  const now = N.cityPowers(c);
  const top = c.buildings[b] >= N.CITY_MAX_LEVEL;
  const next = top ? now : N.cityPowers({ ...c, buildings: { ...c.buildings, [b]: c.buildings[b] + 1 } });
  const to = (a: string, z: string) => (top ? a : `${a} → ${z}`);
  switch (b) {
    case "lighthouse":
      return `Beam: ${to(String(Math.round(now.beamDps)), String(Math.round(next.beamDps)))} a second`;
    case "refinery":
      return `Oil to start: ${to(String(now.startOil), String(next.startOil))}`;
    case "infirmary":
      return c.buildings.infirmary === 0
        ? `Build it: once a Night, the Lighthouse lights again with ${pct(next.rescue)} of its oil`
        : `Second chance: ${to(pct(now.rescue), pct(next.rescue))} of your oil`;
  }
}

/** The Days the guide shows for: a new player's first ones. */
export const GUIDE_DAYS = 3;

const WHY: Readonly<Record<N.CityBuilding, string>> = {
  lighthouse: "Upgrade the Lighthouse: your beam burns harder.",
  refinery: "Upgrade the Refinery: more oil for the Night.",
  infirmary: "Build the Infirmary: a second chance each Night.",
};

/** What to do next, in the first Days: an upgrade you can pay (the Lighthouse first, else the cheapest), or the next Night. */
export function dayGuide(c: N.PortalCity): { target: N.CityBuilding | "night"; text: string } | null {
  if (c.played > GUIDE_DAYS) return null;
  const able = N.CITY_BUILDINGS.filter((b) => N.upgradeCity(c, b).ok);
  if (able.length === 0) return { target: "night", text: "Start the next Night to bring back more." };
  const cost = (b: N.CityBuilding) => {
    const k = N.upgradeCost(b, c.buildings[b]);
    return k.wood + k.fish;
  };
  const pick = able.includes("lighthouse") ? "lighthouse" : able.reduce((a, b) => (cost(b) < cost(a) ? b : a));
  return { target: pick, text: WHY[pick] };
}

function row(b: N.CityBuilding, c: N.PortalCity, guided: boolean): string {
  const level = c.buildings[b];
  const r = N.upgradeCity(c, b);
  const top = level >= N.CITY_MAX_LEVEL;
  const cost = N.upgradeCost(b, level);
  const label = level === 0 ? DAY_TEXT.build : DAY_TEXT.upgrade;
  return (
    `<div class="day-row">${ICON[b]}<div class="txt"><b>${NAMES[b]}${level > 0 ? ` <small>level ${level}</small>` : ""}</b>` +
    `<span>${esc(effectLine(b, c))}</span>` +
    (top ? "" : `<span class="cost">${cost.wood} wood · ${cost.fish} fish</span>`) +
    (r.ok ? "" : `<span class="why">${esc(r.reason)}</span>`) +
    `</div>${top ? "" : `<button class="b ${r.ok ? "gold" : ""}${guided ? " guide" : ""}" data-act="upgrade" data-b="${b}"${r.ok ? "" : " disabled"}>${label}</button>`}</div>`
  );
}

/** The Day's panel: the store, each building, and the next Night. */
export function dayHtml(c: N.PortalCity): string {
  const s = c.stock;
  const g = dayGuide(c);
  return (
    `<div class="day-stock" aria-label="${DAY_TEXT.stock}"><span>${ICONS.wood}<b>${s.wood}</b></span><span>${ICONS.fish}<b>${s.fish}</b></span><span>${ICONS.pearl}<b>${s.pearls}</b></span></div>` +
    `<h2>${DAY_TEXT.title}</h2>` +
    (g ? `<p class="day-guide" role="status">${esc(g.text)}</p>` : "") +
    N.CITY_BUILDINGS.map((b) => row(b, c, g?.target === b)).join("") +
    `<button class="b gold xl day-night${g?.target === "night" ? " guide" : ""}" data-act="night">Start Night ${N.nextNight(c)}</button>`
  );
}

/** The Day on screen. */
export function createDay(root: HTMLElement, actions: { upgrade(b: N.CityBuilding): void; night(): void }) {
  const el = document.createElement("section");
  el.className = "day card";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", DAY_TEXT.title);
  el.hidden = true;
  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
    if (!b || b.disabled) return;
    if (b.dataset.act === "night") actions.night();
    if (b.dataset.act === "upgrade" && b.dataset.b) actions.upgrade(b.dataset.b as N.CityBuilding);
  });
  root.append(el);
  return {
    show(c: N.PortalCity) {
      el.innerHTML = dayHtml(c);
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
    },
    get shown() {
      return !el.hidden;
    },
  };
}
