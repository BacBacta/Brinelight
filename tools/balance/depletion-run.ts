/**
 * npm run study:depletion: plays the study of docs/studies/depletion.md (depletion.ts) and writes its tables (between
 * the report's markers) and its charts (docs/studies/depletion/). It changes no value of the rules.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HOUR, LIGHTHOUSE_MAX, newPlayerState, type PlayerState } from "@brinelight/shared";
import { BRACKETS, ISLAND, SETTINGS, SPEEDS, mistMargin, spiral, study, type IslandResource, type SeaMode, type Setting, type StudyRun } from "./depletion.js";
import type { Profile } from "./simulate.js";

const DAYS = 730;
const at = (hours: number, minutes = 0) => hours * HOUR + minutes * 60;
const FOUR = [at(8), at(12, 30), at(18), at(22)];

/** The players of the study. */
const ACTIVE: Profile = { id: "regular", name: "Active (4 sessions, the sea)", sessions: FOUR };
const CASUAL: Profile = { id: "casual", name: "Casual (1 session, little sea)", sessions: [at(20)] };
const ISLAND_ONLY: Profile = { id: "regular", name: "Island only (4 sessions, never the sea)", sessions: FOUR, skip: { sea: true, hunts: true }, producersFirst: true };
const AWAY_FROM = 201;
const AWAY_TO = 208;
const AWAY: Profile = { id: "away", name: `Away 7 days (active, no session on days ${AWAY_FROM} to ${AWAY_TO - 1})`, sessions: FOUR, away: { from: AWAY_FROM, to: AWAY_TO } };
const PROFILES = [ACTIVE, CASUAL, ISLAND_ONLY, AWAY] as const;
const MILESTONES = [8, 10, 15, 20, 25, 30] as const;
/** The setting recommended by the report: its charts and its detail. */
const RECOMMENDED = "soft";

const docs = fileURLToPath(new URL("../../docs/studies/", import.meta.url));
const t0 = performance.now();
const runs: StudyRun[] = [];
const play = (setting: Setting, profile: Profile, sea: SeaMode = "today", tide = false) => {
  const r = study(setting, profile, DAYS, { sea, tide });
  runs.push(r);
  return r;
};
for (const p of PROFILES) for (const set of SETTINGS) play(set, p);
for (const p of [ACTIVE, CASUAL]) for (const set of SETTINGS) play(set, p, "full");
for (const p of [ACTIVE, CASUAL, ISLAND_ONLY]) for (const set of SETTINGS) play(set, p, "today", true);
const find = (setting: string, profile: Profile, sea: SeaMode = "today", tide = false) => {
  const r = runs.find((x) => x.setting.id === setting && x.profile === profile && x.seaMode === sea && x.tide === tide);
  if (!r) throw new Error(`No run for ${setting}, ${profile.name}, ${sea}, tide ${tide}`);
  return r;
};
// The speeds' sensitivity, for the recommended floor: half as fast and twice as fast.
const rec = SETTINGS.find((x) => x.id === RECOMMENDED)!;
const sensitivity = [
  ...([0.5, 2] as const).flatMap((k) =>
    [ACTIVE, ISLAND_ONLY].map((p) => ({ label: `speeds ×${k}`, profile: p, run: study({ ...rec, id: `${rec.id}x${k}`, draw: rec.draw * k, regrowWork: rec.regrowWork * k, regrowRest: rec.regrowRest * k }, p, DAYS) })),
  ),
  ...[ACTIVE, ISLAND_ONLY].map((p) => ({ label: "renews 4 levels, not 7", profile: p, run: study({ ...rec, id: `${rec.id}s4`, sustain: 4 }, p, DAYS) })),
];
/** The rest without fallow: the island away gives as its reserve allows (the first rule tried; it favors the player away). */
const unfallow = SETTINGS.filter((x) => x.floor !== null).map((set) => ({ set, run: study({ ...set, fallow: false }, AWAY, DAYS), stayed: study({ ...set, fallow: false }, ACTIVE, DAYS) }));
console.log(`${runs.length + sensitivity.length + 2 * unfallow.length} runs of ${DAYS} days in ${((performance.now() - t0) / 1000).toFixed(0)} s`);

