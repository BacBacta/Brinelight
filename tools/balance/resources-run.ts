/**
 * npx tsx tools/balance/resources-run.ts: the resources study (docs/studies/resources.md). Plays the balance's
 * simulator with the rules of `shared/` (A + C since 23 October) and with each variant of the study, through
 * `resources-hooks.mjs`, then writes the tables between the markers of `docs/studies/resources.md`. It changes no rule.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";

// The simulator gets the study's rules in place of `@brinelight/shared`, and shared/ its knobs: registered first.
register("./resources-hooks.mjs", import.meta.url);
const { PROFILES, simulate } = await import("./simulate.js");
const R = await import("./resources-rules.js");
const S = await import("./resources.js");
const { BUILDING_IDS, HOUR, STARTING_BUILDINGS, STOKE_MULTIPLIER, netRates, storeCap, survivorCap, upgradeCost, upgradeTime } = await import("@brinelight/shared");
type Profile = (typeof PROFILES)[number];
type Variant = NonNullable<typeof R.study.variant>;
type Res = "oil" | "fish" | "wood";

const docs = fileURLToPath(new URL("../../docs/", import.meta.url));
const MARK_START = "<!-- resources:generated:start (npx tsx tools/balance/resources-run.ts) -->";
const MARK_END = "<!-- resources:generated:end -->";

const at = (h: number, m = 0) => h * HOUR + m * 60;
/** The study's players: the balance's, who keep the Lighthouse's reserve only on what a spending uses (the default since E). */
const study = (p: Profile): Profile => p;
/** The balance's players of before the study: the whole reserve held. */
const before = (p: Profile): Profile => ({ ...p, holdWholeReserve: true });
const FOLLOWER: Profile = { id: "regular", name: "Follows the quests", questFirst: true, sessions: Array.from({ length: 14 * 60 + 1 }, (_, i) => at(8, i)) };
const ISLAND: Profile = { ...PROFILES[1]!, name: "Island only (6 sessions, never at sea)", noSea: true };
const LONG = (p: Profile) => (p.id === "casual" ? 400 : 365);
/** Who the study plays, in the tables' order: the quest follower (its first 3 days), the three players, the island alone. */
const players = (keep: (p: Profile) => Profile) => [
  { key: "follower", label: "Follows the quests", profile: keep(FOLLOWER), days: 3 },
  { key: "dedicated", label: "Dedicated (10)", profile: keep(PROFILES[2]!), days: LONG(PROFILES[2]!) },
  { key: "regular", label: "Regular (6)", profile: keep(PROFILES[1]!), days: LONG(PROFILES[1]!) },
  { key: "casual", label: "Casual (3)", profile: keep(PROFILES[0]!), days: LONG(PROFILES[0]!) },
  { key: "island", label: "Island only", profile: keep(ISLAND), days: 365 },
];

type Result = {
  reached: Record<number, number>;
  dayTwo: { short: number; capped: number; away: number };
  mornings: { failed: number; all: number; busy: number };
  sea10: Record<Res, number | null>;
  full: Record<Res, number>;
  lostPerDay: Record<Res, number>;
  leftAtSeaPerDay: Record<Res, number>;
  missed: number;
  income: typeof R.study.m.income;
  lost: typeof R.study.m.lost;
  days: number;
};

const play = (v: Variant | null, p: Profile, days: number): Result => {
  R.useVariant(v);
  const run = simulate(p, days);
  const m = R.study.m;
  const sumPerDay = (rec: Record<number, Record<Res, number>>) => S.lostPerDay(rec, 0, days);
  return {
    reached: run.lighthouse,
    dayTwo: m.idle[S.DAY_TWO] ?? { short: 0, capped: 0, away: 0 },
    mornings: { failed: S.failedMornings(m), all: m.mornings.length, busy: m.mornings.filter((x) => !x.builderFree).length },
    sea10: S.seaShare(m.income, 10),
    full: { oil: run.fullHours.oil / (days * 24), fish: run.fullHours.fish / (days * 24), wood: run.fullHours.wood / (days * 24) },
    lostPerDay: sumPerDay(m.lost),
    leftAtSeaPerDay: sumPerDay(m.leftAtSea),
    missed: run.mists.missed,
    income: m.income,
    lost: m.lost,
    days,
  };
};

