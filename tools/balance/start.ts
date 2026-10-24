/**
 * The early start, A + C, measured (docs/tasks/early-start.md): the first hour, the quests 1 to 9 and what they wait
 * on, and the second day. Pure: it reads
 * what runs of the balance's simulator gave (`start-run.ts` plays them) and writes the tables. It changes no rule.
 */
import { DAY, HOUR, OBJECTIVES } from "@brinelight/shared";
import type { Claim, Finished, OtherJob, Started } from "./early-rules.js";
import { duration } from "./early.js";

const MIN = 60;

/** How many upgrades finished in the first `minutes` after the founding. */
export const finishedWithin = (finished: readonly Finished[], founded: number, minutes: number): number =>
  finished.filter((f) => f.clock - founded <= minutes * MIN).length;

/** The second day (the calendar day after the founding's): what finished, and the longest upgrade started that day. */
export function secondDay(finished: readonly Finished[], started: readonly Started[]): { finished: number; longest: Started | null } {
  const inDay2 = (clock: number) => clock >= DAY && clock < 2 * DAY;
  const day2 = started.filter((s) => inDay2(s.clock));
  const longest = day2.reduce<Started | null>((a, s) => (!a || s.seconds > a.seconds ? s : a), null);
  return { finished: finished.filter((f) => inDay2(f.clock)).length, longest };
}

/** One quest of the path: when it was claimed, how long after the one before, and the uncapped work it waited on. */
export type QuestStep = { objective: number; text: string; claimed: number; after: number; waitedOn: OtherJob | null };

/** When a work did what a quest counts: a fleet when it arrives (a camp is beaten on arrival), any other when it ends. */
const doneAt = (j: OtherJob): number | null => j.arrive ?? j.end;

/**
 * The first `count` quests, as an attentive player claims them (a session every minute). A quest waited on an uncapped
 * work when that work was done in the minute before the quest was claimed, after the quest before it was claimed.
 */
export function questPath(claims: readonly Claim[], jobs: readonly OtherJob[], founded: number, count: number): QuestStep[] {
  const steps: QuestStep[] = [];
  let before = founded;
  for (const c of claims.filter((x) => x.objective < count).sort((a, b) => a.objective - b.objective)) {
    const done = (j: OtherJob) => doneAt(j);
    const waitedOn = jobs.filter((j) => done(j) !== null && done(j)! > before && done(j)! <= c.clock && c.clock - done(j)! <= MIN).sort((a, b) => done(b)! - b.start - (done(a)! - a.start))[0] ?? null;
    steps.push({ objective: c.objective, text: OBJECTIVES[c.objective]!.text, claimed: c.clock - founded, after: c.clock - before, waitedOn });
    before = c.clock;
  }
  return steps;
}

/** The uncapped works longer than `longer` seconds started before `until`, longest first. */
export const longWorks = (jobs: readonly OtherJob[], until: number, longer = 15 * MIN): OtherJob[] =>
  jobs.filter((j) => j.start <= until && (j.end ?? Infinity) - j.start > longer).sort((a, b) => (b.end ?? Infinity) - b.start - ((a.end ?? Infinity) - a.start));

export const at = (seconds: number, founded: number): string => duration(seconds - founded);
export const hoursOf = (reached: Record<number, number>, level: number): string => (reached[level] === undefined ? "–" : duration(reached[level]! * HOUR));
