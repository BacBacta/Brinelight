/**
 * The Lighthouse milestones a saved city reached and that are not recorded yet (week 9, task 2). Pure: the server
 * compares the city it had stored with the one it saves, and records what this gives, to be sealed on Solana.
 */
import { LIGHTHOUSE_MILESTONES, lighthouseFact, proofDay, type ProofWhen } from "../rules/proofs.js";
import type { PlayerState } from "./types.js";

export type Milestone = { fact: string; when: ProofWhen; day: string };

/**
 * Each milestone at or under `after`'s Lighthouse whose fact is not in `recorded`, in the order of the levels.
 * - The level that `before`'s Lighthouse upgrade gave: `on` the day its work ended (`before`'s clock plus the time it
 *   had left), never after `saveDay`.
 * - Any other (passed before the milestones were recorded): `by` `saveDay`, the day of the save, as we do not know
 *   the day it was reached.
 */
export function milestonesReached(before: PlayerState, after: PlayerState, recorded: ReadonlySet<string>, saveDay: string): Milestone[] {
  const was = before.buildings.lighthouse;
  const job = before.queue.find((j) => j.id === "lighthouse");
  const out: Milestone[] = [];
  for (const level of LIGHTHOUSE_MILESTONES) {
    const fact = lighthouseFact(level);
    if (level > after.buildings.lighthouse || recorded.has(fact)) continue;
    if (job && level === was + 1) {
      const ended = proofDay(before.clock + job.left);
      out.push({ fact, when: "on", day: ended < saveDay ? ended : saveDay });
    } else out.push({ fact, when: "by", day: saveDay });
  }
  return out;
}
