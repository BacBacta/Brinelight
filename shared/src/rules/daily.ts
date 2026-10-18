/**
 * Daily tasks (week 7, task 4): a fixed list of tasks with points, counted by the rules as you play, and five chests
 * you open with the points. Everything resets at 00:00 UTC on the city's clock (provisional, as the Mist's hours).
 * Points are counted alone; only the chests are claimed (action `claimChest`). No task asks you to be online at a fixed
 * hour: the Mist's is held by the order to stoke, which works offline.
 */
import type { Reward } from "./objectives.js";
import { DAY } from "./time.js";
import { OK, refuse, type Check } from "./types.js";

export type DailyTaskId = "upgrades" | "gathers" | "camps" | "trains" | "mists" | "research";

/** The tasks of a day: 110 points, so one can be skipped. A task gives its points once its goal is reached. */
export const DAILY_TASKS: readonly { id: DailyTaskId; text: string; goal: number; points: number }[] = [
  { id: "upgrades", text: "Start 3 upgrades", goal: 3, points: 30 },
  { id: "gathers", text: "Gather at sea 3 times", goal: 3, points: 20 },
  { id: "camps", text: "Beat 2 pirate camps", goal: 2, points: 20 },
  { id: "trains", text: "Train troops", goal: 1, points: 10 },
  { id: "mists", text: "Keep the Lighthouse stoked through a Mist", goal: 1, points: 20 },
  { id: "research", text: "Start a research", goal: 1, points: 10 },
];

/** The chests, by the points that open them. */
export const CHESTS = [20, 40, 60, 80, 100] as const;
export type Chest = (typeof CHESTS)[number];

/**
 * What a chest gives. The first two grow with the Lighthouse: 300 wood and 300 fish, then 400 oil, × its level / 5;
 * then 100 Pearls, 400 oil and 2 rope, 200 Pearls.
 */
export function chestReward(chest: Chest, lighthouse: number): Reward {
  const grown = (n: number) => Math.round((n * lighthouse) / 5);
  switch (chest) {
    case 20:
      return { wood: grown(300), fish: grown(300) };
    case 40:
      return { oil: grown(400) };
    case 60:
      return { pearls: 100 };
    case 80:
      return { oil: 400, rope: 2 };
    case 100:
      return { pearls: 200 };
  }
}

/** A day of daily tasks: its number (days since 1970, UTC), what was done that day, the chests opened. */
export type DailyState = { day: number; counts: Record<DailyTaskId, number>; chests: Chest[] };

/** The day of a clock: whole days since 1 January 1970, UTC. */
export const dayOf = (clock: number): number => Math.floor(clock / DAY);

/** Seconds from `clock` to the next 00:00 UTC: always more than 0. */
export const untilMidnight = (clock: number): number => (dayOf(clock) + 1) * DAY - clock;

export function startingDaily(clock: number): DailyState {
  return { day: dayOf(clock), counts: { upgrades: 0, gathers: 0, camps: 0, trains: 0, mists: 0, research: 0 }, chests: [] };
}

/** The daily tasks as they stand at `clock`: a new day starts empty. */
export const dailyOn = (d: DailyState, clock: number): DailyState => (d.day === dayOf(clock) ? d : startingDaily(clock));

/** Counts `n` more of a task at `clock`, on that day. */
export function countDaily(d: DailyState, clock: number, task: DailyTaskId, n = 1): DailyState {
  const today = dailyOn(d, clock);
  return n > 0 ? { ...today, counts: { ...today.counts, [task]: today.counts[task] + n } } : today;
}

/** The points of a day: each task whose goal is reached gives its points. */
export const dailyPoints = (d: DailyState): number => DAILY_TASKS.reduce((p, t) => p + (d.counts[t.id] >= t.goal ? t.points : 0), 0);

/** Can you open this chest now? Enough points today, and not opened yet today. */
export function canOpenChest(d: DailyState, clock: number, chest: Chest): Check {
  const today = dailyOn(d, clock);
  if (today.chests.includes(chest)) return refuse("You already opened this chest today");
  if (dailyPoints(today) < chest) return refuse("Not enough points yet");
  return OK;
}
