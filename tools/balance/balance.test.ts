import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DAY, HOUR, newPlayerState, parseState, upgradeCost, upgradeTime, type PlayerState } from "@brinelight/shared";
import { FOUNDED, MORE_PROFILES, PROFILES, missing, reserve, simulate, simulateAll, wallAt } from "./simulate.js";
import { DAYS, MARK_END, MARK_START, toCsv, toMarkdown, toSvg } from "./report.js";

const docs = fileURLToPath(new URL("../../docs/", import.meta.url));
const [casual, regular, dedicated] = PROFILES as [(typeof PROFILES)[number], (typeof PROFILES)[number], (typeof PROFILES)[number]];
const runs = simulateAll(DAYS);
const more = MORE_PROFILES.map((p) => simulate(p, DAYS));

describe("the balance simulation", () => {
  it("gives the same result at every run: no clock, no randomness", () => {
    const a = simulate(regular, 12);
    const b = simulate(regular, 12);
    expect(b).toEqual(a);
    expect(toCsv([b])).toBe(toCsv([a]));
  });

  it("plays only with the rules: every city it makes is a city the server would read", () => {
    for (const r of [...runs, ...more, simulate(dedicated, 3), simulate(casual, 20)]) {
      expect(parseState(JSON.parse(JSON.stringify(r.last))), r.profile.id).not.toBeNull();
    }
    // A new city is its own: the simulation never changes the starting values.
    expect(newPlayerState()).toEqual(newPlayerState());
  });

  it("a player who keeps the reserve only on what a spending uses upgrades the Lumberyard while the Lighthouse waits for wood", () => {
    // Day 2 of the regular player: the whole reserve held, the Lumberyard (fish and oil) waits with the Lighthouse's wood.
    const held = simulate({ ...regular, holdWholeReserve: true }, 2).days[1]!;
    const spent = simulate(regular, 2).days[1]!;
    expect(spent.buildings.lumberyard).toBeGreaterThan(held.buildings.lumberyard);
  });

  it("a player who keeps no reserve for the Lighthouse spends what the Lighthouse would wait for, and reaches it later", () => {
    // Ten days of the regular player: every spending goes ahead, the other buildings climb, the Lighthouse falls behind.
    const free = simulate({ ...regular, noReserve: true }, 10);
    const kept = simulate(regular, 10);
    const others = (d: (typeof kept.days)[number]) => Object.entries(d.buildings).reduce((n, [id, l]) => (id === "lighthouse" ? n : n + l), 0);
    expect(others(free.days.at(-1)!)).toBeGreaterThan(others(kept.days.at(-1)!));
    expect(free.days.at(-1)!.buildings.lighthouse).toBeLessThan(kept.days.at(-1)!.buildings.lighthouse);
  });

  it("a player who never goes to sea sends no fleet: no salvage, no camp beaten", () => {
    const island = simulate({ ...regular, noSea: true }, 10);
    expect(island.days.every((d) => d.salvages === 0 && d.campsBeaten === 0)).toBe(true);
    expect(island.hunts.joined).toBe(0);
    expect(island.last.fleets).toEqual([]);
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

  it("plays the rules of week 7: the Mist stoked, the Leviathan hunted, every objective and chest claimed; two more players", () => {
    const reg = runs.find((r) => r.profile.id === "regular")!;
    expect(reg.mists.held).toBeGreaterThan(3 * (DAYS - 2));
    expect(reg.hunts.joined).toBeGreaterThan(DAYS);
    expect(reg.claims.objectives).toBe(19);
    expect(reg.claims.chests).toBeGreaterThan(DAYS);
    expect(reg.pearls.mist).toBe(30 * reg.mists.held);
    const [never, away] = more as [(typeof more)[number], (typeof more)[number]];
    // Never stokes: the order off from the first session, every Mist missed.
    expect(never.last.mist.stoke).toBe(false);
    expect(never.mists.held).toBe(0);
    expect(never.mists.missed).toBeGreaterThan(3 * (DAYS - 2));
    // Away: no session on days 20, 21 and 22; what it finds on day 23 is told.
    expect(away.days.slice(19, 22).map((d) => d.sessions)).toEqual([0, 0, 0]);
    expect(away.days[22]!.sessions).toBe(6);
    expect(away.returned?.day).toBe(23);
  });

  // The casual player reaches Lighthouse 30 after a year: its run goes on a little longer.
  const long = [...runs.filter((r) => r.profile.id !== "casual"), simulate(casual, 380)];

  it("keeps every Lighthouse milestone within 10 % of the reference of 24 October (the slower build times and the costs past 15, owner's decisions)", () => {
    // The days each profile reaches Lighthouse 5, 10, 15, 20, 25 and 30 with the quick first levels and the richer start
    // (docs/tasks/early-start.md), the producers' curve and the isles and shoals (E, docs/studies/resources.md), the
    // slower curve of build times (docs/studies/durations.md), the costs past level 15 (docs/studies/costs.md), the
    // players keeping the Lighthouse's reserve only on what a spending uses: the reference since 24 October.
    const REFERENCE: Record<string, Record<number, number>> = {
      casual: { 5: 0.6, 10: 4.1, 15: 15.5, 20: 40.4, 25: 100.7, 30: 246.6 },
      regular: { 5: 0.2, 10: 2.5, 15: 9.0, 20: 26.8, 25: 72.8, 30: 183.9 },
      dedicated: { 5: 0.1, 10: 2.2, 15: 8.4, 20: 23.5, 25: 65.1, 30: 162.8 },
    };
    for (const r of long) {
      for (const [level, reference] of Object.entries(REFERENCE[r.profile.id]!)) {
        const day = r.lighthouse[Number(level)]! / 24;
        // Lighthouse 5 comes within the first day: there, 10 % of a day.
        expect(Math.abs(day - reference) / Math.max(reference, 1), `${r.profile.id}, Lighthouse ${level}: day ${day.toFixed(1)}, reference ${reference}`).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it("never brings Lighthouse 15 to 30 later than week 6 (E and the slower build times bring them sooner, owner's decisions)", () => {
    // The days each profile reached them with the rules of week 6 (commit c307f9f). The limit of 18 October (within
    // 10 %) gave way to A + C, then to E and the slower build times: the owner took the new days as the reference
    // (docs/decisions.md).
    const WEEK_6: Record<string, Record<number, number>> = {
      casual: { 15: 26.0, 20: 63.0, 25: 152.4, 30: 371.4 },
      regular: { 15: 19.7, 20: 52.6, 25: 122.7, 30: 321.4 },
      dedicated: { 15: 17.5, 20: 45.2, 25: 119.4, 30: 325.8 },
    };
    for (const r of long) {
      for (const [level, week6] of Object.entries(WEEK_6[r.profile.id]!)) {
        const day = r.lighthouse[Number(level)]! / 24;
        expect(day, `${r.profile.id}, Lighthouse ${level}: day ${day.toFixed(1)}, week 6 ${week6}`).toBeLessThanOrEqual(week6);
      }
    }
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
    const at = (lighthouse: number, warehouses = 0): PlayerState => ({ ...newPlayerState(), buildings: { ...newPlayerState().buildings, lighthouse }, techs: { warehouses } });
    // The storage holds the Lighthouse's next level at every level: no wall left (there was one from Lighthouse 11 before 18 October).
    for (let level = 2; level < 30; level++) for (const wh of [0, 3]) expect(wallAt(at(level, wh)), `Lighthouse ${level}`).toBeNull();
    // While the Lighthouse waits, the rest keeps its next cost, up to what the storage holds; while it is built, nothing.
    expect(reserve(at(12, 3))).toEqual(upgradeCost("lighthouse", 12));
    expect(reserve({ ...at(12, 3), queue: [{ id: "lighthouse", left: 10, duration: 10 }] })).toEqual({});
    // At its last level, the Lighthouse keeps nothing back and meets no wall.
    expect(reserve(at(30, 3))).toEqual({});
    expect(wallAt(at(30))).toBeNull();
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
    expect(md).toContain("### Day 90");
    expect(md).toContain("### Day 365");
  });

  it("the committed CSV, chart and tables are those the rules give today (npm run balance writes them again)", () => {
    expect(readFileSync(`${docs}balance/days.csv`, "utf8")).toBe(toCsv(runs));
    expect(readFileSync(`${docs}balance/lighthouse.svg`, "utf8")).toBe(toSvg(runs));
    const doc = readFileSync(`${docs}balance.md`, "utf8");
    expect(doc.slice(doc.indexOf(MARK_START), doc.indexOf(MARK_END) + MARK_END.length)).toBe(toMarkdown(runs, more));
  });
});
