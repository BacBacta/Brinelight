import { netRates } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { ICONS, resourceIcon } from "./icons.js";
import { FULL_AT, ROLL_MS, cityPower, fillRatio, longAmount, mistText, rateText, rolled, shortAmount, survivorsText } from "./values.js";
import type { SeaMood } from "../scene/look.js";

const RESOURCES = ["oil", "fish", "wood"] as const;
const NAMES = { oil: "Oil", fish: "Fish", wood: "Driftwood" } as const;

/** The top bar (Lighthouse level, Power, resources, Pearls) and the line under it (survivors, morale, Mist). */
export function createHud(root: HTMLElement, onProfile?: () => void, mood: SeaMood = "calm") {
  const hud = document.createElement("header");
  hud.className = "hud";
  hud.innerHTML =
    `<div class="card lvl" role="button" tabindex="0" aria-label="Profile"><div class="av">${ICONS.lighthouse}<i data-k="level"></i></div><div><small>Power</small><b data-k="power"></b></div></div>` +
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
  // The Power card opens the Profile: sign in with your wallet, or sign out.
  const card = hud.querySelector<HTMLElement>(".lvl")!;
  card.addEventListener("click", () => onProfile?.());
  card.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && onProfile?.());

  const q = <T extends HTMLElement>(el: HTMLElement, sel: string) => el.querySelector<T>(sel)!;
  const set = (el: HTMLElement, text: string) => {
    if (el.textContent !== text) el.textContent = text;
  };
  const pills = RESOURCES.map((k) => {
    const el = q(hud, `[data-r="${k}"]`);
    return { k, el, v: q(el, ".v"), rate: q(el, "small"), fill: q(el, ".fill i") };
  });
  const pearls = q(hud, '[data-k="pearls"]');

  /**
   * The amounts shown, which roll to their new value after an action (ROLL_MS); production only ticks them. `target`
   * is the amount of the city, `from` and `start` the roll under way, if any.
   */
  const amounts = [...pills.map((p) => ({ el: p.v, target: 0, shown: 0 })), { el: pearls, target: 0, shown: 0 }];
  let roll: { start: number; from: number[] } | null = null;
  let rollNext = false;
  const write = (now: number) => {
    amounts.forEach((a, i) => {
      a.shown = roll ? rolled(roll.from[i]!, a.target, now - roll.start) : a.target;
      set(a.el, shortAmount(a.shown));
    });
  };
  const step = (now: number) => {
    if (!roll) return;
    write(now);
    if (now - roll.start < ROLL_MS) requestAnimationFrame(step);
    else roll = null;
  };

  return {
    /** A small mark on the Power card while signed in. */
    signedIn(on: boolean) {
      card.classList.toggle("signed", on);
    },
    /** The next change of the amounts rolls (after an action), unless motion is reduced on this device. */
    roll() {
      rollNext = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
    update(state: PlayerState) {
      set(q(hud, '[data-k="level"]'), String(state.buildings.lighthouse));
      set(q(hud, '[data-k="power"]'), longAmount(cityPower(state)));
      const rates = netRates(state);
      for (const p of pills) {
        const amount = state.stock[p.k];
        const f = fillRatio(state, amount);
        set(p.rate, rateText(rates[p.k]));
        p.fill.style.width = `${(f * 100).toFixed(1)}%`;
        p.el.classList.toggle("full", f >= FULL_AT);
        p.el.classList.toggle("neg", rates[p.k] < 0);
      }
      const targets = [...pills.map((p) => state.stock[p.k]), state.pearls];
      if (rollNext && targets.some((t, i) => t !== amounts[i]!.target)) {
        rollNext = false;
        roll = { start: performance.now(), from: amounts.map((a) => a.shown) };
        requestAnimationFrame(step);
      }
      amounts.forEach((a, i) => (a.target = targets[i]!));
      if (!roll) write(performance.now());
      set(q(sub, '[data-k="surv"]'), survivorsText(state));
      q(sub, '[data-k="morale-bar"]').style.width = `${Math.min(100, Math.max(0, state.morale))}%`;
      set(q(sub, '[data-k="morale"]'), `${Math.round(state.morale)}%`);
      set(q(sub, '[data-k="mist"]'), mistText(state, mood));
    },
  };
}
