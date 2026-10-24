/**
 * The early start's measures (docs/tasks/early-start.md): what the quests waited on, and the second day.
 */
import { describe, expect, it } from "vitest";
import { HOUR } from "@brinelight/shared";
import { finishedWithin, questPath, secondDay } from "./start.js";

const MIN = 60;

describe("the measures", () => {
  const founded = 8 * HOUR;
  it("count the upgrades finished, and the second day", () => {
    const finished = [
      { clock: founded + 60, id: "barracks" as const, level: 1 },
      { clock: founded + 25 * MIN, id: "lighthouse" as const, level: 5 },
      { clock: 30 * HOUR, id: "refinery" as const, level: 6 },
    ];
    expect([10, 30, 60].map((m) => finishedWithin(finished, founded, m))).toEqual([1, 2, 2]);
    const started = [
      { clock: 30 * HOUR, id: "lighthouse" as const, level: 6, seconds: 4 * HOUR },
      { clock: 31 * HOUR, id: "fishery" as const, level: 6, seconds: 5 * HOUR },
      { clock: 50 * HOUR, id: "harbor" as const, level: 6, seconds: 9 * HOUR },
    ];
    expect(secondDay(finished, started)).toEqual({ finished: 1, longest: started[1] });
  });

  it("a quest waited on an uncapped work done in the minute before its claim; a fleet when it arrives", () => {
    const claims = [
      { clock: founded + 5 * MIN, objective: 0 },
      { clock: founded + 2 * HOUR, objective: 1 },
    ];
    const jobs = [
      { kind: "sea" as const, what: "fleet to camp-1", start: founded + HOUR, end: founded + 3 * HOUR, arrive: founded + 2 * HOUR - 30 },
      { kind: "research" as const, what: "research refining", start: founded, end: founded + HOUR },
    ];
    const path = questPath(claims, jobs, founded, 18);
    expect(path.map((s) => [s.objective, s.after, s.waitedOn?.what ?? null])).toEqual([
      [0, 5 * MIN, null],
      [1, 2 * HOUR - 5 * MIN, "fleet to camp-1"],
    ]);
  });
});
