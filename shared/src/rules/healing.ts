import { OK, canPay, emptyTroops, payCost, refuse, totalTroops, type Check, type Cost, type Stock, type Troops } from "./types.js";
import { protoSeconds } from "./time.js";

/** What healing one wounded costs (prototype: 2 fish). */
export const HEAL_COST: Readonly<Cost> = { fish: 2 };

/** The cost of healing `count` wounded. */
export const healCost = (count: number): Cost => ({ fish: HEAL_COST.fish! * count });
/** Real duration (seconds) of healing `count` wounded (prototype: n × 0.12 + 2 seconds). */
export const healTime = (count: number): number => protoSeconds(count * 0.12 + 2);

/** Share of the battle losses saved as wounded when the Infirmary has room: 50%, +10% per Stretcher Bearers level. */
export const woundedSaved = (stretchers: number): number => 0.5 + 0.1 * stretchers;

/**
 * The healing at the Infirmary: one at a time, all the wounded of the moment at once. They leave the beds when it
 * starts, so new wounded can take them. `left` and `duration` in real seconds.
 */
export type HealingJob = { wounded: Troops; left: number; duration: number };

export function canHeal(ctx: { infirmary: number; wounded: Troops; busy: boolean; stock: Stock }): Check {
  if (ctx.infirmary < 1) return refuse("Build the Infirmary first");
  const count = totalTroops(ctx.wounded);
  if (count === 0) return refuse("No wounded to heal");
  if (ctx.busy) return refuse("Healing is already underway");
  if (!canPay(ctx.stock, healCost(count))) return refuse("Not enough resources");
  return OK;
}

export type StartHealing = { ok: true; stock: Stock; wounded: Troops; healing: HealingJob } | { ok: false; reason: string };

/** Starts healing every wounded in the Infirmary: checked with canHeal, paid at once; the beds are free again. */
export function startHealing(ctx: { infirmary: number; wounded: Troops; stock: Stock; healing: HealingJob | null }): StartHealing {
  const check = canHeal({ infirmary: ctx.infirmary, wounded: ctx.wounded, busy: ctx.healing !== null, stock: ctx.stock });
  if (!check.ok) return check;
  const count = totalTroops(ctx.wounded);
  const duration = healTime(count);
  return { ok: true, stock: payCost(ctx.stock, healCost(count)), wounded: emptyTroops(), healing: { wounded: { ...ctx.wounded }, left: duration, duration } };
}

/** Advances the healing by `seconds` real seconds; once done, the healed soldiers join the troops in the city. */
export function advanceHealing(troops: Troops, job: HealingJob | null, seconds: number): { troops: Troops; healing: HealingJob | null } {
  if (!job) return { troops, healing: null };
  if (job.left > Math.max(0, seconds)) return { troops, healing: { ...job, left: job.left - Math.max(0, seconds) } };
  return {
    troops: { boarders: troops.boarders + job.wounded.boarders, harpooners: troops.harpooners + job.wounded.harpooners, crossbowmen: troops.crossbowmen + job.wounded.crossbowmen },
    healing: null,
  };
}
