/**
 * The Infirmary sheet, as in the prototype: its beds, then the wounded by type, the beds in use, the share of the
 * battle losses saved, and the button that heals them all, or the healing under way. Pure: tested without a browser.
 */
import { canHeal, healCost, hospitalCapacity, maxLevel, totalTroops, woundedSaved, type Buildings } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { TROOP_NAMES, TROOP_TYPES } from "../sea/text.js";
import { formatAmount, formatTimeLeft } from "./format.js";

export const INFIRMARY_TEXT = {
  none: "No wounded.",
  note: "With no free bed, the wounded die. The Stretcher Bearers research saves more of them.",
} as const;

/** "Healing · 40 wounded": the queue row. */
export const healingName = (count: number): string => `Healing · ${count} wounded`;

/** The beds of the Infirmary, at its level and at the next one, shown at every level. */
export function bedsHtml(buildings: Buildings): string {
  const level = buildings.infirmary;
  const next = level < maxLevel("infirmary", buildings);
  return `<div class="kv"><span>Beds</span><span>${hospitalCapacity(level)}</span>${next ? `<span>At level ${level + 1}</span><span>${hospitalCapacity(level + 1)}</span>` : ""}</div>`;
}

export function infirmaryHtml(state: PlayerState, speed: number): string {
  const w = state.wounded;
  const n = totalTroops(w);
  const job = state.healing;
  const check = canHeal({ infirmary: state.buildings.infirmary, wounded: w, busy: job !== null, stock: state.stock });
  const kv =
    TROOP_TYPES.map((k) => `<span>${TROOP_NAMES[k]}</span><span>${w[k]}</span>`).join("") +
    `<span>Beds in use</span><span>${n} / ${hospitalCapacity(state.buildings.infirmary)}</span>` +
    `<span>Battle losses saved</span><span>${Math.round(woundedSaved(state.techs.stretchers ?? 0) * 100)}%</span>`;
  let action: string;
  if (job) action = `<p class="p in-progress">Healing: ${totalTroops(job.wounded)} soldiers · ${formatTimeLeft(job.left / speed)}</p>`;
  else if (n > 0)
    action =
      // Still tappable when refused: the tap shows the reason in a toast, as for an upgrade.
      `<button class="b green" data-act="heal" aria-disabled="${!check.ok}" style="margin-top:8px;width:100%">Heal ${n} wounded · ${formatAmount(healCost(n).fish!)} fish</button>` +
      (check.ok ? "" : `<p class="why">${check.reason}</p>`);
  else action = `<p class="p" style="margin-top:6px">${INFIRMARY_TEXT.none}</p>`;
  return `<div class="box"><h4>Wounded</h4><div class="kv">${kv}</div>${action}<p class="p" style="font-size:12px;margin-top:6px">${INFIRMARY_TEXT.note}</p></div>`;
}
