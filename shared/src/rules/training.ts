import { OK, canPay, payCost, refuse, type Check, type Cost, type Stock, type TroopType, type Troops } from "./types.js";
import { protoSeconds } from "./time.js";

/** Soldiers in one batch, per Barracks level (prototype: level × 20). */
export const TRAIN_PER_LEVEL = 20;
/** What one soldier costs (prototype: 3 fish and 2 wood). */
export const TRAIN_COST: Readonly<Cost> = { fish: 3, wood: 2 };

/** The batch the Barracks trains at this level. */
export const trainBatch = (barracks: number): number => Math.max(0, barracks) * TRAIN_PER_LEVEL;
/** The cost of `count` soldiers. */
export const trainCost = (count: number): Cost => ({ fish: TRAIN_COST.fish! * count, wood: TRAIN_COST.wood! * count });
/** Real duration (seconds) of a batch of `count` soldiers (prototype: n × 0.25 + 3 seconds). */
export const trainTime = (count: number): number => protoSeconds(count * 0.25 + 3);

/**
 * The work at the Barracks: one at a time. Today a batch of new soldiers (`kind: "train"`); the same slot
 * will take the promotion of veterans later, with its own kind. `left` and `duration` in real seconds.
 */
export type TrainingJob = { kind: "train"; troop: TroopType; count: number; left: number; duration: number };

export function canTrain(ctx: { barracks: number; busy: boolean; stock: Stock }): Check {
  if (ctx.barracks < 1) return refuse("Build the Barracks first");
  if (ctx.busy) return refuse("Training is already underway");
  if (!canPay(ctx.stock, trainCost(trainBatch(ctx.barracks)))) return refuse("Not enough resources");
  return OK;
}

export type StartTraining = { ok: true; stock: Stock; training: TrainingJob } | { ok: false; reason: string };

/** Starts a batch of soldiers of one type: checked with canTrain, paid at once. The batch is set by the Barracks' level now. */
export function startTraining(troop: TroopType, ctx: { barracks: number; stock: Stock; training: TrainingJob | null }): StartTraining {
  const check = canTrain({ barracks: ctx.barracks, busy: ctx.training !== null, stock: ctx.stock });
  if (!check.ok) return check;
  const count = trainBatch(ctx.barracks);
  const duration = trainTime(count);
  return { ok: true, stock: payCost(ctx.stock, trainCost(count)), training: { kind: "train", troop, count, left: duration, duration } };
}

/** Advances the work at the Barracks by `seconds` real seconds; once done, the soldiers join the troops in the city. */
export function advanceTraining(troops: Troops, job: TrainingJob | null, seconds: number): { troops: Troops; training: TrainingJob | null } {
  if (!job) return { troops, training: null };
  if (job.left > Math.max(0, seconds)) return { troops, training: { ...job, left: job.left - Math.max(0, seconds) } };
  return { troops: { ...troops, [job.troop]: troops[job.troop] + job.count }, training: null };
}
