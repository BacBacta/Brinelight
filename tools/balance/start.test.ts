/**
 * The early start's measures (docs/tasks/early-start.md): the soft transition's times, and what the quests waited on.
 */
import { describe, expect, it } from "vitest";
import { HOUR, upgradeTime } from "@brinelight/shared";
import { TRANSITION, finishedWithin, questPath, secondDay, transitionCap } from "./start.js";

const MIN = 60;

describe("the soft transition (measured, not in the game)", () => {
  it("caps the Lighthouse's levels 6 to 9 at 45 min, 1 h 30, 3 h and 5 h; the others by their share, to 5 minutes", () => {
    expect([6, 7, 8, 9].map((l) => transitionCap("lighthouse", l))).toEqual([45 * MIN, 90 * MIN, 3 * HOUR, 5 * HOUR]);
    expect([5, 10].map((l) => transitionCap("lighthouse", l))).toEqual([null, null]);
    // The Barracks' level 6 takes 6 h 05 against the Lighthouse's 4 h 02: 45 min × 1.51, about 1 h 10.
    expect(transitionCap("barracks", 6)).toBe(70 * MIN);
    for (const l of [6, 7, 8, 9]) expect(transitionCap("refinery", l)! % (5 * MIN)).toBe(0);
    expect(TRANSITION.duration!("lighthouse", 6, upgradeTime("lighthouse", 5))).toBe(45 * MIN);
    expect(TRANSITION.duration!("lighthouse", 10, upgradeTime("lighthouse", 9))).toBe(upgradeTime("lighthouse", 9));
  });
});

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