// The rules first: the balance's players must play the balance's own runs (docs/balance.md, its milestones).
const balance = readFileSync(`${docs}balance.md`, "utf8");
const today = players(before).map((x) => ({ ...x, result: play(null, x.profile, x.days) }));
for (const x of today.filter((t) => t.key === "dedicated" || t.key === "regular" || t.key === "casual")) {
  const days = [5, 10, 15, 20, 25, 30].map((l) => `day ${(x.result.reached[l]! / 24).toFixed(1)}`);
  if (!balance.includes(`| ${x.profile.name} | ${days.join(" | ")} |`)) throw new Error(`${x.profile.name}: the run is not the balance's (${days.join(", ")})`);
}
const base = players(study).map((x) => ({ ...x, result: play(null, x.profile, x.days) }));
const runs = S.VARIANTS.map((v) => ({ variant: v, results: players(study).map((x) => ({ ...x, result: play(v, x.profile, x.days) })) }));
const all = [{ variant: { id: "base", name: "A + C (the rules)" } as Variant, results: base }, ...runs];

const h = (x: number) => x.toFixed(1);
const sum3 = (r: Record<Res, number>) => r.oil + r.fish + r.wood;
const n = (x: number) => Math.round(x).toLocaleString("en-US");
const table = (head: string[], rows: string[][]) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
const labels = base.map((x) => x.label);
const grid = (cell: (r: Result, key: string) => string) => table(["Variant", ...labels], all.map((a) => [a.variant.name, ...a.results.map((x) => cell(x.result, x.key))]));

/* ---------- The causes ---------- */

// The rules' own numbers from here: no variant's knob left set.
R.useVariant(null);

// 0. Day 2, the balance's players of today against the study's.
const dayTwo = table(
  ["Players", ...labels],
  [
    ["The balance's, today (all the reserve held)", ...today.map((x) => `${h(x.result.dayTwo.short)} h (away ${h(x.result.dayTwo.away)})`)],
    ["The study's (the reserve held only on what is spent)", ...base.map((x) => `${h(x.result.dayTwo.short)} h (away ${h(x.result.dayTwo.away)})`)],
  ],
);
const todayMilestones = table(
  ["Players", "Profile", "Lighthouse 5", "10", "15", "20", "25", "30"],
  [...today, ...base]
    .filter((x) => x.key !== "follower")
    .map((x, i) => [i < 4 ? "today's" : "the study's", x.label, ...[5, 10, 15, 20, 25, 30].map((l) => S.day(S.dayOf(x.result.reached[l])))]),
);

// 1. Production per level, against what two builders spend per hour at that level.
const rates = (level: number, raise = false) => {
  const L = raise ? S.raised(level) : level;
  return netRates({ buildings: { ...STARTING_BUILDINGS, lighthouse: 0, refinery: L, fishery: L, lumberyard: L }, techs: {}, rafts: {}, survivors: 0, morale: 0 });
};
const spend = (level: number) => {
  const lh = upgradeCost("lighthouse", level);
  const t = upgradeTime("lighthouse", level) / HOUR;
  const others = BUILDING_IDS.filter((b) => b !== "lighthouse");
  const avg = { oil: 0, fish: 0, wood: 0 };
  for (const b of others) {
    const c = upgradeCost(b, level);
    const bt = upgradeTime(b, level) / HOUR;
    for (const k of ["oil", "fish", "wood"] as const) avg[k] += (c[k] ?? 0) / bt / others.length;
  }
  return { oil: (lh.oil ?? 0) / t + avg.oil, fish: avg.fish, wood: (lh.wood ?? 0) / t + avg.wood, lhWood: lh.wood ?? 0, lhOil: lh.oil ?? 0, lhHours: t };
};
const cover = (made: number, spent: number) => `${Math.round((100 * made) / spent)} %`;
const production = table(
  ["Level", "Wood / h", "Oil / h", "Fish / h", "Lighthouse to the next: wood, oil (build)", "Hours of the Lumberyard to pay its wood", "Two builders spend / h: wood, oil, fish", "Covered today: wood, oil, fish", "Covered with A: wood, oil, fish"],
  [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20].map((L) => {
    const r = rates(L);
    const a = rates(L, true);
    const s = spend(L);
    return [String(L), n(r.wood), n(r.oil), n(r.fish), `${n(s.lhWood)}, ${n(s.lhOil)} (${s.lhHours.toFixed(1)} h)`, h(s.lhWood / r.wood), `${n(s.wood)}, ${n(s.oil)}, ${n(s.fish)}`, `${cover(r.wood, s.wood)}, ${cover(r.oil, s.oil)}, ${cover(r.fish, s.fish)}`, `${cover(a.wood, s.wood)}, ${cover(a.oil, s.oil)}, ${cover(a.fish, s.fish)}`];
  }),
);

