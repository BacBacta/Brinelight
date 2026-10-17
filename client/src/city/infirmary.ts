/**
 * The Infirmary sheet, as in the prototype: its beds, then the wounded by type, the beds in use, the share of the
 * battle losses saved, and the button that heals them all, or the healing under way. Pure: tested without a browser.
 */
import { canHeal, healCost, hospitalCapacity, maxLevel, totalTroops, woundedSaved, type Buildings } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { TROOP_NAMES, TROOP_TYPES } from "../sea/text.js";
import { actionButton, box, keyValues, kv } from "../ui/components.js";
import { ICONS } from "../ui/icons.js";
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
  return keyValues(kv("Beds", hospitalCapacity(level)) + (next ? kv(`At level ${level + 1}`, hospitalCapacity(level + 1)) : ""));
}

export function infirmaryHtml(state: PlayerState, speed: number): string {
  const w = state.wounded;
  const n = totalTroops(w);
  const job = state.healing;
  const check = canHeal({ infirmary: state.buildings.infirmary, wounded: w, busy: job !== null, stock: state.stock });
  const rows =
    TROOP_TYPES.map((k) => kv(`${ICONS[k]}${TROOP_NAMES[k]}`, w[k], "with-icon")).join("") +
    kv("Beds in use", `${n} / ${hospitalCapacity(state.buildings.infirmary)}`) +
    kv("Battle losses saved", `${Math.round(woundedSaved(state.techs.stretchers ?? 0) * 100)}%`);
  let action: string;
  if (job) action = `<p class="p in-progress">Healing: ${totalTroops(job.wounded)} soldiers · ${formatTimeLeft(job.left / speed)}</p>`;
  else if (n > 0)
    action =
      actionButton(`Heal ${n} wounded · ${formatAmount(healCost(n).fish!)} fish`, check, "green", "heal", ' style="margin-top:8px;width:100%"');
  else action = `<p class="p" style="margin-top:6px">${INFIRMARY_TEXT.none}</p>`;
  return box(`${ICONS.wounded}Wounded`, `${keyValues(rows)}${action}<p class="p" style="font-size:12px;margin-top:6px">${INFIRMARY_TEXT.note}</p>`, "", "with-icon");
}
