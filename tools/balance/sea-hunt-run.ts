/**
 * npx tsx tools/balance/sea-hunt-run.ts: the sea-hunt study (docs/studies/sea-hunt.md). Plays the balance's simulator
 * with the rules of `shared/`, then with the study's proposals (`sea-hunt.ts`) through its rules (`sea-hunt-hooks.mjs`,
 * `sea-hunt-rules.ts`), for two years, and prints the study's tables. It changes no rule.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import type { Intent, Profile } from "./simulate.js";
import type { Proposal } from "./sea-hunt.js";

// The simulator gets the study's rules in place of `@brinelight/shared`: registered before it is loaded.
register("./sea-hunt-hooks.mjs", import.meta.url);
const { PROFILES, simulate } = await import("./simulate.js");
const R = await import("./sea-hunt-rules.js");
const H = await import("./sea-hunt.js");
const { DAY, HOUR } = await import("@brinelight/shared");
type PlayerState = import("@brinelight/shared").PlayerState;

/** Two years: long enough to see the whole city at 30. */
const DAYS = Number(process.env.DAYS ?? 730);
const ONLY = process.env.ONLY?.split(",");
const DOC = fileURLToPath(new URL("../../docs/studies/sea-hunt.md", import.meta.url));
const MARK_START = "<!-- sea-hunt:generated:start (npx tsx tools/balance/sea-hunt-run.ts) -->";
const MARK_END = "<!-- sea-hunt:generated:end -->";
const out: string[] = [];
const print = (line: string) => out.push(line);

/** The time until the player's next session, in hours, from the city's clock. */
const gapOf = (p: Profile, clock: number): number => {
  const now = clock % DAY;
  const next = p.sessions.find((t) => t > now + 60) ?? p.sessions[0]! + DAY;
  return (next - now) / HOUR;
};

/**
 * The study's player at sea: once the Leviathan is served, one fleet at a time sails on the longest expedition that is
 * home by the next session (an hour late at most) and that its soldiers can escort, for the resource it holds least of.
 */
const seaHook =
  (p: Profile, prop: Proposal) =>
  (s: PlayerState, act: (action: Intent, label: string) => boolean): boolean => {
    const hunt = prop.hunt;
    if (!hunt || s.buildings.lighthouse < hunt.from) return false;
    const gap = gapOf(p, s.clock);
    const zones = [...hunt.zones].filter((z) => z.hours <= gap + 1 && H.escortOf(z, s.buildings.lighthouse) <= R.totalTroops(s.troops)).sort((a, b) => b.hours - a.hours);
    const resource = (["oil", "fish", "wood"] as const).slice().sort((a, b) => s.stock[a] - s.stock[b])[0]!;
    return zones.some((z) => act({ type: "expedition", zone: z.id, resource } as never, `expedition ${z.id} (${resource})`));
  };

/** The study's player at the builders: a quarter of an hour off the Lighthouse's upgrade, or else the longest one. */
const speedHook =
  (prop: Proposal) =>
  (s: PlayerState, act: (action: Intent, label: string) => boolean): boolean => {
    if (!prop.speedup || !s.queue.length) return false;
    const job = s.queue.find((j) => j.id === "lighthouse") ?? [...s.queue].sort((a, b) => b.left - a.left)[0]!;
    let any = false;
    // Up to the day's cap, a quarter of an hour at a time (each one checked against the reserve).
    for (let i = 0; i < 8 && act({ type: "speedup", building: job.id, seconds: 15 * 60 } as never, `speed up ${job.id}`); i++) any = true;
    return any;
  };

function play(p: Profile, prop: Proposal) {
  R.begin(prop.id === "rules" ? null : prop);
  const run = simulate({ ...p, sea: seaHook(p, prop), afterBuilders: speedHook(prop) }, DAYS);
  const st = R.study;
  const done = run.days.find((d) => Object.values(d.buildings).every((l) => l >= 30))?.day ?? null;
  const rows = run.days.slice(0, done ?? run.days.length);
  const year = run.days.slice(0, 365);
  const blocked = (rs: typeof rows, k: string) => rs.reduce((n, d) => n + (d.blockedBy.match(new RegExp(`(?:^|; )${k} (\\d+)`))?.[1] ? Number(d.blockedBy.match(new RegExp(`(?:^|; )${k} (\\d+)`))![1]) : 0), 0);
  const lh = (l: number) => (run.lighthouse[l] === undefined ? null : run.lighthouse[l]! / 24);
  return {
    lh: Object.fromEntries([10, 15, 20, 25, 30].map((l) => [l, lh(l)])),
    done,
    blocked: { all: rows.reduce((n, d) => n + d.blockedSessions, 0), fish: blocked(rows, "fish"), wood: blocked(rows, "wood"), oil: blocked(rows, "oil"), pearls: blocked(rows, "pearls") },
    year: { all: year.reduce((n, d) => n + d.blockedSessions, 0), fish: blocked(year, "fish") },
    zones: structuredClone(st.zones),
    amber: { left: st.amber, spent: st.amberSpent, short: st.amberShort.size },
    speed: { hours: st.speed.seconds / HOUR, spent: st.speed.spent },
    taken: { ...st.taken },
    pearls: run.pearls,
    hunts: run.hunts,
  };
}