// 2. The storage: hours of production to fill it from empty, with every producer at the Lighthouse's level.
const net = (L: number, raise = false) => {
  const made = rates(L, raise);
  const eaten = survivorCap(L) * 0.6;
  return { wood: made.wood, oil: made.oil - 2.5 * L, fish: made.fish - eaten };
};
const fill = (cap: number, rate: number) => (rate <= 0 ? "never" : `${h(cap / rate)} h`);
const storage = table(
  ["Lighthouse", "Storage", "Hours to fill: wood, oil, fish (today)", "With A", "The lowest Refinery that keeps the stoked Lighthouse lit: today, with A"],
  [5, 6, 8, 10, 12, 15, 18, 20, 25, 30].map((L) => {
    const cap = storeCap(L);
    const t = net(L);
    const a = net(L, true);
    const burn = 2.5 * L * STOKE_MULTIPLIER;
    const lowest = (raise: boolean) => Array.from({ length: 30 }, (_, i) => i + 1).find((r) => rates(r, raise).oil >= burn) ?? 30;
    return [String(L), n(cap), `${fill(cap, t.wood)}, ${fill(cap, t.oil)}, ${fill(cap, t.fish)}`, `${fill(cap, a.wood)}, ${fill(cap, a.oil)}, ${fill(cap, a.fish)}`, `level ${lowest(false)}, level ${lowest(true)}`];
  }),
);
const losses = table(
  ["Profile", "Production cut off a day (oil, fish, wood): days 1–30", "31–90", "91–365", "Brought back and left at sea a day, days 1–365", "Hours full (oil, fish, wood), share of the run"],
  base
    .filter((x) => x.key !== "follower")
    .map((x) => {
      const r = x.result;
      const per = (from: number, to: number) => {
        const l = S.lostPerDay(r.lost, from, to);
        return `${n(l.oil)}, ${n(l.fish)}, ${n(l.wood)}`;
      };
      return [x.label, per(0, 30), per(30, 90), per(90, r.days), `${n(r.leftAtSeaPerDay.oil)}, ${n(r.leftAtSeaPerDay.fish)}, ${n(r.leftAtSeaPerDay.wood)}`, `${S.share(r.full.oil)}, ${S.share(r.full.fish)}, ${S.share(r.full.wood)}`];
    }),
);

// 3. Where each resource comes from, by Lighthouse band, today.
const BANDS: [number, number][] = [[1, 5], [5, 10], [10, 15], [15, 20], [20, 25], [25, 31]];
const sources = (results: typeof base) => {
  const rows: string[][] = [];
  for (const x of results.filter((r) => r.key === "dedicated" || r.key === "regular" || r.key === "casual")) {
    for (const [from, to] of BANDS) {
      const got = S.incomeBetween(x.result.income, from, to);
      const cell = (k: Res) => {
        const total = Object.values(got).reduce((t, s) => t + s[k], 0);
        if (total <= 0) return "–";
        const part = (s: string[]) => Math.round((100 * s.reduce((t, src) => t + (got[src as keyof typeof got]?.[k] ?? 0), 0)) / total);
        return `${part(["buildings"])} / ${part(["wrecks", "isles", "shoals"])} / ${part(["camps"])} / ${part(["rewards"])}`;
      };
      rows.push([x.label, `${from}–${to - 1}`, cell("wood"), cell("oil"), cell("fish")]);
    }
  }
  return table(["Profile", "Lighthouse", "Wood: island / sea / camps / rewards (%)", "Oil", "Fish"], rows);
};

/* ---------- The options ---------- */

const dayTwoGrid = grid((r) => `${h(r.dayTwo.short)} h`);
const morningsGrid = grid((r) => `${r.mornings.failed} of ${r.mornings.all}`);
const baseOf = (key: string) => base.find((x) => x.key === key)!.result;
const milestones = (levels: number[]) =>
  table(
    ["Variant", "Profile", ...levels.map((l) => `Lighthouse ${l}`)],
    all.flatMap((a) =>
      a.results
        .filter((x) => x.key !== "follower")
        .map((x) => [a.variant.name, x.label, ...levels.map((l) => {
          const d = S.dayOf(x.result.reached[l]);
          const b = S.dayOf(baseOf(x.key).reached[l]);
          return a.variant.id === "base" ? S.day(d) : `${S.day(d)} (${S.pct(d, b)})`;
        })]),
    ),
  );