// ---------- Tables ----------
const day = (r: StudyRun, level: number) => (r.run.lighthouse[level] === undefined ? null : r.run.lighthouse[level]! / 24);
const fmtDay = (d: number | null) => (d === null ? "not reached" : `day ${d < 10 ? d.toFixed(1) : d.toFixed(0)}`);
const delta = (d: number | null, ref: number | null) => (d === null || ref === null ? "" : ref === 0 ? "" : ` (${d >= ref ? "+" : ""}${Math.round((d / ref - 1) * 100)} %)`);
const pct = (x: number) => `${Math.round(x * 100)} %`;
const table = (head: string[], rows: string[][]) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
const reached = (r: StudyRun) => r.days.at(-1)!.lighthouse;

const out: string[] = [];
out.push(`_${runs.length + sensitivity.length + 2 * unfallow.length} runs of ${DAYS} days each; the speeds of the three settings: the island renews ${SPEEDS.sustain} levels of each producer, each level above takes ${(SPEEDS.draw * 100).toFixed(2)} % of the reserve per hour of harvest, the reserve fills again by ${(SPEEDS.regrowWork * 100).toFixed(1)} % of what is missing per hour while harvested and ${(SPEEDS.regrowRest * 100).toFixed(1)} % while resting._`);

out.push("\n### 1. Time to reach the Lighthouse levels (days after the city is founded; in brackets, against the game today)\n");
for (const p of PROFILES) {
  out.push(`**${p.name}**\n`);
  const ref = find("none", p);
  out.push(
    table(
      ["Setting", ...MILESTONES.map((l) => `Lighthouse ${l}`), `Level on day ${DAYS}`],
      SETTINGS.map((set) => {
        const r = find(set.id, p);
        return [set.name, ...MILESTONES.map((l) => fmtDay(day(r, l)) + (set.id === "none" ? "" : delta(day(r, l), day(ref, l)))), String(reached(r))];
      }),
    ),
  );
  out.push("");
}

out.push("**The Tide (+15 % to one island resource, a week each): the same players**\n");
out.push(
  table(
    ["Profile", "Setting", ...MILESTONES.map((l) => `Lighthouse ${l}`), `Level on day ${DAYS}`],
    [ACTIVE, CASUAL, ISLAND_ONLY].flatMap((p) =>
      SETTINGS.map((set) => {
        const r = find(set.id, p, "today", true);
        const plain = find(set.id, p);
        return [p.name.split(" (")[0]!, set.name.split(" (")[0]!, ...MILESTONES.map((l) => fmtDay(day(r, l)) + delta(day(r, l), day(plain, l))), String(reached(r))];
      }),
    ),
  ),
);
out.push("\n_In brackets: against the same setting without the Tide._\n");

out.push("**With the Fish Shoals and Wooded Isles open (a guess: fleets go there as to the wrecks, same hold, trip and 2 h refill, the map's amounts)**\n");
out.push(
  table(
    ["Profile", "Setting", ...MILESTONES.map((l) => `Lighthouse ${l}`), `Level on day ${DAYS}`],
    [ACTIVE, CASUAL].flatMap((p) =>
      SETTINGS.map((set) => {
        const r = find(set.id, p, "full");
        const plain = find(set.id, p);
        return [p.name.split(" (")[0]!, set.name.split(" (")[0]!, ...MILESTONES.map((l) => fmtDay(day(r, l)) + delta(day(r, l), day(plain, l))), String(reached(r))];
      }),
    ),
  ),
);
out.push("\n_In brackets: against the same setting with today's sea._\n");

