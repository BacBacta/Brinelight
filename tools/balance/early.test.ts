/**
 * The early-game study (docs/studies/early-game.md): its rules are the shared ones until a variant says otherwise, and
 * its tables say what the runs gave.
 */
import { afterEach, describe, expect, it } from "vitest";
import * as rules from "@brinelight/shared";
import { HOUR, upgradeTime } from "@brinelight/shared";
import { advance, applyAction, newPlayerState, study } from "./early-rules.js";
import { QUICK_TIMES, RICH_START, VARIANTS, duration, rulesTable, splitLevels } from "./early.js";

const variant = (id: string) => VARIANTS.find((v) => v.id === id)!;
const upgrade = (building: rules.BuildingId) => ({ id: "00000000-0000-4000-8000-000000000001", type: "upgrade" as const, building });

afterEach(() => {
  study.variant = null;
  study.tries = [];
  study.finished = [];
});

describe("the study's rules", () => {
  it("are the shared rules without a variant", () => {
    const s = newPlayerState(8 * HOUR);
    expect(s).toEqual(rules.newPlayerState(8 * HOUR));
    expect(applyAction(s, upgrade("lighthouse"))).toEqual(rules.applyAction(s, upgrade("lighthouse")));
    expect(advance(s, 5 * HOUR)).toEqual(rules.advance(s, 5 * HOUR));
  });

  it("A: an upgrade to a level up to 5 takes at most its quick time; from 6, the rules' time", () => {
    study.variant = variant("quick");
    const s = newPlayerState(8 * HOUR);
    const r = applyAction(s, upgrade("lighthouse"));
    expect(r.ok && r.state.queue.at(-1)).toEqual({ id: "lighthouse", left: QUICK_TIMES[3], duration: QUICK_TIMES[3] });
    const at6 = { ...s, buildings: { ...s.buildings, lighthouse: 5 }, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 10 } };
    const r6 = applyAction(at6, upgrade("lighthouse"));
    expect(r6.ok && r6.state.queue.at(-1)!.duration).toBe(upgradeTime("lighthouse", 5));
    // Every try to start the Lighthouse is written down, with the stock it had.
    expect(study.tries.map((t) => [t.level, t.ok])).toEqual([[3, true], [6, true]]);
  });

  it("B: three times the buildings' production below Lighthouse 6; C: the richer start", () => {
    const s = rules.newPlayerState(8 * HOUR);
    study.variant = variant("harvest");
    const more = advance(s, HOUR);
    const plain = rules.advance(s, HOUR);
    expect(more.stock.wood - s.stock.wood).toBeCloseTo(3 * (plain.stock.wood - s.stock.wood), 6);
    study.variant = variant("start");
    expect(newPlayerState(8 * HOUR).stock).toMatchObject(RICH_START);
  });
});

describe("the study's tables", () => {
  it("say a duration as a player reads it", () => {
    expect([duration(90), duration(48 * 60), duration(5905), duration(3 * HOUR), duration(65 * HOUR)]).toEqual(["2 min", "48 min", "1 h 38", "3 h", "2 d 17 h"]);
    expect(rulesTable()).toContain("| 3 | 350 wood + 240 oil | 2 min | 2 min | 1 min |");
  });

  it("split a level's time into its build, the player away, and the resources it lacked", () => {
    const founded = 8 * HOUR;
    const build3 = upgradeTime("lighthouse", 2);
    const build4 = upgradeTime("lighthouse", 3);
    const stock = { oil: 500, fish: 400, wood: 200, rope: 3 };
    const tries = [
      { clock: founded, level: 3, ok: true, reason: null, stock },
      { clock: founded + 5 * HOUR, level: 4, ok: false, reason: "Not enough resources", stock },
      { clock: founded + 5 * HOUR, level: 4, ok: false, reason: "Not enough resources", stock },
      { clock: founded + 13 * HOUR, level: 4, ok: true, reason: null, stock },
    ];
    const reached = { 2: 0, 3: build3 / HOUR, 4: 13 + build4 / HOUR };
    const [three, four] = splitLevels(reached, founded, tries, 10);
    expect(three).toEqual({ level: 3, reached: build3, build: build3, away: 0, short: 0, lacked: {} });
    expect(four).toEqual({ level: 4, reached: 13 * HOUR + build4, build: build4, away: 5 * HOUR - build3, short: 8 * HOUR, lacked: { wood: 1 } });
  });
});
