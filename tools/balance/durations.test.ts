import { describe, expect, it } from "vitest";
import { BUILDING_IDS, HOUR, QUICK_LEVELS, upgradeTime } from "@brinelight/shared";
import { BANDS, CURVES, GROUPS, LEVELS, betweenSessions, curveTime, nextSession, todayTime, wholeCity } from "./durations.js";

const MIN = 60;
const DAY = 24 * HOUR;

describe("today's times", () => {
  it("are the rules' own, level by level, and the buildings of a group share them", () => {
    for (const id of BUILDING_IDS) for (const level of LEVELS) expect(todayTime(id, level)).toBe(upgradeTime(id, level - 1));
    for (const g of GROUPS) for (const id of g.ids) for (const level of LEVELS) expect(todayTime(id, level)).toBe(todayTime(g.ids[0]!, level));
  });
});

describe("the study's curves", () => {
  for (const c of CURVES) {
    describe(c.name, () => {
      const time = (id: (typeof BUILDING_IDS)[number], level: number) => curveTime(c, id, level);

      it("keeps levels 1 to 5 as they are (1, 1, 2, 5 and 15 minutes)", () => {
        for (const id of BUILDING_IDS) for (let level = 1; level <= 5; level++) expect(time(id, level)).toBe(QUICK_LEVELS[level]);
      });

      it("rises at every level, and less and less from 5 → 6 on: no cliff", () => {
        for (const id of BUILDING_IDS) {
          // 4 → 5 is ×3: 5 → 6 rises no more.
          let before = 3;
          for (let level = 6; level <= 30; level++) {
            const r = time(id, level) / time(id, level - 1);
            expect(r, `${id} ${level}`).toBeGreaterThan(1);
            expect(r, `${id} ${level}`).toBeLessThanOrEqual(before + 1e-3);
            before = r;
          }
        }
      });

      it("keeps the Lighthouse the longest of its level, then the Barracks' group, the Shelters' group and the producers", () => {
        for (let level = 6; level <= 30; level++) {
          const [lighthouse, producers, shelters, barracks] = GROUPS.map((g) => time(g.ids[0]!, level));
          expect(lighthouse!, String(level)).toBeGreaterThan(barracks!);
          expect(barracks!, String(level)).toBeGreaterThan(shelters!);
          expect(shelters!, String(level)).toBeGreaterThan(producers!);
        }
      });

      it("fits the player's day: levels 6 to 10 within a day's sessions, the last ones in days, never weeks", () => {
        expect(time("refinery", 6)).toBeGreaterThanOrEqual(30 * MIN);
        expect(time("lighthouse", 10)).toBeLessThanOrEqual(3.5 * HOUR);
        for (const id of BUILDING_IDS) expect(time(id, 30)).toBeLessThan(7 * DAY);
        for (const id of BUILDING_IDS.filter((b) => b !== "lighthouse")) expect(time(id, 30)).toBeLessThanOrEqual(5 * DAY);
      });
    });
  }

  it("the bands are those of the owner's request", () => {
    expect(BANDS).toEqual([
      { from: 6, to: 10 },
      { from: 11, to: 20 },
      { from: 21, to: 30 },
    ]);
  });
});

describe("what the study reads from a run", () => {
  const sessions = [8 * HOUR, 13 * HOUR, 21 * HOUR];

  it("the next session: later the same day, or the next morning", () => {
    expect(nextSession(8 * HOUR, sessions)).toBe(13 * HOUR);
    expect(nextSession(21 * HOUR, sessions)).toBe(DAY + 8 * HOUR);
    expect(nextSession(3 * DAY + 22 * HOUR, sessions)).toBe(4 * DAY + 8 * HOUR);
  });

  it("a build ended before the next session, and how long its builder then waited", () => {
    const r = betweenSessions(
      [
        { clock: 8 * HOUR, level: 7, seconds: 2 * HOUR },
        { clock: 13 * HOUR, level: 8, seconds: 9 * HOUR },
        { clock: 21 * HOUR, level: 12, seconds: 10 * HOUR },
      ],
      sessions,
    );
    expect(r[0]).toMatchObject({ builds: 2, before: 1, wait: 3 * HOUR });
    expect(r[1]).toMatchObject({ builds: 1, before: 1, wait: HOUR });
    expect(r[2]).toMatchObject({ builds: 0, before: 0 });
  });

  it("the whole city: every level added up, and two builders never quicker than the Lighthouse alone", () => {
    const one = wholeCity((id, level) => (id === "lighthouse" ? 10 : level === 1 ? 1 : 0));
    expect(one.total).toBe(300 + 8);
    expect(one.lighthouse).toBe(300);
    expect(one.twoBuilders).toBe(300);
  });
});
