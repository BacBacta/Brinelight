/**
 * npx tsx tools/balance/durations-run.ts: the durations study (docs/studies/durations.md). Plays the balance's
 * simulator with the rules of `shared/` (E since 23 October), then with each curve of the study, a cost option and the
 * alliance's help, through `durations-hooks.mjs`, and writes the study's tables between its markers. It changes no rule.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import type { Costs, Help, Times } from "./durations-rules.js";

// The simulator gets the study's rules in place of `@brinelight/shared`: registered before it is loaded.
register("./durations-hooks.mjs", import.meta.url);
const { PROFILES, simulate } = await import("./simulate.js");
const R = await import("./durations-rules.js");
const D = await import("./durations.js");
const { BUILDING_IDS, HOUR, TECHS, storeCap, upgradeCost, upgradeTime } = await import("@brinelight/shared");
type Profile = (typeof PROFILES)[number];
type BuildingId = (typeof BUILDING_IDS)[number];

const docs = fileURLToPath(new URL("../../docs/", import.meta.url));
const MARK_START = "<!-- durations:generated:start (npx tsx tools/balance/durations-run.ts) -->";
const MARK_END = "<!-- durations:generated:end -->";
/** Two years: long enough to see the whole city at 30, or that it never gets there. */
const DAYS = 730;
const MILESTONES = [5, 10, 15, 20, 25, 30] as const;

type Setup = { key: string; name: string; time: Times | null; help?: Help; costs?: Costs };

const play = (profile: Profile, setup: Setup) => {
  R.study.time = setup.time;
  R.study.help = setup.help ?? null;
  R.study.costs = setup.costs ?? null;
  R.study.started = [];
  R.study.seen = new Set();
  R.study.builders = {};
  const run = simulate(profile, DAYS);
  const out = { run, started: R.study.started, builders: R.study.builders };
  R.study.time = null;
  R.study.help = null;
  R.study.costs = null;
  return out;
};
type Played = ReturnType<typeof play>;

const fast = D.CURVES.find((c) => c.id === "fast")!;
const slow = D.CURVES.find((c) => c.id === "slow")!;
/** The times before 24 October, the faster curve, and the slower one: the rules' own since (no other times). */
const BEFORE: Setup = { key: "before", name: "Before 24 October", time: D.beforeTime };
const SLOWER: Setup = { key: "slow", name: "Slower (the rules since 24 October)", time: null };
const SETUPS: readonly Setup[] = [BEFORE, { key: "fast", name: "Faster", time: (id, level) => D.curveTime(fast, id, level) }, SLOWER];
/** The cost option, on the slower curve: the other buildings past level 15 cost this much more a level (the rules: 1.6). */
const COSTS: readonly Setup[] = [1.15, 1.1, 1.05].map((growth) => ({ key: `slow-${growth}`, name: `Slower, others ×${growth} a level past 15`, time: null, costs: R.growthPast(15, growth) }));
/** The alliance's help, on the slower curve: 10 allies, 3 minutes each, never more than half the build. */
const HELP: Setup = { key: "slow-help", name: "Slower, with 10 helps of 3 min", time: null, help: { count: 10, minutes: 3 } };

// The rules first: the study's runs with the rules' times must be the balance's own (docs/balance.md, its milestones).
const balance = readFileSync(`${docs}balance.md`, "utf8");
const played = new Map<string, Played>();
for (const s of [...SETUPS, ...COSTS, HELP]) {
  for (const p of PROFILES) {
    const out = play(p, s);
    if (s === SLOWER) {
      const row = balance.split("\n").find((l) => l.startsWith(`| ${p.name} | day `));
      const days = MILESTONES.map((l) => `day ${(out.run.lighthouse[l]! / 24).toFixed(1)}`);
      if (!row || !row.startsWith(`| ${p.name} | ${days.join(" | ")} |`)) throw new Error(`${p.name}: the study's run is not the balance's (${days.join(", ")})`);
    }
    played.set(`${s.key} ${p.id}`, out);
  }
}
const get = (s: Setup, p: Profile) => played.get(`${s.key} ${p.id}`)!;

const timeOf = (time: Times | null) => (id: BuildingId, level: number) => (time ? time(id, level) : upgradeTime(id, level - 1));
const pct = (n: number) => `${Math.round(n * 100)} %`;
const dayOf = (hours: number | undefined) => (hours === undefined ? "never" : `day ${(hours / 24).toFixed(1)}`);
const months = (hours: number | undefined) => (hours === undefined ? "" : ` (${(hours / 24 / 30.44).toFixed(1)} months)`);

function milestonesTable(setups: readonly Setup[]): string {
  const rows = [`| Durations | Player | ${MILESTONES.map((l) => `Lighthouse ${l}`).join(" | ")} |`, `| --- | --- |${" --- |".repeat(MILESTONES.length)}`];
  for (const s of setups) for (const p of PROFILES) {
    const lh = get(s, p).run.lighthouse;
    rows.push(`| ${s.name} | ${p.name} | ${MILESTONES.map((l) => (l === 30 ? `${dayOf(lh[l])}${months(lh[l])}` : dayOf(lh[l]))).join(" | ")} |`);
  }
  return rows.join("\n");
}

