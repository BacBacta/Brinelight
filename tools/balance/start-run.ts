/**
 * npx tsx tools/balance/start-run.ts: the early start, A + C, measured (docs/tasks/early-start.md). Plays the rules
 * of `shared/` (A + C since 23 October) and the soft transition the owner asked to see, then writes the tables between
 * the markers of `docs/tasks/early-start.md`. It changes no rule.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";

// The simulator gets the study's rules in place of `@brinelight/shared` (to write down what happens): registered first.
register("./early-hooks.mjs", import.meta.url);
const { FOUNDED, PROFILES, simulate } = await import("./simulate.js");
const { study } = await import("./early-rules.js");
const { DAY, HOUR } = await import("@brinelight/shared");
const { duration } = await import("./early.js");
const start = await import("./start.js");
type Profile = (typeof PROFILES)[number];
type Variant = typeof start.TRANSITION | null;

const docs = fileURLToPath(new URL("../../docs/", import.meta.url));
const MARK_START = "<!-- start:generated:start (npx tsx tools/balance/start-run.ts) -->";
const MARK_END = "<!-- start:generated:end -->";

const play = (profile: Profile, days: number, variant: Variant) => {
  study.variant = variant;
  study.tries = [];
  study.finished = [];
  study.jobs = [];
  study.claims = [];
  study.started = [];
  study.seen = new Set();
  const run = simulate(profile, days);
  const out = { run, finished: study.finished, jobs: study.jobs, claims: study.claims, started: study.started };
  study.variant = null;
  return out;
};

const at = (hours: number, minutes = 0) => hours * HOUR + minutes * 60;
/** A new player who stays the whole first hour (a session every minute from 8:00 to 9:00), then plays as the casual one. */
const firstHour: Profile = { id: "casual", name: "First hour, then casual", sessions: [...Array.from({ length: 61 }, (_, i) => at(8, i)), at(13), at(21)] };
/** An attentive player, there every minute from 8:00 to 22:00, three days: the quests as this simulated player plays them. */
const attentive: Profile = { id: "regular", name: "Attentive", sessions: Array.from({ length: 14 * 60 + 1 }, (_, i) => at(8, i)) };

// The rules first: the runs must be the balance's own (docs/balance.md, its milestones).
const balance = readFileSync(`${docs}balance.md`, "utf8");
const variants: Variant[] = [null, start.TRANSITION];
const name = (v: Variant) => v?.name ?? "A + C (the rules)";
const reference: Record<string, Record<number, number>> = {};
const results = variants.map((v) => {
  const profiles = PROFILES.map((p) => {
    const r = play(p, p.id === "casual" ? 380 : 365, v);
    if (!v) {
      const row = balance.split("\n").find((l) => l.startsWith(`| ${p.name} | day `));
      const days = [5, 10, 15, 20, 25, 30].map((l) => `day ${(r.run.lighthouse[l]! / 24).toFixed(1)}`);
      if (!row || !row.startsWith(`| ${p.name} | ${days.join(" | ")} |`)) throw new Error(`${p.name}: the run is not the balance's (${days.join(", ")})`);
      reference[p.id] = r.run.lighthouse;
    }
    const day2 = start.secondDay(r.finished, r.started);
    return { profile: p, reached: r.run.lighthouse, idle2: r.run.days[1]!.idleBuilderHours, day2 };
  });
  const h = play(firstHour, 2, v);
  const q = play(attentive, 3, v);
  return { variant: v, profiles, first: h, quests: q };
});

const pct = (value: number, base: number) => {
  const p = Math.round(((value - base) / base) * 1000) / 10;
  return `${p > 0 ? "+" : ""}${p} %`;
};
const WEEK_6: Record<string, Record<number, number>> = {
  casual: { 15: 26.0, 20: 63.0 },
  regular: { 15: 19.7, 20: 52.6 },
  dedicated: { 15: 17.5, 20: 45.2 },
};

const milestones = [
  "| Variant | Profile | Lighthouse 5 | 6 | 8 | 10 | 15 (vs A + C; vs week 6) | 20 (vs A + C; vs week 6) |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
];
for (const r of results) {
  for (const p of r.profiles) {
    const days = [15, 20].map((l) => {
      const d = p.reached[l]! / 24;
      return `day ${d.toFixed(1)} (${pct(d, reference[p.profile.id]![l]! / 24)}; ${pct(d, WEEK_6[p.profile.id]![l]!)})`;
    });
    milestones.push(`| ${name(r.variant)} | ${p.profile.name} | ${[5, 6, 8, 10].map((l) => start.hoursOf(p.reached, l)).join(" | ")} | ${days.join(" | ")} |`);
  }
}