out.push("### 2. Where the resources come from: the island's share of the oil, fish and wood gathered, by Lighthouse levels\n");
const share = (r: StudyRun, b: number, k?: IslandResource) => {
  const keys = k ? [k] : ISLAND;
  const i = keys.reduce((n, x) => n + r.island[b]![x], 0);
  const s = keys.reduce((n, x) => n + r.fromSea[b]![x], 0);
  return i + s === 0 ? "–" : pct(i / (i + s));
};
const bracketHead = BRACKETS.map(([a, b]) => `Lighthouse ${a}–${b}`);
for (const [p, sea] of [
  [ACTIVE, "today"],
  [CASUAL, "today"],
  [ACTIVE, "full"],
] as const) {
  out.push(`**${p.name}${sea === "full" ? ", with the shoals and isles open (guess)" : ""}**: all three together, then the oil alone\n`);
  out.push(
    table(
      ["Setting", ...bracketHead],
      SETTINGS.flatMap((set) => {
        const r = find(set.id, p, sea);
        return [
          [set.name, ...BRACKETS.map((_, b) => share(r, b))],
          [`${set.name.split(" (")[0]}: oil`, ...BRACKETS.map((_, b) => share(r, b, "oil"))],
        ];
      }),
    ),
  );
  out.push("");
}
out.push("_The island-only player takes 100 % from the island by definition. A dash: the bracket was not reached._\n");

out.push("### 3. Hours a day a builder waits for resources (the last session found nothing it could pay for), by Lighthouse levels\n");
for (const p of PROFILES) {
  out.push(`**${p.name}**\n`);
  out.push(
    table(
      ["Setting", ...bracketHead, "Whole run"],
      SETTINGS.map((set) => {
        const r = find(set.id, p);
        const total = r.waits.reduce((a, b) => a + b, 0) / r.bracketDays.reduce((a, b) => a + b, 0);
        return [set.name, ...BRACKETS.map((_, b) => (r.bracketDays[b]! < 0.5 ? "–" : (r.waits[b]! / r.bracketDays[b]!).toFixed(1))), total.toFixed(1)];
      }),
    ),
  );
  out.push("");
}