/** The Lighthouse's bands for the builders' table: its level while the builders worked or waited. */
const LH_BANDS = [
  { from: 2, to: 5, name: "Lighthouse 2 to 5" },
  { from: 6, to: 10, name: "6 to 10" },
  { from: 11, to: 20, name: "11 to 20" },
  { from: 21, to: 29, name: "21 to 29" },
  { from: 30, to: 30, name: "30, after it" },
] as const;

function buildersTable(setups: readonly Setup[]): string {
  const rows = [
    "| Durations | Player | Lighthouse | Time there | Builders at work | A builder free, the player away | A builder free, nothing to start | Both at work, something else could start |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const s of setups) for (const p of PROFILES) {
    const b = get(s, p).builders;
    for (const band of LH_BANDS) {
      const sum = { hours: 0, away: 0, nothing: 0, waitBuild: 0 };
      for (let l = band.from; l <= band.to; l++) for (const k of ["hours", "away", "nothing", "waitBuild"] as const) sum[k] += b[l]?.[k] ?? 0;
      if (!sum.hours) continue;
      const slots = 2 * sum.hours;
      rows.push(`| ${s.name} | ${p.name} | ${band.name} | ${D.duration(sum.hours * HOUR)} | ${pct(1 - (sum.away + sum.nothing) / slots)} | ${pct(sum.away / slots)} | ${pct(sum.nothing / slots)} | ${pct(sum.waitBuild / sum.hours)} |`);
    }
  }
  return rows.join("\n");
}

function casualTable(setups: readonly Setup[]): string {
  const casual = PROFILES[0]!;
  const rows = ["| Durations | Levels | Builds started (two years) | Ended before the next session | The builder then waited, on average |", "| --- | --- | --- | --- | --- |"];
  for (const s of setups) {
    for (const r of D.betweenSessions(get(s, casual).started, casual.sessions)) {
      if (!r.builds) continue;
      rows.push(`| ${s.name} | ${r.band.from} to ${r.band.to} | ${r.builds} | ${r.before} (${pct(r.before / r.builds)}) | ${D.duration(r.wait)} |`);
    }
  }
  return rows.join("\n");
}

function wholeCityTable(setups: readonly Setup[]): string {
  const regular = PROFILES[1]!;
  const rows = ["| Durations | Every level of every building, added up | With two builders, at best | The regular player at day 730 | Whole city at 30 |", "| --- | --- | --- | --- | --- |"];
  for (const s of setups) {
    const w = D.wholeCity(timeOf(s.time));
    const { run } = get(s, regular);
    const all = run.days.find((d) => Object.values(d.buildings).every((l) => l >= 30));
    const last = run.days.at(-1)!.buildings;
    const others = BUILDING_IDS.filter((id) => id !== "lighthouse").map((id) => last[id]);
    rows.push(`| ${s.name} | ${D.duration(w.total)} | ${D.duration(w.twoBuilders)} | Lighthouse ${last.lighthouse}, the others ${Math.min(...others)} to ${Math.max(...others)} | ${all ? `day ${all.day}` : "never in two years"} |`);
  }
  return rows.join("\n");
}

function blocksTable(setups: readonly Setup[]): string {
  const rows = ["| Durations | Player | Sessions ended with a builder free (two years) | Short of wood | Short of oil | Short of fish | Every building at its cap |", "| --- | --- | --- | --- | --- | --- | --- |"];
  for (const s of setups) for (const p of PROFILES) {
    const { run } = get(s, p);
    const sessions = run.days.reduce((n, d) => n + d.sessions, 0);
    const blocked = run.days.reduce((n, d) => n + d.blockedSessions, 0);
    rows.push(`| ${s.name} | ${p.name} | ${blocked} of ${sessions} (${pct(blocked / sessions)}) | ${run.blocks.wood} | ${run.blocks.oil} | ${run.blocks.fish} | ${run.blocks.capped} |`);
  }
  return rows.join("\n");
}

/** The first level each group can never reach: its cost is more than the storage holds, at Lighthouse 30 with every Sealed Warehouses. */
function wallsTable(): string {
  const storage = storeCap(30, { warehouses: TECHS.warehouses.max });
  const rows = [`| Group | First level out of reach (storage at most ${storage.toLocaleString("en-US")}) | Its cost |`, "| --- | --- | --- |"];
  for (const g of D.GROUPS) {
    const id = g.ids[0]!;
    const level = D.LEVELS.find((l) => Object.values(upgradeCost(id, l - 1)).some((v) => (v ?? 0) > storage));
    rows.push(`| ${g.name} | ${level ?? "none"} | ${level ? Object.entries(upgradeCost(id, level - 1)).map(([k, v]) => `${v!.toLocaleString("en-US")} ${k}`).join(" + ") : ""} |`);
  }
  return rows.join("\n");
}