const first = ["| Variant | Upgrades finished within 10 min | 30 min | 60 min | Lighthouse 5 at | Lighthouse after 1 h |", "| --- | --- | --- | --- | --- | --- |"];
for (const r of results) {
  const f = r.first.finished;
  const lh5 = f.find((x) => x.id === "lighthouse" && x.level === 5);
  const after1h = 2 + f.filter((x) => x.id === "lighthouse" && x.clock - FOUNDED <= HOUR).length;
  first.push(`| ${name(r.variant)} | ${[10, 30, 60].map((m) => start.finishedWithin(f, FOUNDED, m)).join(" | ")} | ${lh5 ? duration(lh5.clock - FOUNDED) : "–"} | ${after1h} |`);
}

const second = ["| Variant | Profile | Builders idle on day 2 (hours, both builders) | Upgrades finished on day 2 | Longest upgrade started on day 2 |", "| --- | --- | --- | --- | --- |"];
for (const r of results) {
  for (const p of r.profiles) {
    const l = p.day2.longest;
    second.push(`| ${name(r.variant)} | ${p.profile.name} | ${p.idle2.toFixed(1)} | ${p.day2.finished} | ${l ? `${l.id} ${l.level}, ${duration(l.seconds)}` : "–"} |`);
  }
}

const rules = results[0]!;
const path = start.questPath(rules.quests.claims, rules.quests.jobs, FOUNDED, 18);
const ninth = path.find((s) => s.objective === 8);
const quests = ["| Quest | Claimed at | After the one before | Waited on an uncapped work |", "| --- | --- | --- | --- |"];
for (const s of path) {
  const w = s.waitedOn;
  quests.push(`| ${s.objective + 1}. ${s.text} | ${duration(s.claimed)} | ${duration(s.after)} | ${w ? `${w.what}, ${duration((w.arrive ?? w.end!) - w.start)}${w.arrive ? " out" : ""}, from ${start.at(w.start, FOUNDED)}` : "no"} |`);
}
const until = ninth ? FOUNDED + ninth.claimed : FOUNDED + DAY;
const longOnes = start.longWorks(rules.quests.jobs, until);
const works = ["| Uncapped work | Started at | Took | Blocked a quest |", "| --- | --- | --- | --- |"];
for (const j of longOnes) {
  const blocked = path.find((s) => s.waitedOn === j);
  works.push(`| ${j.what} | ${start.at(j.start, FOUNDED)} | ${j.end === null ? "still running" : duration(j.end - j.start)} | ${blocked ? `quest ${blocked.objective + 1}` : "no"} |`);
}

const tables = [
  "### The first hour",
  "A new player who stays the whole first hour (a session every minute from 8:00 to 9:00), then plays as the casual player.",
  first.join("\n"),
  "### The quests, and the uncapped works (A + C)",
  "An attentive player, there every minute from 8:00 to 22:00, who plays as the balance's players (the Lighthouse first, its wood kept; a camp only at easy odds). A quest waited on an uncapped work (research, training, healing, the shipyard, the sea) when that work was done in the minute before the quest was claimed (a fleet: when it arrives).",
  quests.join("\n"),
  "Uncapped works longer than 15 minutes, started before quest 9 was claimed:",
  longOnes.length ? works.join("\n") : "None.",
  "### The soft transition (not in the game): its times",
  start.transitionTable(),
  "### Milestones: A + C, and A + C with the soft transition",
  "Lighthouse 5 to 10: time after the founding. 15 and 20: the day, against A + C (the reference since 23 October) and against week 6.",
  milestones.join("\n"),
  "### The second day",
  "The calendar day after the founding. Builders idle: hours with a builder free (two builders: up to 48 hours), the player away or short of resources.",
  second.join("\n"),
].join("\n\n");

const file = `${docs}tasks/early-start.md`;
const text = readFileSync(file, "utf8");
const a = text.indexOf(MARK_START);
const b = text.indexOf(MARK_END);
if (a < 0 || b < a) {
  console.log(tables);
  throw new Error(`${file}: its markers are missing`);
}
writeFileSync(file, `${text.slice(0, a + MARK_START.length)}\n\n${tables}\n\n${text.slice(b)}`);
console.log(`${file}: written`);