out.push("### 4. The Mist's oil with the island empty, at every Lighthouse level\n");
out.push(
  "A day with the reserve of oil at 0 (the island at its floor), no oil in store and no sea: what the Refinery makes in 24 hours (no slowdown in the Mist, the Lighthouse being stoked) against what the Lighthouse burns (18 hours as usual, 6 hours stoked, ×1.5). **Margin**: what is left at the end of the day, in share of what was burnt. **No**: the oil made between two Mists does not cover what a Mist burns beyond what it makes, so a Mist is lost with an empty store. \"Today\" is the same day with the island at 100 %: the game as it is, without the sea.\n",
);
const floors = SETTINGS.filter((x) => x.floor !== null);
const columns = [{ name: "Today (100 %)", floor: 1 }, ...floors.map((f) => ({ name: f.name, floor: f.floor! }))];
const cell = (floor: number, s: PlayerState) => {
  const m = mistMargin(floor, s);
  return `${m.margin >= 0 ? "+" : ""}${pct(m.margin)}${m.held ? "" : ", **no**"}`;
};
/** A city built for the island: its Refinery at the Lighthouse's level, no research. */
const built = (level: number): PlayerState => {
  const s = newPlayerState(0);
  return { ...s, buildings: { ...s.buildings, lighthouse: level, refinery: level } };
};
out.push("**A city whose Refinery keeps up with its Lighthouse** (the same at every level: what is made and what is burnt both grow with it; morale 84 as in every city of the balance, so no bonus):\n");
const withRefining = (t: number): PlayerState => {
  const c = built(10);
  return { ...c, techs: { ...c.techs, refining: t } };
};
out.push(table(["Refining research", ...columns.map((c) => c.name)], [0, 1, 2, 3].map((t) => [String(t), ...columns.map((c) => cell(c.floor, withRefining(t)))])));
out.push("");
out.push("**Each player's own city, as it was when it reached each level** (the lowest margin over levels 2 to 30, and the levels where a Mist is lost):\n");
const own = (p: Profile) => {
  const r = find("none", p);
  const ls = Object.keys(r.snapshots).map(Number).filter((l) => l >= 2).sort((a, b) => a - b);
  return [p.name, ...columns.map((c) => {
    const ms = ls.map((l) => ({ l, m: mistMargin(c.floor, r.snapshots[l]!) }));
    const worst = Math.min(...ms.map((x) => x.m.margin));
    const lost = ms.filter((x) => !x.m.held).map((x) => x.l);
    const span = lost.length === 0 ? "none" : lost.length === ls.length ? "all" : `${lost.length} levels (${lost[0]}–${lost.at(-1)})`;
    return `${worst >= 0 ? "+" : ""}${pct(worst)}; lost at: ${span}`;
  })];
};
out.push(table(["Profile", ...columns.map((c) => c.name)], [ACTIVE, CASUAL, ISLAND_ONLY].map(own)));
out.push("");
const base = find("none", ACTIVE);
out.push("The active player's Refinery, by Lighthouse level (the balance's order: the Lighthouse first, then the lowest building, the Lighthouse's cost kept aside): " + [5, 10, 15, 20, 25, 30].map((l) => `${l}: ${base.snapshots[l]?.buildings.refinery ?? "–"}`).join(", ") + ".\n");
out.push("**Mists missed over the whole run** (the order to stoke left on, as for every player of the balance):\n");
out.push(table(["Profile", ...SETTINGS.map((x) => x.name)], PROFILES.map((p) => [p.name, ...SETTINGS.map((set) => String(find(set.id, p).run.mists.missed))])));
out.push("");

out.push("### 5. Looking for a spiral\n");
out.push(
  "The worst case: a city as it was at a Lighthouse level, its oil gone, its island held at the floor, no sea and nothing built for 14 days, the order to stoke on, the rafts repaired as soon as one is below 60 (paid in oil) as the balance's player does. Mists missed over days 8 to 14 (21 Mists), once the first days are past; in brackets, over the 14 days. A row \"no repairs\" is added only where it differs: everywhere else, the same runs without any repair give the same numbers.\n",
);
const spiralLevels = [5, 8, 10, 15, 20, 25, 30];
const spiralRow = (label: string, r: StudyRun, floor: number, repairs: boolean) => [
  label,
  ...spiralLevels.map((l) => {
    const snap = r.snapshots[l];
    if (!snap) return "–";
    const m = spiral(floor, snap, 14, repairs);
    return `${m.slice(7).reduce((a, b) => a + b, 0)} (${m.reduce((a, b) => a + b, 0)})`;
  }),
];
const spiralRows: string[][] = [];
for (const [who, r] of [
  ["Island-only player's city", find("none", ISLAND_ONLY)],
  ["Active player's city", base],
] as const)
  for (const c of columns) {
    spiralRows.push(spiralRow(`${who}, ${c.name}`, r, c.floor, true));
    const without = spiralRow("", r, c.floor, false);
    const withRow = spiralRows.at(-1)!;
    if (without.slice(1).join() !== withRow.slice(1).join()) spiralRows.push([`${who}, ${c.name}, no repairs`, ...without.slice(1)]);
  }
out.push(table(["City, setting", ...spiralLevels.map((l) => `Lighthouse ${l}`)], spiralRows));
out.push("");

