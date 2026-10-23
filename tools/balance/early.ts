/**
 * The early-game study (docs/studies/early-game.md): how long a new city takes to reach each Lighthouse level up to
 * 10, and what holds each level back. Pure: it reads what a run of the balance's simulator gave (`early-run.ts` plays
 * them), and writes the study's tables. It changes no value of the rules.
 */
import { DAY, HOUR, upgradeCost, upgradeTime, type BuildingId, type Cost, type Resource } from "@brinelight/shared";
import type { Finished, LighthouseTry, Variant } from "./early-rules.js";

const MIN = 60;

/** Where a Lighthouse level's wait went, in real seconds: building it, waiting for the player, short of resources. */
export type LevelSplit = {
  level: number;
  /** When it was reached, in seconds after the city was founded. */
  reached: number;
  build: number;
  away: number;
  short: number;
  /** What it lacked at the sessions it could not start, and in how many sessions. */
  lacked: Partial<Record<Resource, number>>;
};

const RESOURCES: readonly Resource[] = ["oil", "fish", "wood", "rope"];

/** The resources a cost lacks in a stock. */
export const lacking = (stock: Record<Resource, number>, cost: Cost): Resource[] => RESOURCES.filter((k) => stock[k] < (cost[k] ?? 0));

/**
 * Splits the time between two Lighthouse levels, from a run: `reached` in hours after the founding (the simulator's
 * `lighthouse`), the city's clock at the founding, and every try to start the Lighthouse. From the level reached to
 * the next: the player away until the first session after it, then short of resources until the session it started
 * (the Lighthouse comes first at every session: only the resources hold it back), then its build.
 */
export function splitLevels(reached: Record<number, number>, founded: number, tries: readonly LighthouseTry[], upTo: number): LevelSplit[] {
  const out: LevelSplit[] = [];
  for (let level = 3; level <= upTo; level++) {
    if (reached[level] === undefined || reached[level - 1] === undefined) break;
    const before = founded + reached[level - 1]! * HOUR;
    const mine = tries.filter((t) => t.level === level && t.clock >= before - 1e-6);
    const first = mine[0];
    const ok = mine.find((t) => t.ok);
    if (!first || !ok) break;
    const lacked: Partial<Record<Resource, number>> = {};
    const sessions = new Set<number>();
    for (const t of mine) {
      if (t.ok || sessions.has(t.clock)) continue;
      sessions.add(t.clock);
      for (const k of lacking(t.stock, upgradeCost("lighthouse", level - 1))) lacked[k] = (lacked[k] ?? 0) + 1;
    }
    out.push({ level, reached: reached[level]! * HOUR, build: upgradeTime("lighthouse", level - 1), away: first.clock - before, short: ok.clock - first.clock, lacked });
  }
  return out;
}

