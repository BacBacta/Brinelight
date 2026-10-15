import { netRates } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { ICONS, resourceIcon } from "./icons.js";
import { FULL_AT, cityPower, fillRatio, longAmount, mistText, rateText, shortAmount, survivorsText } from "./values.js";

const RESOURCES = ["oil", "fish", "wood"] as const;
const NAMES = { oil: "Oil", fish: "Fish", wood: "Driftwood" } as const;

/** The top bar (Lighthouse level, Power, resources, Pearls) and the line under it (survivors, morale, Mist). */
export function createHud(root: HTMLElement) {
  const hud = document.createElement("header");
  hud.className = "hud";
  hud.innerHTML =
    `<div class="card lvl"><div class="av">${ICONS.lighthouse}<i data-k="level"></i></div><div><small>Power</small><b data-k="power"></b></div></div>` +
    `<div class="res">` +
    RESOURCES.map((k) => `<div class="pill" data-r="${k}" title="${NAMES[k]}">${resourceIcon(k)}<span class="v"></span><small></small><i class="fill"><i></i></i></div>`).join("") +
    `<div class="pill" title="Pearls, earned by playing">${resourceIcon("pearl")}<span class="v" data-k="pearls"></span></div>` +
    `</div>`;
  const sub = document.createElement("div");
  sub.className = "sub";
  sub.innerHTML =
    `<div class="card mor" title="Survivors and morale"><span class="ic surv">${ICONS.survivor}</span><span data-k="surv"></span><div class="bar"><i data-k="morale-bar"></i></div><span data-k="morale"></span></div>` +
    `<div class="card brume"><span data-k="mist"></span></div>`;
  root.append(hud, sub);

  const q = <T extends HTMLElement>(el: HTMLElement, sel: string) => el.querySelector<T>(sel)!;
  const set = (el: HTMLElement, text: string) => {
    if (el.textContent !== text) el.textContent = text;
  };
  const pills = RESOURCES.map((k) => {
    const el = q(hud, `[data-r="${k}"]`);
    return { k, el, v: q(el, ".v"), rate: q(el, "small"), fill: q(el, ".fill i") };
  });

  return {
    update(state: PlayerState) {
      set(q(hud, '[data-k="level"]'), String(state.buildings.lighthouse));
      set(q(hud, '[data-k="power"]'), longAmount(cityPower(state)));
      const rates = netRates(state);
      for (const p of pills) {
        const amount = state.stock[p.k];
        const f = fillRatio(state, amount);
        set(p.v, shortAmount(amount));
        set(p.rate, rateText(rates[p.k]));
        p.fill.style.width = `${(f * 100).toFixed(1)}%`;
        p.el.classList.toggle("full", f >= FULL_AT);
        p.el.classList.toggle("neg", rates[p.k] < 0);
      }
      set(q(hud, '[data-k="pearls"]'), shortAmount(state.pearls));
      set(q(sub, '[data-k="surv"]'), survivorsText(state));
      q(sub, '[data-k="morale-bar"]').style.width = `${Math.min(100, Math.max(0, state.morale))}%`;
      set(q(sub, '[data-k="morale"]'), `${Math.round(state.morale)}%`);
      set(q(sub, '[data-k="mist"]'), mistText(state));
    },
  };
}