out.push("### 6. Back after 7 days away\n");
out.push(`The active player, away from day ${AWAY_FROM} to day ${AWAY_TO - 1} (no session), against the same player who stayed, under the same setting.\n`);
const awayRows = SETTINGS.map((set) => {
  const r = find(set.id, AWAY);
  const ref = find(set.id, ACTIVE);
  const before = r.days.find((d) => d.day === AWAY_FROM - 1)!;
  const back = r.days.find((d) => d.day === AWAY_TO - 1)!;
  const ret = r.run.returned;
  const lh = back.lighthouse;
  const lateBy = (level: number) => {
    const a = day(r, level);
    const b = day(ref, level);
    if (a === null || b === null) return "–";
    const n = Math.round(a - b);
    return `${n} day${Math.abs(n) === 1 ? "" : "s"}`;
  };
  const avg = (d: StudyRun["days"][number]) => (d.reserve.oil + d.reserve.fish + d.reserve.wood) / 3;
  // How long the rested island stays ahead of the island of the player who stayed.
  const ahead = r.days.find((d) => d.day >= AWAY_TO && avg(d) <= avg(ref.days[d.day - 1]!) + 0.05);
  return [
    set.name,
    set.floor === null ? "–" : ISLAND.map((k) => pct(before.reserve[k])).join(" / "),
    set.floor === null ? "–" : ISLAND.map((k) => pct(back.reserve[k])).join(" / "),
    String(lh),
    ret ? `${ret.missed}` : "–",
    ret ? `${ret.damaged} of ${ret.rafts}` : "–",
    `${lh + 1}: ${lateBy(lh + 1)}`,
    `${Math.min(LIGHTHOUSE_MAX, lh + 2)}: ${lateBy(Math.min(LIGHTHOUSE_MAX, lh + 2))}`,
    `30: ${lateBy(30)}`,
    set.floor === null ? "–" : ahead ? `${ahead.day - AWAY_TO + 1} days` : "more than the run",
  ];
});
out.push(
  table(
    ["Setting", "Reserves when leaving (oil / fish / wood)", "On return", "Lighthouse", "Mists missed while away", "Rafts damaged", "Later than the player who stayed, at Lighthouse", "…", "…", "Reserves back to the stayer's after"],
    awayRows,
  ),
);
out.push("");
out.push("Without the fallow (the island away gives as its rebuilt reserve allows), the player away overtakes the one who stayed:\n");
out.push(
  table(
    ["Setting", "Lighthouse on return", "Later than the player who stayed, at Lighthouse 30"],
    unfallow.map(({ set, run, stayed }) => {
      const a = day(run, 30);
      const b = day(stayed, 30);
      return [set.name, String(run.days.find((d) => d.day === AWAY_TO - 1)!.lighthouse), a === null || b === null ? "–" : `${Math.round(a - b)} days`];
    }),
  ),
);
out.push("");

out.push("### 7. The island-only player\n");
out.push(
  table(
    ["Setting", ...MILESTONES.map((l) => `Lighthouse ${l}`), `Level on day ${DAYS}`, "Level on day 365"],
    SETTINGS.map((set) => {
      const r = find(set.id, ISLAND_ONLY);
      return [set.name, ...MILESTONES.map((l) => fmtDay(day(r, l))), String(reached(r)), String(r.days.find((d) => d.day === 365)?.lighthouse ?? "–")];
    }),
  ),
);
out.push("");

out.push("### The first 7 days of a new player (Lighthouse at the end of each day)\n");
out.push(
  table(
    ["Profile", "Setting", ...Array.from({ length: 7 }, (_, i) => `Day ${i + 1}`), `Reserves on day 7 (oil / fish / wood), ${rec.name}`],
    [ACTIVE, CASUAL].flatMap((p) =>
      SETTINGS.map((set) => {
        const r = find(set.id, p);
        const recRun = find(RECOMMENDED, p);
        return [p.name.split(" (")[0]!, set.name, ...r.days.slice(0, 7).map((d) => String(d.lighthouse)), set.id === RECOMMENDED ? ISLAND.map((k) => pct(recRun.days[6]!.reserve[k])).join(" / ") : ""];
      }),
    ),
  ),
);
out.push("");