const seaGrid = table(
  ["Variant", ...labels.filter((l) => l !== "Follows the quests" && l !== "Island only")],
  all.map((a) => [a.variant.name, ...a.results.filter((x) => x.key !== "follower" && x.key !== "island").map((x) => `${S.share(x.result.sea10.wood)} wood, ${S.share(x.result.sea10.fish)} fish`)]),
);
const survivalGrid = grid((r) => String(r.missed));
const fullGrid = table(
  ["Variant", ...labels.filter((l) => l !== "Follows the quests")],
  all.map((a) => [a.variant.name, ...a.results.filter((x) => x.key !== "follower").map((x) => `${S.share(x.result.full.wood)} / ${S.share(x.result.full.fish)} (${n(sum3(x.result.lostPerDay) + sum3(x.result.leftAtSeaPerDay))} a day)`)]),
);
const harvest = table(
  ["Lighthouse", "Wooded Isles (5): holds, each", "Fish Shoals (6): holds, each"],
  [1, 5, 10, 15, 20, 25, 30].map((L) => [String(L), `${n(S.harvestAmount(360, L))} to ${n(S.harvestAmount(600, L))}`, `${n(S.harvestAmount(360, L))} to ${n(S.harvestAmount(600, L))}`]),
);
const curve = table(
  ["Level", ...Array.from({ length: 15 }, (_, i) => String(i + 1))],
  [["Rules: makes as level", ...Array.from({ length: 15 }, (_, i) => String(i + 1))], ["A: makes as level", ...Array.from({ length: 15 }, (_, i) => String(S.raised(i + 1)))], ["A: wood / h", ...Array.from({ length: 15 }, (_, i) => n(rates(i + 1, true).wood))]],
);

const tables = [
  "### 0. Day 2: how the simulated players spend",
  "Builder hours left free on day 2 for lack of resources (two builders: up to 48), and in brackets the hours a builder finished while the player was away. Both rows play the same rules.",
  dayTwo,
  "The same players' milestones, the rules unchanged:",
  todayMilestones,
  "### 1. Production per level against what the builders spend",
  "Every producer at the level, no research. Two builders spend: the Lighthouse's next level and the average other building's, each per hour of its build.",
  production,
  "### 2. The storage",
  "Hours of production to fill the storage from empty, every producer at the Lighthouse's level: wood as made, oil after what the Lighthouse burns, fish after what a full town eats.",
  storage,
  "What the storage cut off, for the study's players (today's rules):",
  losses,
  "### 3. Where each resource comes from, today",
  "Share of what came in at each Lighthouse band, for the study's players: the island's buildings, the sea (wrecks), the camps' loot, the rewards (objectives and chests).",
  sources(base),
  "### The options: their values",
  "A, the producers' curve (the Lumberyard, the Refinery and the Fishery alike):",
  curve,
  "C, what an isle or a shoal holds (the map's amounts are 360 to 600), refilled 8 hours after it is emptied:",
  harvest,
  "### Goal 1: builders waiting for resources on day 2 (at most 16 h)",
  dayTwoGrid,
  "### Goal 2: mornings when a builder is free and nothing can be paid for (the Lighthouse or a producer)",
  "Mornings: the first session after a night of 6 hours or more, before noon, over the whole run.",
  morningsGrid,
  "### Goal 3: the Lighthouse's milestones",
  "In brackets: against the rules (A + C), for the same players.",
  milestones([5, 10, 15, 20, 25, 30]),
  "### Goal 4: the sea's share from Lighthouse 10 (target: 30 to 50 % of the wood and the fish)",
  seaGrid,
  "### Goal 5: the Mists missed (the oil always lasts)",
  survivalGrid,
  "### The storage full, and what it cut off",
  "Share of the run with the wood / the fish full, and what the storage cut off a day (production and cargo left at sea).",
  fullGrid,
].join("\n\n");

const file = `${docs}studies/resources.md`;
const text = readFileSync(file, "utf8");
const a = text.indexOf(MARK_START);
const b = text.indexOf(MARK_END);
if (a < 0 || b < a) {
  console.log(tables);
  throw new Error(`${file}: its markers are missing`);
}
writeFileSync(file, `${text.slice(0, a + MARK_START.length)}\n\n${tables}\n\n${text.slice(b)}`);
console.log(`${file}: written`);
