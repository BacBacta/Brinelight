/**
 * The training part of the Barracks sheet, as in the prototype: the three troop types with the soldiers in your city,
 * what each one beats, a "+N" button for a batch of the Barracks' size, and the cost per soldier.
 * Pure: tested without a browser.
 */
import { BEATS, TRAIN_COST, canTrain, trainBatch, type TroopType } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { TROOP_NAMES, TROOP_TYPES } from "../sea/text.js";
import { formatTimeLeft } from "./format.js";

/** The prototype's colors for each troop type. */
export const TROOP_COLORS: Record<TroopType, string> = { boarders: "#E2572F", harpooners: "#3BC6FF", crossbowmen: "#6BE07A" };

/** "20 boarders": a batch, as the queue and the sheet name it. */
export const batchName = (count: number, troop: TroopType): string => `${count} ${TROOP_NAMES[troop].toLowerCase()}`;

export const TRAINING_TEXT = {
  cost: `Cost: ${TRAIN_COST.fish} fish and ${TRAIN_COST.wood} wood per soldier.`,
} as const;

export function trainingHtml(state: PlayerState, speed: number): string {
  const n = trainBatch(state.buildings.barracks);
  const job = state.training;
  const check = canTrain({ barracks: state.buildings.barracks, busy: job !== null, stock: state.stock });
  const rows = TROOP_TYPES.map((k) => {
    const c = TROOP_COLORS[k];
    return (
      `<div class="it" data-troop-row="${k}"><div class="ph" style="background:${c}33;color:${c}">${state.troops[k]}</div>` +
      `<div class="tt"><b>${TROOP_NAMES[k]}</b><small>Beat ${TROOP_NAMES[BEATS[k]].toLowerCase()}</small></div>` +
      // Still tappable when refused: the tap shows the reason in a toast, as for an upgrade.
      `<button class="b sm" data-act="train" data-troop="${k}" aria-disabled="${!check.ok}">+${n}</button></div>`
    );
  }).join("");
  return (
    `<div class="box"><h4>Train</h4>` +
    (job ? `<p class="p in-progress">In progress: ${batchName(job.count, job.troop)} · ${formatTimeLeft(job.left / speed)}</p>` : "") +
    `<div class="list">${rows}</div>` +
    `<p class="p" style="font-size:12px;margin-top:6px">${TRAINING_TEXT.cost}</p>` +
    (check.ok || job ? "" : `<p class="why">${check.reason}</p>`) +
    `</div>`
  );
}