function costsTable(): string {
  const regular = PROFILES[1]!;
  const rows = ["| Durations and costs | Regular player: Lighthouse 30 | Whole city at 30 | At day 730 |", "| --- | --- | --- | --- |"];
  for (const s of [SLOWER, ...COSTS]) {
    const { run } = get(s, regular);
    const all = run.days.find((d) => Object.values(d.buildings).every((l) => l >= 30));
    const last = run.days.at(-1)!.buildings;
    const others = BUILDING_IDS.filter((id) => id !== "lighthouse").map((id) => last[id]);
    rows.push(`| ${s.name} | ${dayOf(run.lighthouse[30])} | ${all ? `day ${all.day}` : "not in two years"} | the others ${Math.min(...others)} to ${Math.max(...others)} |`);
  }
  return rows.join("\n");
}

function helpTable(): string {
  const base = SLOWER;
  const rows = ["| Player | Lighthouse 10 | 20 | 30 | Build time taken off by the help (two years) | Share of the builds' time |", "| --- | --- | --- | --- | --- | --- |"];
  for (const p of PROFILES) {
    const a = get(base, p);
    const h = get(HELP, p);
    const full = h.started.reduce((n, s) => n + D.curveTime(slow, s.id, s.level), 0);
    const helped = h.started.reduce((n, s) => n + s.seconds, 0);
    const day = (r: Played, l: number) => (r.run.lighthouse[l]! / 24).toFixed(1);
    rows.push(`| ${p.name} | day ${day(h, 10)} (${day(a, 10)}) | day ${day(h, 20)} (${day(a, 20)}) | day ${day(h, 30)} (${day(a, 30)}) | ${D.duration(full - helped)} | ${pct((full - helped) / full)} |`);
  }
  return rows.join("\n");
}

/** The regular player's Lighthouse, level by level from 20: days between levels. */
function endgameTable(setups: readonly Setup[]): string {
  const regular = PROFILES[1]!;
  const levels = Array.from({ length: 10 }, (_, i) => 21 + i);
  const rows = [`| Durations | ${levels.map((l) => `${l - 1} → ${l}`).join(" | ")} |`, `| --- |${" --- |".repeat(levels.length)}`];
  for (const s of setups) {
    const lh = get(s, regular).run.lighthouse;
    rows.push(`| ${s.name} | ${levels.map((l) => (lh[l] === undefined || lh[l - 1] === undefined ? "" : `${((lh[l]! - lh[l - 1]!) / 24).toFixed(1)} d`)).join(" | ")} |`);
  }
  return rows.join("\n");
}

const curves = SETUPS.map((s) => ({ name: s.name, time: timeOf(s.time) }));
const tables = [
  "### 1. The build times before 24 October",
  "The time to reach each level from the one before (the rules' `upgradeTime` until 24 October), and its ratio to the level before. The buildings of a column share their times.",
  D.durationTable(D.beforeTime),
  "### 2. The two curves",
  ...D.CURVES.flatMap((c) => {
    const { k, p } = D.shape(c);
    return [`#### ${c.name}: level 10 in ${D.duration(c.at10)}, level 30 in ${D.duration(c.at30)} (producers; k = ${k.toFixed(4)}, p = ${p.toFixed(4)})`, D.durationTable((id, level) => D.curveTime(c, id, level))];
  }),
  "#### The bands, side by side",
  D.bandsTable(curves),
  "### 3. What the players get (E in place, the balance's players, two years)",
  "#### The Lighthouse's milestones",
  milestonesTable(SETUPS),
  "#### The regular player's last levels: days from one Lighthouse level to the next",
  endgameTable(SETUPS),
  "#### The builders, by the Lighthouse's level",
  "Shares of the builders' time (two builders). *The player away*: a builder free while something could start, until the next session. *Nothing to start*: a builder free, short of resources, or every building at the Lighthouse's level. The last column: the share of the hours with both builders at work while the city could pay for something else: everything waits for a build.",
  buildersTable(SETUPS),
  "#### The casual player (3 sessions: 8:00, 13:00, 21:00): builds that end before the next session",
  casualTable(SETUPS),
  "#### The whole city at level 30",
  wholeCityTable(SETUPS),
  "#### Where the resources hold the builders back",
  blocksTable(SETUPS),
  "The levels the storage can never hold, today's costs:",
  wallsTable(),
  "#### A cost option, measured only: the other buildings' costs past level 15",
  costsTable(),
  "### 5. The alliance's help, measured on the slower curve",
  "Ten allies, three minutes each, on every build of level 6 or more, never more than half of it; the slower curve's days in brackets.",
  helpTable(),
].join("\n\n");

const file = `${docs}studies/durations.md`;
const text = readFileSync(file, "utf8");
const a = text.indexOf(MARK_START);
const b = text.indexOf(MARK_END);
if (a < 0 || b < a) throw new Error(`${file}: its markers are missing`);
writeFileSync(file, `${text.slice(0, a + MARK_START.length)}\n\n${tables}\n\n${text.slice(b)}`);
console.log(`${file}: written (${played.size} runs of ${DAYS} days)`);