const d = (v: number | null) => (v === null ? "never" : v.toFixed(1));
const n = (v: number) => Math.round(v).toLocaleString("en-US");
const props = H.PROPOSALS.filter((x) => !ONLY || ONLY.includes(x.id));
type Played = ReturnType<typeof play>;
const runs = new Map<string, Played>();
for (const prop of props) for (const p of PROFILES) {
  const t0 = Date.now();
  runs.set(`${prop.id} ${p.id}`, play(p, prop));
  console.error(`${prop.id} ${p.id}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
const get = (id: string, p: Profile) => runs.get(`${id} ${p.id}`)!;
const sign = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
/** A Lighthouse day, and its difference with the rules. */
const vs = (id: string, p: Profile, l: number) => {
  const r = get(id, p).lh[l] ?? null;
  const b = get("rules", p).lh[l] ?? null;
  return r === null ? "never" : id === "rules" || b === null ? d(r) : `${d(r)} (${sign(r - b)})`;
};
const city = (id: string, p: Profile) => {
  const r = get(id, p).done;
  const b = get("rules", p).done;
  return r === null ? "never" : id === "rules" || b === null ? `day ${r}` : `day ${r} (${sign(r - b).replace(".0", "")})`;
};
const ids = (pred: (x: Proposal) => boolean) => props.filter((x) => x.id === "rules" || pred(x)).map((x) => x.id);
const name = (id: string) => H.PROPOSALS.find((x) => x.id === id)!.name;
const table = (head: string[], cells: (id: string, p: Profile) => string[], list: string[]) => {
  const out = [`| Setup | Player | ${head.join(" | ")} |`, `| --- | --- |${" --- |".repeat(head.length)}`];
  for (const id of list) for (const p of PROFILES) out.push(`| ${name(id)} | ${p.name} | ${cells(id, p).join(" | ")} |`);
  return out.join("\n");
};

print("### Expeditions\n");
print(
  table(
    ["Lighthouse 15", "20", "25", "30 (vs the rules)", "Whole city at 30", "Sessions short of fish (first year)", "Short of Pearls", "Expeditions (short, 8 h, 12 h)", "Base resources brought", "Amber brought, spent, sessions short of it", "Soldiers lost"],
    (id, p) => {
      const r = get(id, p);
      const short = H.PROPOSALS.find((x) => x.id === id)!.hunt?.zones[0]!.id ?? "reef";
      const z = (k: string) => r.zones[k]?.sent ?? 0;
      const brought = Object.values(r.zones).reduce((s, x) => s + x.brought, 0);
      const lost = Object.values(r.zones).reduce((s, x) => s + x.lost, 0);
      return [d(r.lh[15]!), d(r.lh[20]!), d(r.lh[25]!), vs(id, p, 30), city(id, p), `${r.blocked.fish} (${r.year.fish})`, `${r.blocked.pearls}`, `${z(short)}, ${z("deeps")}, ${z("abyss")}`, n(brought), `${n(r.amber.left + r.amber.spent)}, ${n(r.amber.spent)}, ${r.amber.short}`, n(lost)];
    },
    ids((x) => !!x.hunt),
  ),
);
print("\n### Speed-ups\n");
print(
  table(
    ["Lighthouse 15", "20", "25", "30 (vs the rules)", "Whole city at 30", "Sessions short of fish (first year)", "Hours taken off", "Resources spent on them"],
    (id, p) => {
      const r = get(id, p);
      return [vs(id, p, 15), vs(id, p, 20), vs(id, p, 25), vs(id, p, 30), city(id, p), `${r.blocked.fish} (${r.year.fish})`, r.speed.hours.toFixed(0), n(r.speed.spent)];
    },
    ids((x) => !!x.speedup),
  ),
);
print("\n### Contested isles and shoals\n");
print(
  table(
    ["Lighthouse 30 (vs the rules)", "Whole city at 30", "Sessions short of fish (first year)", "short of wood", "Wood and fish the fleets took from isles and shoals", "of which to another city"],
    (id, p) => {
      const r = get(id, p);
      return [vs(id, p, 30), city(id, p), `${r.blocked.fish} (${r.year.fish})`, `${r.blocked.wood}`, n(r.taken.isle + r.taken.fish), n(r.taken.lost)];
    },
    ids((x) => x.contest !== undefined),
  ),
);

const text = out.join("\n");
console.log(text);
// A whole run (every proposal, two years) writes its tables into the study, between its marks.
if (!ONLY && DAYS === 730) {
  const doc = readFileSync(DOC, "utf8");
  const a = doc.indexOf(MARK_START);
  const b = doc.indexOf(MARK_END);
  if (a < 0 || b < a) throw new Error("sea-hunt.md has lost its marks");
  writeFileSync(DOC, `${doc.slice(0, a + MARK_START.length)}\n\n${text}\n\n${doc.slice(b)}`);
}
