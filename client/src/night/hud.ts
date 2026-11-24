/** The Night's panel (the oil, the wave) and its end (Hold the Light). Text in the player's words; pure where it can be. */
import { night as N } from "@brinelight/shared";
import { esc } from "../ui/components.js";
import { ICONS } from "../ui/icons.js";

export const NIGHT_TEXT = {
  oil: "Oil",
  oilLabel: "Oil: the Lighthouse's life",
  hint: "Turn the light onto the boats. Boats that land steal oil.",
  lost: "The Lighthouse went dark",
  won: "Dawn",
  bring: "You bring back",
  toCity: "To your city",
} as const;

/** What the panel shows of a Night. */
export function hudParts(n: N.NightState): { oil: number; oilText: string; wave: string; next: string; wood: number; fish: number; hint: string } {
  const waves = N.wavesOf(n.night);
  const next = n.phase === "pause" ? `Next wave in ${Math.max(1, Math.ceil((n.pauseEnd - n.step) / N.STEPS_PER_SECOND))} s` : "";
  const earned = N.lootSoFar(n);
  // Night 1 says what to do until the first boat burns: the beam is the whole game, and nothing else explains it.
  const hint = n.night === 1 && n.wave === 1 && n.burned === 0 && n.phase === "wave" ? NIGHT_TEXT.hint : "";
  return { oil: Math.max(0, Math.min(1, n.oil / n.power.startOil)), oilText: String(Math.ceil(n.oil)), wave: `Wave ${Math.min(n.wave, waves)} of ${waves}`, next, wood: earned.wood, fish: earned.fish, hint };
}

/** The end card's inside: the Night won or lost, the waves held, what you bring back, and the way to your city. */
export function endHtml(n: N.NightState, loot: N.Loot): string {
  const waves = N.wavesOf(n.night);
  const won = n.phase === "won";
  const held = won ? `You held all ${waves} waves.` : `You held ${N.wavesCleared(n)} waves of ${waves}.`;
  const items = [`${loot.wood} wood`, `${loot.fish} fish`, ...(loot.pearls > 0 ? [`${loot.pearls} Pearls`] : [])];
  return (
    `<h2>${won ? NIGHT_TEXT.won : NIGHT_TEXT.lost}</h2>` +
    `<p>${esc(held)}</p>` +
    `<p class="bring">${NIGHT_TEXT.bring}: ${items.map(esc).join(" · ")}</p>` +
    `<button class="b gold xl" data-act="done">${NIGHT_TEXT.toCity}</button>`
  );
}

/** The panel and the end card, over the 3D view. */
export function createNightHud(root: HTMLElement, onDone: () => void) {
  const panel = document.createElement("div");
  panel.className = "night-hud";
  panel.innerHTML =
    `<div class="left"><div class="oil" role="meter" aria-label="${NIGHT_TEXT.oilLabel}" title="${NIGHT_TEXT.oilLabel}" aria-valuemin="0">${ICONS.oil}<span class="bar"><i></i><b></b></span></div>` +
    `<div class="earned" aria-label="Earned this Night"><span data-k="wood">${ICONS.wood}<b>0</b></span><span data-k="fish">${ICONS.fish}<b>0</b></span></div></div>` +
    `<div class="wave" aria-live="polite"><b></b><small></small></div>`;
  const hint = document.createElement("p");
  hint.className = "night-hint";
  hint.setAttribute("role", "status");
  const end = document.createElement("section");
  end.className = "night-end card";
  end.setAttribute("role", "dialog");
  end.hidden = true;
  end.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-act=done]")) onDone();
  });
  root.append(panel, hint, end);
  const fill = panel.querySelector<HTMLElement>(".oil i")!;
  const wood = panel.querySelector<HTMLElement>('[data-k="wood"]')!;
  const fish = panel.querySelector<HTMLElement>('[data-k="fish"]')!;
  /** A number that rose flashes once, so the eye sees what a burned boat brought. */
  const count = (el: HTMLElement, value: number) => {
    const b = el.querySelector("b")!;
    if (b.textContent === String(value)) return;
    const rose = value > Number(b.textContent);
    b.textContent = String(value);
    if (rose) {
      el.classList.remove("up");
      void el.offsetWidth;
      el.classList.add("up");
    }
  };
  const oilText = panel.querySelector<HTMLElement>(".oil b")!;
  const meter = panel.querySelector<HTMLElement>(".oil")!;
  const wave = panel.querySelector<HTMLElement>(".wave b")!;
  const next = panel.querySelector<HTMLElement>(".wave small")!;
  let shown = "";
  return {
    update(n: N.NightState) {
      const p = hudParts(n);
      const key = `${p.oilText}|${p.wave}|${p.next}|${n.phase}|${p.wood}|${p.fish}|${p.hint}`;
      if (key === shown) return;
      shown = key;
      fill.style.transform = `scaleX(${p.oil})`;
      oilText.textContent = p.oilText;
      meter.setAttribute("aria-valuenow", p.oilText);
      meter.setAttribute("aria-valuemax", String(n.power.startOil));
      wave.textContent = p.wave;
      next.textContent = p.next;
      count(wood, p.wood);
      count(fish, p.fish);
      hint.textContent = p.hint;
      hint.hidden = !p.hint;
      const over = n.phase === "won" || n.phase === "lost";
      if (over && end.hidden) {
        end.innerHTML = endHtml(n, N.nightLoot(n));
        end.hidden = false;
        end.querySelector<HTMLButtonElement>("[data-act=done]")?.focus();
      } else if (!over) end.hidden = true;
    },
    dispose() {
      panel.remove();
      hint.remove();
      end.remove();
    },
  };
}
