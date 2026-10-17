/**
 * The training part of the Barracks sheet, as in the prototype: the three troop types (their icon, and the soldiers in your city),
 * what each one beats, a "+N" button for a batch of the Barracks' size, and the cost per soldier. Below it, the veterans:
 * soldiers and veterans by type, with a "Promote 10" button, or what they need.
 * Pure: tested without a browser.
 */
import {
  BEATS,
  PROMOTE_BARRACKS,
  PROMOTE_COST,
  PROMOTE_COUNT,
  TECHS,
  TRAIN_COST,
  VETERAN_WEIGHT,
  canPromote,
  canTrain,
  techLevel,
  trainBatch,
  trainingName,
  type TroopType,
} from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { TROOP_NAMES, TROOP_TYPES } from "../sea/text.js";
import { ICONS } from "../ui/icons.js";
import { formatTimeLeft } from "./format.js";

/** The prototype's colors for each troop type. */
export const TROOP_COLORS: Record<TroopType, string> = { boarders: "#E2572F", harpooners: "#3BC6FF", crossbowmen: "#6BE07A" };

export const TRAINING_TEXT = {
  cost: `Cost: ${TRAIN_COST.fish} fish and ${TRAIN_COST.wood} wood per soldier.`,
  /** The prototype's words. */
  veterans: `One veteran is worth ${VETERAN_WEIGHT} soldiers. Promoting ${PROMOTE_COUNT} soldiers costs ${PROMOTE_COST.fish} fish and ${PROMOTE_COST.oil} oil.`,
  locked: `You need the ${TECHS.veterans.name} research at the Observatory and Barracks at level ${PROMOTE_BARRACKS}.`,
} as const;

export function trainingHtml(state: PlayerState, speed: number): string {
  const n = trainBatch(state.buildings.barracks);
  const job = state.training;
  const check = canTrain({ barracks: state.buildings.barracks, busy: job !== null, stock: state.stock });
  const rows = TROOP_TYPES.map((k) => {
    const c = TROOP_COLORS[k];
    return (
      `<div class="it" data-troop-row="${k}"><div class="ph troop" style="background:${c}33;color:${c}">${ICONS[k]}<b>${state.troops[k]}</b></div>` +
      `<div class="tt"><b>${TROOP_NAMES[k]}</b><small>Beat ${TROOP_NAMES[BEATS[k]].toLowerCase()}</small></div>` +
      // Still tappable when refused: the tap shows the reason in a toast, as for an upgrade.
      `<button class="b sm" data-act="train" data-troop="${k}" aria-disabled="${!check.ok}">+${n}</button></div>`
    );
  }).join("");
  return (
    `<div class="box"><h4>Train</h4>` +
    (job ? `<p class="p in-progress">In progress: ${trainingName(job)} · ${formatTimeLeft(job.left / speed)}</p>` : "") +
    `<div class="list">${rows}</div>` +
    `<p class="p" style="font-size:12px;margin-top:6px">${TRAINING_TEXT.cost}</p>` +
    (check.ok || job ? "" : `<p class="why">${check.reason}</p>`) +
    `</div>` +
    veteransHtml(state)
  );
}

/** The veterans box of the Barracks, as in the prototype's: open with the Veteran Doctrine and the Barracks at level 3. */
export function veteransHtml(state: PlayerState): string {
  const head = `<div class="box vets"><h4 class="with-icon">${ICONS.veteran}Veterans</h4>`;
  if (techLevel(state.techs, "veterans") < 1 || state.buildings.barracks < PROMOTE_BARRACKS) {
    return `${head}<p class="p" style="font-size:12px">${TRAINING_TEXT.locked}</p></div>`;
  }
  const rows = TROOP_TYPES.map((k) => {
    const check = canPromote(k, { barracks: state.buildings.barracks, techs: state.techs, busy: state.training !== null, troops: state.troops, stock: state.stock });
    return (
      `<div class="it" style="padding:6px 10px" data-vet-row="${k}"><div class="tt"><b>${TROOP_NAMES[k]}</b><small>${state.troops[k]} soldiers · ${state.veterans[k]} veterans</small></div>` +
      // Still tappable when refused: the tap shows the reason in a toast, as for training.
      `<button class="b sm" data-act="promote" data-troop="${k}" aria-disabled="${!check.ok}">Promote ${PROMOTE_COUNT}</button></div>`
    );
  }).join("");
  return `${head}<p class="p" style="font-size:12px">${TRAINING_TEXT.veterans}</p><div class="list" style="margin-top:6px">${rows}</div></div>`;
}
