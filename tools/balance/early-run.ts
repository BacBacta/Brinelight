/**
 * npx tsx tools/balance/early-run.ts: the early-game study (docs/studies/early-game.md). Plays the balance's players
 * with the rules of `shared/` (through `early-rules.ts`), then with each option of the study, and writes the study's
 * tables between its markers. It changes no value of the rules.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import type { OptionResult } from "./early.js";

// The simulator gets the study's rules in place of `@brinelight/shared`: registered before it is loaded.
register("./early-hooks.mjs", import.meta.url);
const { FOUNDED, PROFILES, simulate } = await import("./simulate.js");
const { study } = await import("./early-rules.js");
const { HOUR } = await import("@brinelight/shared");
const early = await import("./early.js");
type Profile = (typeof PROFILES)[number];
type Variant = (typeof early.VARIANTS)[number];

const docs = fileURLToPath(new URL("../../docs/", import.meta.url));
const MARK_START = "<!-- early:generated:start (npx tsx tools/balance/early-run.ts) -->";
const MARK_END = "<!-- early:generated:end -->";

const play = (profile: Profile, days: number, variant: Variant | null) => {
  study.variant = variant;
  study.tries = [];
  study.finished = [];
  const run = simulate(profile, days);
  const out = { run, tries: study.tries, finished: study.finished };
  study.variant = null;
  return out;
};

const at = (hours: number, minutes = 0) => hours * HOUR + minutes * 60;
/** A new player who stays the whole first hour (a session every minute from 8:00 to 9:00), then plays as the casual one. */
const firstHour: Profile = { id: "casual", name: "First hour, then casual", sessions: [...Array.from({ length: 61 }, (_, i) => at(8, i)), at(13), at(21)] };
const longEnough = (p: Profile) => (p.id === "casual" ? 380 : 365);

// The rules first: the study's runs must be the balance's own (docs/balance.md, its milestones).
const balance = readFileSync(`${docs}balance.md`, "utf8");
const today: OptionResult = { variant: null, firstHour: "", lighthouseAfter1h: 0, lighthouseAfter24h: 0, reached: {} };
const splits: string[] = [];
for (const p of PROFILES) {
  const { run, tries } = play(p, longEnough(p), null);
  const row = balance.split("\n").find((l) => l.startsWith(`| ${p.name} | day `));
  const days = [5, 10, 15, 20, 25, 30].map((l) => `day ${(run.lighthouse[l]! / 24).toFixed(1)}`);
  if (!row || !row.startsWith(`| ${p.name} | ${days.join(" | ")} |`)) throw new Error(`${p.name}: the study's run is not the balance's (${days.join(", ")})`);
  today.reached[p.id] = run.lighthouse;
  splits.push(`#### ${p.name}\n\n${early.splitTable(early.splitLevels(run.lighthouse, FOUNDED, tries, 10))}`);
}

const results: OptionResult[] = [];
for (const v of [null, ...early.VARIANTS]) {
  const h = play(firstHour, 2, v);
  const lighthouseAt = (seconds: number) => 2 + h.finished.filter((f) => f.id === "lighthouse" && f.clock - FOUNDED <= seconds).length;
  const r: OptionResult = v ? { variant: v, firstHour: "", lighthouseAfter1h: 0, lighthouseAfter24h: 0, reached: {} } : today;
  r.firstHour = early.firstSession(h.finished, FOUNDED, HOUR);
  r.lighthouseAfter1h = lighthouseAt(HOUR);
  r.lighthouseAfter24h = lighthouseAt(24 * HOUR);
  if (v) for (const p of PROFILES) r.reached[p.id] = play(p, longEnough(p), v).run.lighthouse;
  results.push(r);
}

const tables = [
  "### The Lighthouse, level by level (the rules alone)",
  early.rulesTable(),
  "### Where each level's time goes, today",
  ...splits,
  "### The first hour, by option",
  "A new player who stays the whole first hour (a session every minute from 8:00 to 9:00), then plays as the casual one.",
  early.firstHourTable(results),
  "### The milestones, by option (week 6's days in `tools/balance/balance.test.ts`)",
  early.optionsTable(results, PROFILES),
].join("\n\n");

const file = `${docs}studies/early-game.md`;
const text = readFileSync(file, "utf8");
const a = text.indexOf(MARK_START);
const b = text.indexOf(MARK_END);
if (a < 0 || b < a) throw new Error(`${file}: its markers are missing`);
writeFileSync(file, `${text.slice(0, a + MARK_START.length)}\n\n${tables}\n\n${text.slice(b)}`);
console.log(`${file}: written (${results.length} runs of the first hour, ${results.length * PROFILES.length} of a year)`);
