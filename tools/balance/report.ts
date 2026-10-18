/**
 * What the balance simulation writes (pure: strings only): the CSV of every day, the Lighthouse chart (SVG, no library),
 * and the tables of docs/balance.md, between its markers.
 */
import { BUILDING_IDS, type Resource } from "@brinelight/shared";
import type { DayRow, Run } from "./simulate.js";

export const DAYS = 60;
/** The days docs/balance.md compares the profiles at. */
export const CHECKPOINTS = [30, 60] as const;
export const MARK_START = "<!-- balance:generated:start (npm run balance) -->";
export const MARK_END = "<!-- balance:generated:end -->";

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const COLUMNS: [string, (d: DayRow) => string | number][] = [
  ["profile", (d) => d.profile],
  ["day", (d) => d.day],
  ["lighthouse", (d) => d.lighthouse],
  ["power", (d) => d.power],
  ["oil", (d) => d.stock.oil],
  ["fish", (d) => d.stock.fish],
  ["wood", (d) => d.stock.wood],
  ["rope", (d) => d.stock.rope],
  ["pearls", (d) => d.pearls],
  ["storage", (d) => d.storage],
  ["troops", (d) => d.troops],
  ["veterans", (d) => d.veterans],
  ["wounded", (d) => d.wounded],
  ["captains", (d) => d.captains],
  ["lead", (d) => d.lead ?? ""],
  ["lead_level", (d) => d.leadLevel],
  ["stars", (d) => d.stars],
  ...BUILDING_IDS.filter((b) => b !== "lighthouse").map((b): [string, (d: DayRow) => number] => [b, (d) => d.buildings[b]]),
  ["techs", (d) => d.techs],
  ["rafts", (d) => d.rafts],
  ["camps_beaten", (d) => d.campsBeaten],
  ["sessions", (d) => d.sessions],
  ["salvages", (d) => d.salvages],
  ["idle_builder_hours", (d) => d.idleBuilderHours.toFixed(1)],
  ["blocked_sessions", (d) => d.blockedSessions],
  ["blocked_by", (d) => d.blockedBy],
  ["empty_sessions", (d) => d.emptySessions],
  ["started", (d) => d.started.join(" | ")],
];

/** One row per profile and per day. */
export function toCsv(runs: readonly Run[]): string {
  const lines = [COLUMNS.map(([k]) => k).join(",")];
  for (const r of runs) for (const d of r.days) lines.push(COLUMNS.map(([, f]) => cell(f(d))).join(","));
  return lines.join("\n") + "\n";
}

/** Categorical colors, in fixed order (validated: blue, orange, aqua on a light surface). */
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a"] as const;

/** The Lighthouse level, day by day, one line per profile; each line named at its end, and in a legend. */
export function toSvg(runs: readonly Run[]): string {
  const W = 800, H = 380, L = 48, R = 200, T = 40, B = 44;
  const maxDay = Math.max(...runs.map((r) => r.days.length));
  const maxLevel = 15;
  const x = (day: number) => L + ((W - L - R) * day) / maxDay;
  const y = (level: number) => T + ((H - T - B) * (maxLevel - level)) / maxLevel;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, sans-serif" font-size="12" role="img" aria-labelledby="t">`,
    `<title id="t">Lighthouse level by day, for the three profiles (balance simulation)</title>`,
    `<rect width="${W}" height="${H}" fill="#fcfcfb"/>`,
    `<text x="${L}" y="22" font-size="14" font-weight="600" fill="#0b0b0b">Lighthouse level by day</text>`,
  ];
  for (let level = 0; level <= maxLevel; level++) {
    const strong = level % 5 === 0;
    out.push(`<line x1="${L}" x2="${W - R}" y1="${y(level)}" y2="${y(level)}" stroke="${strong ? "#d4d3cf" : "#ecebe8"}" stroke-width="1"/>`);
    if (strong) out.push(`<text x="${L - 8}" y="${y(level) + 4}" text-anchor="end" fill="#52514e">${level}</text>`);
  }
  for (let day = 0; day <= maxDay; day += 10) {
    out.push(`<line x1="${x(day)}" x2="${x(day)}" y1="${T}" y2="${H - B}" stroke="#ecebe8" stroke-width="1"/>`);
    out.push(`<text x="${x(day)}" y="${H - B + 18}" text-anchor="middle" fill="#52514e">${day}</text>`);
  }
  out.push(`<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" fill="#52514e">Days since the city was founded</text>`);
  const ends: { y: number; text: string }[] = [];
  runs.forEach((r, i) => {
    const color = COLORS[i % COLORS.length]!;
    // A step line: the level reached at each hour it was reached.
    const pts: string[] = [`${x(0)},${y(2)}`];
    const levels = Object.entries(r.lighthouse).map(([k, h]) => [Number(k), h / 24] as const).sort((a, b) => a[0] - b[0]);
    let last = 2;
    for (const [level, day] of levels) {
      if (level <= 2 || day > maxDay) continue;
      pts.push(`${x(day).toFixed(1)},${y(last)}`, `${x(day).toFixed(1)},${y(level)}`);
      last = level;
    }
    pts.push(`${x(maxDay)},${y(last)}`);
    out.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"><title>${r.profile.name}</title></polyline>`);
    out.push(`<circle cx="${x(maxDay)}" cy="${y(last)}" r="4" fill="${color}" stroke="#fcfcfb" stroke-width="2"/>`);
    ends.push({ y: y(last) + 4, text: `${r.profile.name.split(" (")[0]} · level ${last}` });
    out.push(`<rect x="${W - R + 12}" y="${H - B - 60 + i * 18}" width="12" height="3" rx="1.5" fill="${color}"/>`);
    out.push(`<text x="${W - R + 30}" y="${H - B - 56 + i * 18}" fill="#52514e">${r.profile.name}</text>`);
  });
  // The names at the lines' ends, 14 px apart at least, top to bottom.
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i]!.y = Math.max(ends[i]!.y, ends[i - 1]!.y + 14);
  for (const e of ends) out.push(`<text x="${x(maxDay) + 10}" y="${e.y}" fill="#0b0b0b">${e.text}</text>`);
  out.push("</svg>");
  return out.join("\n") + "\n";
}

