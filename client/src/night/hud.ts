/** The Night's panel (the oil, the wave) and its end (Hold the Light). Text in the player's words; pure where it can be. */
import { night as N } from "@brinelight/shared";
import { esc } from "../ui/components.js";

export const NIGHT_TEXT = {
  oil: "Oil",
  lost: "The Lighthouse went dark",
  won: "Dawn",
  bring: "You bring back",
  again: "Again",
} as const;

/** What the panel shows of a Night. */
export function hudParts(n: N.NightState): { oil: number; oilText: string; wave: string; next: string } {
  const waves = N.wavesOf(n.night);
  const next = n.phase === "pause" ? `Next wave in ${Math.max(1, Math.ceil((n.pauseEnd - n.step) / N.STEPS_PER_SECOND))} s` : "";
  return { oil: Math.max(0, Math.min(1, n.oil / N.START_OIL)), oilText: String(Math.ceil(n.oil)), wave: `Wave ${Math.min(n.wave, waves)} of ${waves}`, next };
}

/** The end card's inside: the Night won or lost, the waves held, the loot, and Again. */
export function endHtml(n: N.NightState, loot: N.Loot): string {
  const waves = N.wavesOf(n.night);
  const won = n.phase === "won";
  const held = won ? `You held all ${waves} waves.` : `You held ${N.wavesCleared(n)} waves of ${waves}.`;
  const items = [`${loot.wood} wood`, `${loot.fish} fish`, ...(loot.pearls > 0 ? [`${loot.pearls} Pearls`] : [])];
  return (
    `<h2>${won ? NIGHT_TEXT.won : NIGHT_TEXT.lost}</h2>` +
    `<p>${esc(held)}</p>` +
    `<p class="bring">${NIGHT_TEXT.bring}: ${items.map(esc).join(" · ")}</p>` +
    `<button class="b gold xl" data-act="again">${NIGHT_TEXT.again}</button>`
  );
}

/** The panel and the end card, over the 3D view. */
export function createNightHud(root: HTMLElement, onAgain: () => void) {
  const panel = document.createElement("div");
  panel.className = "night-hud";
  panel.innerHTML = `<div class="oil" role="meter" aria-label="${NIGHT_TEXT.oil}" aria-valuemin="0" aria-valuemax="${N.START_OIL}"><i></i><b></b></div><div class="wave" aria-live="polite"><b></b><small></small></div>`;
  const end = document.createElement("section");
  end.className = "night-end card";
  end.setAttribute("role", "dialog");
  end.hidden = true;
  end.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-act=again]")) onAgain();
  });
  root.append(panel, end);
  const fill = panel.querySelector<HTMLElement>(".oil i")!;
  const oilText = panel.querySelector<HTMLElement>(".oil b")!;
  const meter = panel.querySelector<HTMLElement>(".oil")!;
  const wave = panel.querySelector<HTMLElement>(".wave b")!;
  const next = panel.querySelector<HTMLElement>(".wave small")!;
  let shown = "";
  return {
    update(n: N.NightState) {
      const p = hudParts(n);
      const key = `${p.oilText}|${p.wave}|${p.next}|${n.phase}`;
      if (key === shown) return;
      shown = key;
      fill.style.transform = `scaleX(${p.oil})`;
      oilText.textContent = p.oilText;
      meter.setAttribute("aria-valuenow", p.oilText);
      wave.textContent = p.wave;
      next.textContent = p.next;
      const over = n.phase === "won" || n.phase === "lost";
      if (over && end.hidden) {
        end.innerHTML = endHtml(n, N.nightLoot(n));
        end.hidden = false;
        end.querySelector<HTMLButtonElement>("[data-act=again]")?.focus();
      } else if (!over) end.hidden = true;
    },
    dispose() {
      panel.remove();
      end.remove();
    },
  };
}
