/**
 * npx tsx tools/balance/costs-run.ts: the costs study (docs/studies/costs.md). Plays the balance's simulator with the
 * rules of `shared/` (E, the slower build times and the costs past 15 since 24 October), then with each other cost option, through the durations
 * study's rules (`durations-hooks.mjs`, `durations-rules.ts`), and writes the study's tables between its markers. It
 * changes no rule.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import type { CostOption } from "./costs.js";

// The simulator gets the study's rules in place of `@brinelight/shared`: registered before it is loaded.
register("./durations-hooks.mjs", import.meta.url);
const { PROFILES, simulate } = await import("./simulate.js");
const R = await import("./durations-rules.js");
const C = await import("./costs.js");
const { duration } = await import("./durations.js");
const { BUILDING_IDS, HOUR } = await import("@brinelight/shared");
type Profile = (typeof PROFILES)[number];

const docs = fileURLToPath(new URL("../../docs/", import.meta.url));
const MARK_START = "<!-- costs:generated:start (npx tsx tools/balance/costs-run.ts) -->";
const MARK_END = "<!-- costs:generated:end -->";
/** Three years: long enough to see the whole city at 30, or that it never gets there. */
const DAYS = 1095;
const MILESTONES = [10, 15, 20, 25, 30] as const;

const play = (profile: Profile, option: CostOption) => {
  R.study.time = null;
  R.study.help = null;
  R.study.costs = option.cost;
  R.study.started = [];
  R.study.seen = new Set();
  R.study.builders = {};
  const run = simulate(profile, DAYS);
  const out = { run, builders: R.study.builders };
  R.study.costs = null;
  return out;
};
type Played = ReturnType<typeof play>;

// The rules first: the study's runs must be the balance's own (docs/balance.md, its milestones).
const balance = readFileSync(`${docs}balance.md`, "utf8");
const played = new Map<string, Played>();
for (const o of C.OPTIONS) {
  for (const p of PROFILES) {
    const out = play(p, o);
    if (!o.cost) {
      const row = balance.split("\n").find((l) => l.startsWith(`| ${p.name} | day `));
      const days = [5, ...MILESTONES].map((l) => `day ${(out.run.lighthouse[l]! / 24).toFixed(1)}`);
      if (!row || !row.startsWith(`| ${p.name} | ${days.join(" | ")} |`)) throw new Error(`${p.name}: the study's run is not the balance's (${days.join(", ")})`);
    }
    played.set(`${o.id} ${p.id}`, out);
  }
}
const get = (o: CostOption, p: Profile) => played.get(`${o.id} ${p.id}`)!;
const regular = PROFILES[1]!;

const pct = (n: number) => `${Math.round(n * 100)} %`;
const months = (days: number) => `${(days / 30.44).toFixed(1)} months`;
const others = BUILDING_IDS.filter((id) => id !== "lighthouse");
/** The first day the whole city is at `level` (every building), or null. */
const cityAt = (r: Played, level: number) => r.run.days.find((d) => Object.values(d.buildings).every((l) => l >= level))?.day ?? null;
const lowest = (r: Played, day: number) => {
  const row = r.run.days[day - 1] ?? r.run.days.at(-1)!;
  return `${Math.min(...others.map((id) => row.buildings[id]))} to ${Math.max(...others.map((id) => row.buildings[id]))}`;
};

function costsTable(): string {
  const rows = ["| Option | Other buildings' levels 16 to 30, all of them: wood | oil | fish | Levels the storage can never hold |", "| --- | --- | --- | --- | --- |"];
  for (const o of C.OPTIONS) {
    const s = C.pastFifteen(o);
    const w = Object.entries(C.walls(o));
    const fmt = (n: number) => `${(n / 1e6).toFixed(1)} M`;
    rows.push(`| ${o.name} | ${fmt(s.wood)} | ${fmt(s.oil)} | ${fmt(s.fish)} | ${w.length ? w.map(([id, l]) => `${id} ${l}`).join(", ") : "none"} |`);
  }
  return rows.join("\n");
}

function paceTable(): string {
  const rows = [`| Option | Player | ${MILESTONES.map((l) => `Lighthouse ${l}`).join(" | ")} | Whole city at 20 | at 25 | at 30 | Other buildings, day 365 | day 730 |`, `| --- | --- |${" --- |".repeat(MILESTONES.length + 5)}`];
  for (const o of C.OPTIONS) for (const p of PROFILES) {
    const r = get(o, p);
    const lh = MILESTONES.map((l) => (r.run.lighthouse[l] === undefined ? "never" : `day ${(r.run.lighthouse[l]! / 24).toFixed(1)}`));
    const city = [20, 25, 30].map((l) => {
      const d = cityAt(r, l);
      return d === null ? "not in 3 years" : `day ${d}`;
    });
    rows.push(`| ${o.name} | ${p.name} | ${lh.join(" | ")} | ${city.join(" | ")} | ${lowest(r, 365)} | ${lowest(r, 730)} |`);
  }
  return rows.join("\n");
}

const BANDS = [
  { from: 11, to: 20, name: "11 to 20" },
  { from: 21, to: 29, name: "21 to 29" },
  { from: 30, to: 30, name: "30, until the city is done" },
] as const;

