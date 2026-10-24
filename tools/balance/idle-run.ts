/**
 * npx tsx tools/balance/idle-run.ts: the study of the builders left idle at Lighthouse 11 to 20 (docs/studies/idle.md).
 * Plays the balance's simulator with the rules of `shared/` (E, the slower build times and the costs past 15 since 24
 * October), then with lower costs or more production, through the durations study's rules (`durations-hooks.mjs`,
 * `durations-rules.ts`), and writes the study's tables between its markers. It changes no rule.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import type { Costs, Production } from "./durations-rules.js";

// The simulator gets the study's rules in place of `@brinelight/shared`: registered before it is loaded.
register("./durations-hooks.mjs", import.meta.url);
const { PROFILES, simulate } = await import("./simulate.js");
const R = await import("./durations-rules.js");
const { BUILDING_IDS, roundCost, upgradeCost } = await import("@brinelight/shared");
type Profile = (typeof PROFILES)[number];
type BuildingId = (typeof BUILDING_IDS)[number];
type Cost = ReturnType<typeof upgradeCost>;

const docs = fileURLToPath(new URL("../../docs/", import.meta.url));
const MARK_START = "<!-- idle:generated:start (npx tsx tools/balance/idle-run.ts) -->";
const MARK_END = "<!-- idle:generated:end -->";
const DAYS = 1095;

type Setup = { key: string; name: string; costs?: Costs; production?: Production; noReserve?: boolean };

const scale = (c: Cost, f: number) => roundCost(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v * f])) as Cost);
/** Every building's cost to reach levels `from` to `to` (both included) times `f`; `who` picks the buildings. */
const cheaper = (f: number, from: number, to: number, who: (id: BuildingId) => boolean): Costs => (id, level) =>
  who(id) && level + 1 >= from && level + 1 <= to ? scale(upgradeCost(id, level), f) : null;
const lighthouse = (id: BuildingId) => id === "lighthouse";
const others = (id: BuildingId) => id !== "lighthouse";
const both = (...cs: Costs[]): Costs => (id, level) => cs.reduce<Cost | null>((c, f) => c ?? f(id, level), null);
const times = (k: number): Production => () => k;

const DIAGNOSIS: readonly Setup[] = [
  { key: "rules", name: "The rules" },
  { key: "no-reserve", name: "The rules, a player who keeps no reserve for the Lighthouse", noReserve: true },
  { key: "o0.5", name: "Other buildings' levels 6 to 15 ×0.5", costs: cheaper(0.5, 6, 15, others) },
  { key: "o0.25", name: "Other buildings' levels 6 to 15 ×0.25", costs: cheaper(0.25, 6, 15, others) },
  { key: "o0.1", name: "Other buildings' levels 6 to 15 ×0.1", costs: cheaper(0.1, 6, 15, others) },
  { key: "l0.5", name: "Lighthouse 11 to 20 ×0.5", costs: cheaper(0.5, 11, 20, lighthouse) },
  { key: "l0.25", name: "Lighthouse 11 to 20 ×0.25", costs: cheaper(0.25, 11, 20, lighthouse) },
  { key: "l0.1", name: "Lighthouse 11 to 20 ×0.1", costs: cheaper(0.1, 11, 20, lighthouse) },
  { key: "lo0.25", name: "Lighthouse 11 to 20 and others 6 to 15, ×0.25", costs: both(cheaper(0.25, 11, 20, lighthouse), cheaper(0.25, 6, 15, others)) },
  { key: "p1.5", name: "Production ×1.5", production: times(1.5) },
  { key: "p2", name: "Production ×2", production: times(2) },
  { key: "p3", name: "Production ×3", production: times(3) },
];
const OPTIONS: readonly Setup[] = [
  { key: "rules", name: "The rules" },
  { key: "A", name: "A. Production ×3.5", production: times(3.5) },
  { key: "B", name: "B. Production ×1.75, the Lighthouse's levels 11 to 20 ×0.25", production: times(1.75), costs: cheaper(0.25, 11, 20, lighthouse) },
];

const play = (profile: Profile, s: Setup) => {
  R.study.time = null;
  R.study.help = null;
  R.study.costs = s.costs ?? null;
  R.study.production = s.production ?? null;
  R.study.started = [];
  R.study.seen = new Set();
  R.study.builders = {};
  const run = simulate(s.noReserve ? { ...profile, noReserve: true } : profile, DAYS);
  const out = { run, builders: R.study.builders };
  R.study.costs = null;
  R.study.production = null;
  return out;
};
type Played = ReturnType<typeof play>;

// The rules first: the study's runs must be the balance's own (docs/balance.md, its milestones).
const balance = readFileSync(`${docs}balance.md`, "utf8");
const played = new Map<string, Played>();
const get = (s: Setup, p: Profile) => {
  const key = `${s.key} ${p.id}`;
  if (!played.has(key)) {
    const out = play(p, s);
    if (s.key === "rules") {
      const row = balance.split("\n").find((l) => l.startsWith(`| ${p.name} | day `));
      const days = [5, 10, 15, 20, 25, 30].map((l) => `day ${(out.run.lighthouse[l]! / 24).toFixed(1)}`);
      if (!row || !row.startsWith(`| ${p.name} | ${days.join(" | ")} |`)) throw new Error(`${p.name}: the study's run is not the balance's (${days.join(", ")})`);
    }
    played.set(key, out);
  }
  return played.get(key)!;
};