const days = (hours: number | null | undefined) => (hours === null || hours === undefined ? "not reached" : `day ${(hours / 24).toFixed(1)}`);
const n = (v: number) => v.toLocaleString("en-US");
const RES: readonly Resource[] = ["oil", "fish", "wood", "rope"];

/** The tables of docs/balance.md: milestones, days 30 and 60, waits and blocks, the storage walls. */
export function toMarkdown(runs: readonly Run[]): string {
  const head = (cols: string[]) => [`| ${cols.join(" | ")} |`, `| ${cols.map(() => "---").join(" | ")} |`];
  const out: string[] = [MARK_START, "", "### Milestones (days after the city is founded)", ""];
  out.push(...head(["Profile", "Lighthouse 5", "Lighthouse 10", "Lighthouse 12", "Lighthouse 15", "Refinery 2", "Barracks 1", "First camp beaten"]));
  for (const r of runs) out.push(`| ${r.profile.name} | ${days(r.lighthouse[5])} | ${days(r.lighthouse[10])} | ${days(r.lighthouse[12])} | ${days(r.lighthouse[15])} | ${days(r.firsts.refinery2)} | ${days(r.firsts.barracks1)} | ${days(r.firsts.campBeaten)} |`);
  for (const day of CHECKPOINTS) {
    out.push("", `### Day ${day}`, "");
    out.push(...head(["Profile", "Lighthouse", "Power", "Oil", "Fish", "Wood", "Storage", "Troops + veterans", "Captains (lead, level, stars)", "Techs", "Rafts", "Camps beaten"]));
    for (const r of runs) {
      const d = r.days[day - 1];
      if (!d) continue;
      out.push(`| ${r.profile.name} | ${d.lighthouse} | ${n(d.power)} | ${n(d.stock.oil)} | ${n(d.stock.fish)} | ${n(d.stock.wood)} | ${n(d.storage)} | ${n(d.troops + d.veterans)} | ${d.captains} (${d.lead ?? "none"}, ${d.leadLevel}, ${d.stars}★) | ${d.techs} | ${d.rafts} | ${d.campsBeaten} |`);
    }
  }
  out.push("", "### Waiting and blocks", "");
  out.push(...head(["Profile", "Builder hours free a day (days 1–30)", "(days 31–60)", "Sessions with a builder free and nothing to start", "Sessions with nothing at all", "Blocked by (sessions)", "Hours full: oil, fish, wood"]));
  for (const r of runs) {
    const idle = (from: number, to: number) => (r.days.slice(from, to).reduce((s, d) => s + d.idleBuilderHours, 0) / Math.max(1, r.days.slice(from, to).length)).toFixed(1);
    const sessions = r.days.reduce((s, d) => s + d.sessions, 0);
    const blocked = r.days.reduce((s, d) => s + d.blockedSessions, 0);
    const empty = r.days.reduce((s, d) => s + d.emptySessions, 0);
    const by = [...RES, "capped" as const].filter((k) => r.blocks[k] > 0).map((k) => `${k} ${r.blocks[k]}`).join(", ") || "none";
    out.push(`| ${r.profile.name} | ${idle(0, 30)} | ${idle(30, 60)} | ${blocked} of ${sessions} (${Math.round((100 * blocked) / Math.max(1, sessions))} %) | ${empty} | ${by} | ${Math.round(r.fullHours.oil)}, ${Math.round(r.fullHours.fish)}, ${Math.round(r.fullHours.wood)} |`);
  }
  out.push("", "### The storage wall", "");
  out.push(...head(["Profile", "Lighthouse level", "Next level costs", "Storage holds", "Days at the wall", "Got past it"]));
  for (const r of runs) {
    if (r.walls.length === 0) out.push(`| ${r.profile.name} | not reached | | | | |`);
    for (const w of r.walls) out.push(`| ${r.profile.name} | ${w.level} | ${n(w.cost)} ${w.resource} | ${n(w.storage)} | ${(w.hours / 24).toFixed(1)}${w.escaped ? "" : " (to the end)"} | ${w.escaped ? "yes" : "no"} |`);
  }
  out.push("", MARK_END);
  return out.join("\n");
}

/** docs/balance.md with its generated part replaced (the rest is written by hand). */
export function withTables(doc: string, runs: readonly Run[]): string {
  const a = doc.indexOf(MARK_START);
  const b = doc.indexOf(MARK_END);
  if (a < 0 || b < a) throw new Error("docs/balance.md has no generated part (its two markers)");
  return doc.slice(0, a) + toMarkdown(runs) + doc.slice(b + MARK_END.length);
}
