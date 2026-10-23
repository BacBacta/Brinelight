import { OK, canPay, payCost, refuse, type Check, type Cost, type Stock, type TroopType, type Troops } from "./types.js";
import { techLevel, type Techs } from "./research.js";
import { EARLY_TRAINING, earlyCapped } from "./early.js";
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
/** The time a batch takes in a city: at most 5 minutes while its Lighthouse is below level 6 (the early start). */
export const trainDuration = (count: number, lighthouse: number): number => earlyCapped(trainTime(count), EARLY_TRAINING, lighthouse);

/** Soldiers promoted at once (prototype: 10). */
export const PROMOTE_COUNT = 10;
/** What a promotion costs (prototype: 60 fish and 40 oil). */
export const PROMOTE_COST: Readonly<Cost> = { fish: 60, oil: 40 };
/** Real duration (seconds) of a promotion (prototype: 6 seconds). */
export const PROMOTE_TIME = protoSeconds(6);
/** Barracks level needed to promote veterans, with the Veteran Doctrine research. */
export const PROMOTE_BARRACKS = 3;

/**
 * The work at the Barracks: one at a time, a batch of new soldiers (`kind: "train"`) or ten soldiers promoted to
 * veterans (`kind: "promote"`), as in the prototype's single slot. `left` and `duration` in real seconds.
 */
export type TrainingJob = { kind: "train" | "promote"; troop: TroopType; count: number; left: number; duration: number };

/** "10 veteran boarders" or "20 boarders": what the Barracks is working on, as the queue and the sheet name it. */
export const trainingName = (job: Pick<TrainingJob, "kind" | "troop" | "count">): string =>
  `${job.count} ${job.kind === "promote" ? "veteran " : ""}${job.troop}`;

/** Can you promote 10 soldiers of this type now? The refusals keep the prototype's words. */
export function canPromote(troop: TroopType, ctx: { barracks: number; techs: Techs; busy: boolean; troops: Troops; stock: Stock }): Check {
  if (techLevel(ctx.techs, "veterans") < 1 || ctx.barracks < PROMOTE_BARRACKS) {
    return refuse("You need the Veteran Doctrine research at the Observatory and Barracks at level 3.");
  }
  if (ctx.busy) return refuse("Training is already underway");
  if (ctx.troops[troop] < PROMOTE_COUNT) return refuse(`You need ${PROMOTE_COUNT} ${troop} to promote.`);
  if (!canPay(ctx.stock, PROMOTE_COST)) return refuse("Not enough resources");
  return OK;
}

export type StartPromotion = { ok: true; stock: Stock; troops: Troops; training: TrainingJob } | { ok: false; reason: string };

/** Promotes 10 soldiers of one type: they leave your troops at once, paid at once, and come back as veterans. */
export function startPromotion(
  troop: TroopType,
  ctx: { barracks: number; techs: Techs; troops: Troops; stock: Stock; training: TrainingJob | null },
): StartPromotion {
  const check = canPromote(troop, { barracks: ctx.barracks, techs: ctx.techs, busy: ctx.training !== null, troops: ctx.troops, stock: ctx.stock });
  if (!check.ok) return check;
  return {
    ok: true,
    stock: payCost(ctx.stock, PROMOTE_COST),
    troops: { ...ctx.troops, [troop]: ctx.troops[troop] - PROMOTE_COUNT },
    training: { kind: "promote", troop, count: PROMOTE_COUNT, left: PROMOTE_TIME, duration: PROMOTE_TIME },
  };
}

export function canTrain(ctx: { barracks: number; busy: boolean; stock: Stock }): Check {
  if (ctx.barracks < 1) return refuse("Build the Barracks first");
  if (ctx.busy) return refuse("Training is already underway");
  if (!canPay(ctx.stock, trainCost(trainBatch(ctx.barracks)))) return refuse("Not enough resources");
  return OK;
}

export type StartTraining = { ok: true; stock: Stock; training: TrainingJob } | { ok: false; reason: string };

/** Starts a batch of soldiers of one type: checked with canTrain, paid at once. The batch is set by the Barracks' level now. */
export function startTraining(troop: TroopType, ctx: { barracks: number; lighthouse: number; stock: Stock; training: TrainingJob | null }): StartTraining {
  const check = canTrain({ barracks: ctx.barracks, busy: ctx.training !== null, stock: ctx.stock });
  if (!check.ok) return check;
  const count = trainBatch(ctx.barracks);
  const duration = trainDuration(count, ctx.lighthouse);
  return { ok: true, stock: payCost(ctx.stock, trainCost(count)), training: { kind: "train", troop, count, left: duration, duration } };
}

/**
 * Advances the work at the Barracks by `seconds` real seconds; once done, the new soldiers join the troops in the city,
 * or the promoted ones its veterans. Never a fleet at sea.
 */
export function advanceTraining(
  army: { troops: Troops; veterans: Troops },
  job: TrainingJob | null,
  seconds: number,
): { troops: Troops; veterans: Troops; training: TrainingJob | null } {
  const { troops, veterans } = army;
  if (!job) return { troops, veterans, training: null };
  if (job.left > Math.max(0, seconds)) return { troops, veterans, training: { ...job, left: job.left - Math.max(0, seconds) } };
  if (job.kind === "promote") return { troops, veterans: { ...veterans, [job.troop]: veterans[job.troop] + job.count }, training: null };
  return { troops: { ...troops, [job.troop]: troops[job.troop] + job.count }, veterans, training: null };
}