out.push(`### Sensitivity (${rec.name}: depletion and regrowth half as fast and twice as fast; an island that renews 4 levels of each producer instead of 7)\n`);
out.push(
  table(
    ["Profile", "Speeds", ...MILESTONES.map((l) => `Lighthouse ${l}`), `Level on day ${DAYS}`],
    [ACTIVE, ISLAND_ONLY].flatMap((p) => [
      [p.name.split(" (")[0]!, "as proposed", ...MILESTONES.map((l) => fmtDay(day(find(RECOMMENDED, p), l))), String(reached(find(RECOMMENDED, p)))],
      ...sensitivity.filter((x) => x.profile === p).map((x) => [p.name.split(" (")[0]!, x.label, ...MILESTONES.map((l) => fmtDay(day(x.run, l))), String(reached(x.run))]),
    ]),
  ),
);
out.push("");

out.push("### The end of the game (task 7)\n");
const endRows = [ACTIVE, CASUAL, ISLAND_ONLY].flatMap((p) =>
  SETTINGS.map((set) => {
    const r = find(set.id, p);
    const l25 = day(r, 25);
    const l30 = day(r, 30);
    return [p.name.split(" (")[0]!, set.name, fmtDay(l25), fmtDay(l30), l25 !== null && l30 !== null ? `${Math.round(l30 - l25)} days` : "–"];
  }),
);
out.push(table(["Profile", "Setting", "Lighthouse 25", "Lighthouse 30", "From 25 to 30"], endRows));
out.push("");

const report = `${docs}depletion.md`;
const text = readFileSync(report, "utf8");
const start = "<!-- depletion:generated:start (npm run study:depletion) -->";
const end = "<!-- depletion:generated:end -->";
const i = text.indexOf(start);
const j = text.indexOf(end);
if (i < 0 || j < 0) throw new Error("The report's markers are missing");
writeFileSync(report, `${text.slice(0, i + start.length)}\n\n${out.join("\n")}\n${text.slice(j)}`);

