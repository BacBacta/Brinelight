import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DAY, HOUR, newPlayerState, parseState, upgradeCost, upgradeTime, type PlayerState } from "@brinelight/shared";
import { FOUNDED, PROFILES, missing, reserve, simulate, simulateAll, wallAt } from "./simulate.js";
import { DAYS, MARK_END, MARK_START, toCsv, toMarkdown, toSvg } from "./report.js";

const docs = fileURLToPath(new URL("../../docs/", import.meta.url));
const [casual, regular, dedicated] = PROFILES as [(typeof PROFILES)[number], (typeof PROFILES)[number], (typeof PROFILES)[number]];
const runs = simulateAll(DAYS);

describe("the balance simulation", () => {
  it("gives the same result at every run: no clock, no randomness", () => {
    const a = simulate(regular, 12);
    const b = simulate(regular, 12);
    expect(b).toEqual(a);
    expect(toCsv([b])).toBe(toCsv([a]));
  });

  it("plays only with the rules: every city it makes is a city the server would read", () => {
    for (const r of [...runs, simulate(dedicated, 3), simulate(casual, 20)]) {
      expect(parseState(JSON.parse(JSON.stringify(r.last))), r.profile.id).not.toBeNull();
    }
    // A new city is its own: the simulation never changes the starting values.
    expect(newPlayerState()).toEqual(newPlayerState());
  });

  it("3, 6 and 10 sessions a day; the city is founded on day 1 at 8:00, in the first one", () => {
    expect(FOUNDED).toBe(8 * HOUR);
    for (const [profile, count] of [[casual, 3], [regular, 6], [dedicated, 10]] as const) {
      expect(profile.sessions).toHaveLength(count);
      const r = runs.find((x) => x.profile.id === profile.id)!;
      expect(r.days).toHaveLength(DAYS);
      expect(r.days.every((d) => d.sessions === count), profile.id).toBe(true);
    }
    expect(dedicated.sessions.at(-1)).toBe(22 * HOUR);
  });

  it("the Lighthouse's milestones match the days: a level counts from the hour its work ends", () => {
    for (const r of runs) {
      const levels = Object.entries(r.lighthouse).map(([k, h]) => [Number(k), h] as const).sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < levels.length; i++) expect(levels[i]![1]).toBeGreaterThan(levels[i - 1]![1]);
      for (const d of r.days) {
        const hoursAtMidnight = (d.day * DAY - FOUNDED) / HOUR;
        const reached = Math.max(...levels.filter(([, h]) => h <= hoursAtMidnight).map(([k]) => k));
        expect(d.lighthouse, `${r.profile.id} day ${d.day}`).toBe(reached);
      }
      // The first level built takes the rules' own time.
      expect(r.lighthouse[3]).toBeCloseTo(upgradeTime("lighthouse", 2) / HOUR, 6);
    }
  });

  it("names what blocks: the resource a cost lacks the most, the wall of the storage, the Lighthouse's reserve", () => {
    expect(missing({ oil: 100, fish: 0, wood: 900, rope: 0 }, { wood: 1000, oil: 400 })).toBe("oil");
    expect(missing({ oil: 500, fish: 0, wood: 900, rope: 0 }, { wood: 1000, oil: 400 })).toBe("wood");
    expect(missing({ oil: 500, fish: 0, wood: 1000, rope: 0 }, { wood: 1000, oil: 400 })).toBeNull();
    const at12: PlayerState = { ...newPlayerState(), buildings: { ...newPlayerState().buildings, lighthouse: 12 }, techs: { warehouses: 3 } };
    expect(wallAt(at12)).toEqual({ resource: "wood", cost: upgradeCost("lighthouse", 12).wood, storage: 45675 });
    expect(wallAt(newPlayerState())).toBeNull();
    // While the Lighthouse waits, the rest keeps its next cost, up to what the storage holds; while it is built, nothing.
    expect(reserve(at12)).toEqual({ wood: 45675, oil: upgradeCost("lighthouse", 12).oil });
    expect(reserve({ ...at12, queue: [{ id: "lighthouse", left: 10, duration: 10 }] })).toEqual({});
  });

  it("writes one CSV row per profile and day, a chart with one line per profile, and the tables between their markers", () => {
    const csv = toCsv(runs).trimEnd().split("\n");
    expect(csv).toHaveLength(1 + 3 * DAYS);
    const width = csv[0]!.split(",").length;
    expect(csv[1]!.startsWith("casual,1,")).toBe(true);
    expect(width).toBeGreaterThan(30);
    expect(toSvg(runs).match(/<polyline /g)).toHaveLength(3);
    const md = toMarkdown(runs);
    expect(md.startsWith(MARK_START) && md.endsWith(MARK_END)).toBe(true);
    expect(md).toContain("### Day 30");
    expect(md).toContain("### Day 60");
  });

  it("the committed CSV, chart and tables are those the rules give today (npm run balance writes them again)", () => {
    expect(readFileSync(`${docs}balance/days.csv`, "utf8")).toBe(toCsv(runs));
    expect(readFileSync(`${docs}balance/lighthouse.svg`, "utf8")).toBe(toSvg(runs));
    const doc = readFileSync(`${docs}balance.md`, "utf8");
    expect(doc.slice(doc.indexOf(MARK_START), doc.indexOf(MARK_END) + MARK_END.length)).toBe(toMarkdown(runs));
  });
});