const pct = (n: number) => `${Math.round(n * 100)} %`;
const day = (h: number | undefined) => (h === undefined ? "never" : `day ${(h / 24).toFixed(1)}`);
/** The builders between Lighthouse 11 and 20. */
function band(r: Played) {
  const sum = { hours: 0, away: 0, nothing: 0, waitBuild: 0, held: 0 };
  for (let l = 11; l <= 20; l++) for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += r.builders[l]?.[k] ?? 0;
  const slots = 2 * sum.hours;
  return { days: sum.hours / 24, work: 1 - (sum.away + sum.nothing) / slots, away: sum.away / slots, nothing: sum.nothing / slots, held: sum.held / slots, short: (sum.nothing - sum.held) / slots, waitBuild: sum.waitBuild / sum.hours };
}
const cityAt30 = (r: Played) => r.run.days.find((d) => Object.values(d.buildings).every((l) => l >= 30))?.day ?? null;

function diagnosisTable(): string {
  const regular = PROFILES[1]!;
  const rows = [
    "| Setup | Lighthouse 11 to 20 lasts | Builders at work | Free, the player away | Free, nothing to start | … of which the Lighthouse's reserve | … of which short of everything | Lighthouse 15 | 20 | 30 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const s of DIAGNOSIS) {
    const r = get(s, regular);
    const b = band(r);
    const lh = r.run.lighthouse;
    rows.push(`| ${s.name} | ${b.days.toFixed(1)} days | ${pct(b.work)} | ${pct(b.away)} | ${pct(b.nothing)} | ${pct(b.held)} | ${pct(b.short)} | ${day(lh[15])} | ${day(lh[20])} | ${day(lh[30])} |`);
  }
  return rows.join("\n");
}

function optionsTable(): string {
  const rows = [
    "| Option | Player | Free, nothing to start (Lighthouse 11 to 20) | Builders at work | Lighthouse 15 | 20 | 30 | Whole city at 30 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const s of OPTIONS) for (const p of PROFILES) {
    const r = get(s, p);
    const b = band(r);
    const lh = r.run.lighthouse;
    const city = cityAt30(r);
    rows.push(`| ${s.name} | ${p.name} | ${pct(b.nothing)} | ${pct(b.work)} | ${day(lh[15])} | ${day(lh[20])} | ${day(lh[30])} (${((lh[30] ?? NaN) / 24 / 30.44).toFixed(1)} months) | ${city === null ? "not in 3 years" : `day ${city}`} |`);
  }
  return rows.join("\n");
}

function blocksTable(): string {
  const rows = ["| Option | Player | Sessions ended with a builder free (until the city is done) | Short of wood | of oil | of fish | Days ended with oil full | fish full | wood full |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const s of OPTIONS) for (const p of PROFILES) {
    const r = get(s, p);
    const days = r.run.days.slice(0, cityAt30(r) ?? r.run.days.length);
    const sessions = days.reduce((n, d) => n + d.sessions, 0);
    const blocked = days.reduce((n, d) => n + d.blockedSessions, 0);
    const by = (k: string) => days.reduce((n, d) => n + Number(d.blockedBy.match(new RegExp(`${k} (\\d+)`))?.[1] ?? 0), 0);
    const full = (k: "wood" | "oil" | "fish") => days.filter((d) => d.stock[k] >= d.storage - 1).length;
    rows.push(`| ${s.name} | ${p.name} | ${blocked} of ${sessions} (${pct(blocked / sessions)}) | ${by("wood")} | ${by("oil")} | ${by("fish")} | ${full("oil")} | ${full("fish")} | ${full("wood")} |`);
  }
  return rows.join("\n");
}

const tables = [
  "### 1. What sets the pace: the regular player, Lighthouse 11 to 20",
  "Shares of the two builders' time while the Lighthouse is at 11 to 20. *Nothing to start*: a builder free, and nothing the player starts; *of which the Lighthouse's reserve*: the city could pay for another building, but the player keeps those resources for the Lighthouse's next level; *of which short of everything*: nothing could be paid at all.",
  diagnosisTable(),
  "### 2. The two options, for the three players",
  optionsTable(),
  "### 3. The resources with the options",
  blocksTable(),
].join("\n\n");

const file = `${docs}studies/idle.md`;
const text = readFileSync(file, "utf8");
const a = text.indexOf(MARK_START);
const b = text.indexOf(MARK_END);
if (a < 0 || b < a) throw new Error(`${file}: its markers are missing`);
writeFileSync(file, `${text.slice(0, a + MARK_START.length)}\n\n${tables}\n\n${text.slice(b)}`);
console.log(`${file}: written (${played.size} runs of ${DAYS} days)`);