function buildersTable(): string {
  const rows = ["| Option | Lighthouse | Builders at work | A builder free, the player away | A builder free, nothing to start | Both at work, something else could start |", "| --- | --- | --- | --- | --- | --- |"];
  for (const o of C.OPTIONS) {
    const r = get(o, regular);
    const done = cityAt(r, 30);
    for (const band of BANDS) {
      const sum = { hours: 0, away: 0, nothing: 0, waitBuild: 0 };
      for (let l = band.from; l <= band.to; l++) for (const k of ["hours", "away", "nothing", "waitBuild"] as const) sum[k] += r.builders[l]?.[k] ?? 0;
      if (band.from === 30 && done !== null) {
        // After the whole city is at 30 there is nothing left to build: those hours are left out.
        const after = (DAYS - done) * 24;
        sum.hours -= after;
        sum.nothing -= 2 * after;
      }
      if (sum.hours <= 0) continue;
      const slots = 2 * sum.hours;
      rows.push(`| ${o.name} | ${band.name} (${duration(sum.hours * HOUR)}) | ${pct(1 - (sum.away + sum.nothing) / slots)} | ${pct(sum.away / slots)} | ${pct(sum.nothing / slots)} | ${pct(sum.waitBuild / sum.hours)} |`);
    }
  }
  return rows.join("\n");
}

function resourcesTable(): string {
  const rows = ["| Option | Player | Sessions ended with a builder free | Short of wood | of oil | of fish | Days ended full: wood | oil | fish |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const o of C.OPTIONS) for (const p of PROFILES) {
    const r = get(o, p).run;
    const done = cityAt(get(o, p), 30);
    // Until the whole city is done (or three years): after, nothing is left to build.
    const days = r.days.slice(0, done ?? r.days.length);
    const sessions = days.reduce((n, d) => n + d.sessions, 0);
    const blocked = days.reduce((n, d) => n + d.blockedSessions, 0);
    const by = (k: string) => days.reduce((n, d) => n + (d.blockedBy.match(new RegExp(`${k} (\\d+)`))?.[1] ? Number(d.blockedBy.match(new RegExp(`${k} (\\d+)`))![1]) : 0), 0);
    const full = (k: "wood" | "oil" | "fish") => days.filter((d) => d.stock[k] >= d.storage - 1).length;
    rows.push(`| ${o.name} | ${p.name} | ${blocked} of ${sessions} (${pct(blocked / sessions)}) | ${by("wood")} | ${by("oil")} | ${by("fish")} | ${full("wood")} | ${full("oil")} | ${full("fish")} |`);
  }
  return rows.join("\n");
}

function endgameTable(): string {
  const levels = Array.from({ length: 10 }, (_, i) => 21 + i);
  const rows = [`| Option | ${levels.map((l) => `${l - 1} → ${l}`).join(" | ")} |`, `| --- |${" --- |".repeat(levels.length)}`];
  for (const o of C.OPTIONS) {
    const lh = get(o, regular).run.lighthouse;
    rows.push(`| ${o.name} | ${levels.map((l) => (lh[l] === undefined || lh[l - 1] === undefined ? "" : `${((lh[l]! - lh[l - 1]!) / 24).toFixed(1)} d`)).join(" | ")} |`);
  }
  return rows.join("\n");
}

const summary = C.OPTIONS.map((o) => {
  const r = get(o, regular);
  const done = cityAt(r, 30);
  return `- ${o.name}: Lighthouse 30 on day ${(r.run.lighthouse[30]! / 24).toFixed(1)} (${months(r.run.lighthouse[30]! / 24)}); the whole city at 30 ${done === null ? "not in three years" : `on day ${done} (${months(done)})`}.`;
});

const tables = [
  "### The regular player, in short",
  summary.join("\n"),
  "### 1. What each option costs past level 15",
  `The other buildings' levels 16 to 30 added up (every building), by resource; and the first level the storage can never hold (its cost of one resource is more than the most the storage ever holds, ${C.STORAGE_MAX.toLocaleString("en-US")}).`,
  costsTable(),
  `### The recommended option's values: ${C.OPTIONS.find((o) => o.id === C.RECOMMENDED)!.name}`,
  "The cost to reach each level (from the one before); the levels between follow the same rule. The Lighthouse keeps its costs.",
  C.valuesTable(C.OPTIONS.find((o) => o.id === C.RECOMMENDED)!),
  "### 2. The pace (three years)",
  paceTable(),
  "### 3. The regular player's last levels: days from one Lighthouse level to the next",
  endgameTable(),
  "### 4. The regular player's builders, by the Lighthouse's level",
  "Shares of the builders' time, as in `docs/studies/durations.md`. At Lighthouse 30: until the whole city is at 30.",
  buildersTable(),
  "### 5. The resources",
  "Until the whole city is at 30 (or three years). The sessions that ended with a builder free, and why; then the days that ended with a resource full (its production lost).",
  resourcesTable(),
].join("\n\n");

const file = `${docs}studies/costs.md`;
const text = readFileSync(file, "utf8");
const a = text.indexOf(MARK_START);
const b = text.indexOf(MARK_END);
if (a < 0 || b < a) throw new Error(`${file}: its markers are missing`);
writeFileSync(file, `${text.slice(0, a + MARK_START.length)}\n\n${tables}\n\n${text.slice(b)}`);
console.log(`${file}: written (${played.size} runs of ${DAYS} days)`);