/** "1 h 38", "48 min", "2 d 5 h": a duration as a player reads it. */
export function duration(seconds: number): string {
  const m = Math.round(seconds / MIN);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h} h ${String(m % 60).padStart(2, "0")}` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

const short = (c: Cost) => Object.entries(c).map(([k, v]) => `${v.toLocaleString("en-US")} ${k}`).join(" + ");

/**
 * Whiteout Survival's Furnace build times, levels 2 to 10, as the wostools.net wiki gives them (read on 23 October
 * 2026; a players' wiki, not the game's own figures). Its first levels finish in under a minute.
 */
export const GENRE_FURNACE: Readonly<Record<number, string>> = { 2: "under 1 min", 3: "1 min", 4: "3 min", 5: "10 min", 6: "30 min", 7: "1 h", 8: "2 h 30", 9: "4 h 30", 10: "6 h" };

/** The table of the Lighthouse's levels 1 to 10, the rules alone, beside the genre's Furnace. */
export function rulesTable(upTo = 10): string {
  const rows = [
    "| Level | Cost of the level (from the one before) | Build time | Total build time from level 2 | Whiteout Survival's Furnace |",
    "| --- | --- | --- | --- | --- |",
    "| 1 | (none) | (none) | | |",
  ];
  let total = 0;
  for (let level = 2; level <= upTo; level++) {
    const note = level === 2 ? " (every city starts at level 2)" : "";
    const time = upgradeTime("lighthouse", level - 1);
    if (level > 2) total += time;
    rows.push(`| ${level} | ${short(upgradeCost("lighthouse", level - 1))}${note} | ${duration(time)} | ${level > 2 ? duration(total) : ""} | ${GENRE_FURNACE[level] ?? ""} |`);
  }
  return rows.join("\n");
}

/** Where each level's time went, for one profile. */
export function splitTable(splits: readonly LevelSplit[]): string {
  const rows = [
    "| Level | Reached (after the founding) | Since the level before | Building it | Waiting for you | Short of resources | What it lacked (sessions) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const s of splits) {
    const lacked = Object.entries(s.lacked).map(([k, n]) => `${k} ${n}`).join(", ") || "nothing";
    rows.push(`| ${s.level} | ${duration(s.reached)} (day ${(s.reached / DAY).toFixed(1)}) | ${duration(s.build + s.away + s.short)} | ${duration(s.build)} | ${duration(s.away)} | ${duration(s.short)} | ${lacked} |`);
  }
  return rows.join("\n");
}

/** What a player who stays from the founding sees finish, up to `within` seconds after it. */
export function firstSession(finished: readonly Finished[], founded: number, within: number): string {
  const seen = finished.filter((f) => f.clock - founded <= within);
  if (seen.length === 0) return "nothing finishes";
  return seen.map((f) => `${f.id} ${f.level} at ${duration(f.clock - founded)}`).join("; ");
}

/** One option, played by the first-hour player and the balance's three players. */
export type OptionResult = {
  variant: Variant | null;
  /** What the first-hour player sees finish in the first hour, and their Lighthouse after 1 h and after 24 h. */
  firstHour: string;
  lighthouseAfter1h: number;
  lighthouseAfter24h: number;
  /** By profile: the Lighthouse levels reached, in hours after the founding. */
  reached: Record<string, Record<number, number>>;
};

/** The days each profile reached Lighthouse 5, 10, 15, 20, 25 and 30 in week 6 (`tools/balance/balance.test.ts`). */
export const WEEK_6: Readonly<Record<string, Readonly<Record<number, number>>>> = {
  casual: { 5: 1.1, 10: 7.6, 15: 26.0, 20: 63.0, 25: 152.4, 30: 371.4 },
  regular: { 5: 1.1, 10: 5.8, 15: 19.7, 20: 52.6, 25: 122.7, 30: 321.4 },
  dedicated: { 5: 1.1, 10: 5.7, 15: 17.5, 20: 45.2, 25: 119.4, 30: 325.8 },
};

/** The share a day differs from week 6's, rounded to the percent. */
const versus = (day: number, week6: number) => {
  const p = Math.round(((day - week6) / week6) * 100);
  return `${p > 0 ? "+" : ""}${p} %`;
};

/** The first hour of each option. */
export function firstHourTable(results: readonly OptionResult[]): string {
  const rows = ["| Option | What finishes in the first hour | Lighthouse after 1 h | after 24 h |", "| --- | --- | --- | --- |"];
  for (const r of results) rows.push(`| ${r.variant?.name ?? "The rules today"} | ${r.firstHour} | ${r.lighthouseAfter1h} | ${r.lighthouseAfter24h} |`);
  return rows.join("\n");
}

/** Each option's Lighthouse milestones by profile, against week 6; and whether 15 to 30 stay within 10 % of it. */
export function optionsTable(results: readonly OptionResult[], profiles: readonly { id: string; name: string }[]): string {
  const rows = [
    "| Option | Profile | Lighthouse 3 | 4 | 5 | 6 | 10 | 15 | 20 | 25 | 30 | 15 to 30 within 10 % of week 6 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of results) {
    for (const p of profiles) {
      const reached = r.reached[p.id]!;
      const hours = [3, 4, 5, 6].map((l) => duration(reached[l]! * HOUR));
      const days = [10, 15, 20, 25, 30].map((l) => `day ${(reached[l]! / 24).toFixed(1)} (${versus(reached[l]! / 24, WEEK_6[p.id]![l]!)})`);
      const within = [15, 20, 25, 30].every((l) => Math.abs(reached[l]! / 24 - WEEK_6[p.id]![l]!) / WEEK_6[p.id]![l]! <= 0.1);
      rows.push(`| ${r.variant?.name ?? "The rules today"} | ${p.name} | ${[...hours, ...days].join(" | ")} | ${within ? "yes" : "**no**"} |`);
    }
  }
  return rows.join("\n");
}

/**
 * The study's options: none changes a rule; each is what the simulator plays in place of the rules, for the study.
 * Never a reward, never anything for sale: every new city gets them, and only at the start.
 */
/** Option A: the longest an upgrade to these levels takes, every building (the Lighthouse's level 3 in 2 min, its 5 in 15). */
export const QUICK_TIMES: Readonly<Record<number, number>> = { 1: 1 * MIN, 2: 1 * MIN, 3: 2 * MIN, 4: 5 * MIN, 5: 15 * MIN };
/** The same curve on to level 9, measured to show why A stops at 5. */
export const QUICK_TIMES_TO_9: Readonly<Record<number, number>> = { ...QUICK_TIMES, 6: 45 * MIN, 7: 90 * MIN, 8: 3 * HOUR, 9: 6 * HOUR };

/** Option B: the first days' harvest, the island's production this many times while the Lighthouse is below this level. */
export const HARVEST = { times: 3, below: 6 };

/** Option C: a richer start, what a new city starts with in place of 520 wood, 380 oil and 420 fish. */
export const RICH_START = { wood: 2000, oil: 1400, fish: 800 };

const quick: Variant["duration"] = (_id, level, seconds) => Math.min(seconds, QUICK_TIMES[level] ?? Infinity);
const quick9: Variant["duration"] = (_id, level, seconds) => Math.min(seconds, QUICK_TIMES_TO_9[level] ?? Infinity);
const harvest: Variant["production"] = (s) => (s.buildings.lighthouse < HARVEST.below ? HARVEST.times : 1);

export const VARIANTS: readonly Variant[] = [
  // Every building's levels up to 5 take at most the time of this curve (close to Whiteout Survival's Furnace); from 6, unchanged.
  { id: "quick", name: "A. Quick first levels", duration: quick },
  { id: "harvest", name: "B. The first days' harvest", production: harvest },
  { id: "start", name: "C. A richer start", start: RICH_START },
  { id: "quick+start", name: "A + C", duration: quick, start: RICH_START },
  { id: "all", name: "A + B + C", duration: quick, production: harvest, start: RICH_START },
  // Measured, not proposed: the quick curve on to level 9.
  { id: "quick9", name: "A to level 9 (not proposed)", duration: quick9 },
];