// ---------- Charts ----------
mkdirSync(`${docs}depletion`, { recursive: true });
/** Categorical colors in fixed order (the balance's validated three), then a neutral for the game today. */
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a"] as const;
const GRAY = "#7a7a7a";
type Line = { name: string; color: string; points: [number, number][]; dashed?: boolean };
function chart(title: string, lines: Line[], opts: { minX?: number; maxX: number; maxY: number; yLabel: string; yTicks: number[]; yFmt: (v: number) => string; xLabel?: string; height?: number }): string {
  const W = 760, H = opts.height ?? 300, L = 52, R = 150, T = 36, B = 40;
  const minX = opts.minX ?? 0;
  const x = (v: number) => L + ((v - minX) / (opts.maxX - minX)) * (W - L - R);
  const y = (v: number) => T + (1 - v / opts.maxY) * (H - T - B);
  const xTicks = Array.from({ length: 7 }, (_, k) => Math.round(minX + ((opts.maxX - minX) / 6) * k));
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif" font-size="12">`,
    `<rect width="${W}" height="${H}" fill="#ffffff"/>`,
    `<text x="${L}" y="20" font-size="14" font-weight="600" fill="#1d1d1f">${title}</text>`,
    ...opts.yTicks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e6e6e6"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" fill="#5f5f5f">${opts.yFmt(v)}</text>`),
    ...xTicks.map((v) => `<text x="${x(v)}" y="${H - B + 16}" text-anchor="middle" fill="#5f5f5f">${v}</text>`),
    `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" fill="#5f5f5f">${opts.xLabel ?? "day"}</text>`,
    `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="#9a9a9a"/>`,
  ];
  const ends: { y: number; line: Line }[] = [];
  for (const line of lines) {
    const d = line.points.map(([a, b], k) => `${k ? "L" : "M"}${x(a).toFixed(1)},${y(b).toFixed(1)}`).join("");
    parts.push(`<path d="${d}" fill="none" stroke="${line.color}" stroke-width="2"${line.dashed ? ' stroke-dasharray="5 4"' : ""} stroke-linejoin="round"/>`);
    const lastPoint = line.points.at(-1)!;
    ends.push({ y: y(lastPoint[1]), line });
  }
  // Direct labels at the lines' ends, each with its line's color and dash, spread so they never overlap and kept
  // within the plot.
  ends.sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k]!.y - ends[k - 1]!.y < 14) ends[k]!.y = ends[k - 1]!.y + 14;
  const over = (ends.at(-1)?.y ?? 0) - y(0);
  if (over > 0) for (const e of ends) e.y -= over;
  for (const e of ends) {
    parts.push(`<line x1="${W - R + 6}" x2="${W - R + 22}" y1="${e.y}" y2="${e.y}" stroke="${e.line.color}" stroke-width="2"${e.line.dashed ? ' stroke-dasharray="5 4"' : ""}/>`);
    parts.push(`<text x="${W - R + 28}" y="${e.y + 4}" fill="#1d1d1f">${e.line.name}</text>`);
  }
  parts.push("</svg>");
  return parts.join("\n");
}
const NAMES: Record<IslandResource, string> = { oil: "oil", fish: "fish", wood: "wood" };
const series = (r: StudyRun, f: (d: StudyRun["days"][number]) => number, until: number, from = 0) => r.days.filter((d) => d.day >= from && d.day <= until).map((d) => [d.day, f(d)] as [number, number]);
const files: Record<string, string> = {};
for (const [p, file, from, until] of [
  [ACTIVE, "active", 0, 365],
  [CASUAL, "casual", 0, 365],
  [ISLAND_ONLY, "island-only", 0, 365],
  [AWAY, "away", AWAY_FROM - 21, AWAY_TO + 34],
] as const) {
  const r = find(RECOMMENDED, p);
  const lh = series(r, (d) => d.lighthouse / LIGHTHOUSE_MAX, until, from);
  files[`${file}-reserve.svg`] = chart(
    `${p.name}: the island's reserves, ${rec.name}`,
    [...ISLAND.map((k, n) => ({ name: NAMES[k], color: COLORS[n]!, points: series(r, (d) => d.reserve[k], until, from) })), { name: "Lighthouse (÷30)", color: GRAY, dashed: true, points: lh }],
    { minX: from, maxX: until, maxY: 1, yLabel: "reserve", yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => `${Math.round(v * 100)} %` },
  );
  files[`${file}-production.svg`] = chart(
    `${p.name}: the island's production, in share of today's, ${rec.name}`,
    ISLAND.map((k, n) => ({ name: NAMES[k], color: COLORS[n]!, points: series(r, (d) => d.output[k], until, from) })),
    { minX: from, maxX: until, maxY: 1, yLabel: "production", yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => `${Math.round(v * 100)} %`, height: 240 },
  );
}
for (const [p, file] of [
  [ACTIVE, "lighthouse-active"],
  [ISLAND_ONLY, "lighthouse-island-only"],
] as const)
  files[`${file}.svg`] = chart(
    `${p.name}: the Lighthouse by day`,
    SETTINGS.map((set, n) => ({
      name: set.id === "none" ? "today" : set.name.split(" (")[0]!.toLowerCase(),
      color: set.id === "none" ? GRAY : COLORS[n - 1]!,
      dashed: set.id === "none",
      points: series(find(set.id, p), (d) => d.lighthouse, DAYS),
    })),
    { maxX: DAYS, maxY: LIGHTHOUSE_MAX, yLabel: "Lighthouse", yTicks: [0, 5, 10, 15, 20, 25, 30], yFmt: (v) => String(v) },
  );
for (const [name, svg] of Object.entries(files)) writeFileSync(`${docs}depletion/${name}`, svg + "\n");

void ({} as PlayerState);
console.log(`Written: docs/studies/depletion.md and ${Object.keys(files).length} charts`);
