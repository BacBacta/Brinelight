/**
 * npx tsx tools/balance/population-run.ts: the population study (docs/studies/population.md). Plays the balance's
 * simulator with the rules of `shared/` (E, the slower build times and the costs past 15), then with the study's
 * proposals (`population.ts`) through its rules (`population-hooks.mjs`, `population-rules.ts`), and writes the
 * study's tables and its chart. It changes no rule.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import type { Proposal } from "./population.js";
import type { Intent, Profile } from "./simulate.js";

// The simulator gets the study's rules in place of `@brinelight/shared`: registered before it is loaded.
register("./population-hooks.mjs", import.meta.url);
const { MORE_PROFILES, PROFILES, simulate } = await import("./simulate.js");
const R = await import("./population-rules.js");
const P = await import("./population.js");
const { RAFT_BUILDING_MAX_COPIES, RAFT_BUILDING_MAX_LEVEL, RAFT_SLOTS, raftCost, slotOpen } = await import("@brinelight/shared");
type PlayerState = import("@brinelight/shared").PlayerState;

const docs = fileURLToPath(new URL("../../docs/", import.meta.url));
const MARK_START = "<!-- population:generated:start (npx tsx tools/balance/population-run.ts) -->";
const MARK_END = "<!-- population:generated:end -->";
/** Two years: long enough to see the whole city at 30. */
const DAYS = 730;

/** The raft buildings of the rules, which the balance's player puts on its rafts first. */
const RAFT_TYPES = ["greenhouse", "smokehouse", "watchtower"] as const;

/**
 * The study's player at the shipyard, once the raft buildings of the rules are all placed: a House on every free raft,
 * then the cheaper in wood of the next House level and the next raft. The raft buildings go to their level 3 first, as
 * the balance plays them.
 */
const houses =
  (p: Proposal) =>
  (s: PlayerState, act: (action: Intent, label: string) => boolean): boolean => {
    if (!p.house) return false;
    const rafts = Object.values(s.rafts);
    if (RAFT_TYPES.some((b) => rafts.filter((r) => r.building === b).length < RAFT_BUILDING_MAX_COPIES)) return false;
    const slots = RAFT_SLOTS.map((x) => x.key);
    const empty = slots.find((k) => s.rafts[k] && !s.rafts[k]!.building);
    if (empty) return act({ type: "installOnRaft", slot: empty, building: R.HOUSE as never }, `house on ${empty}`);
    const isHouse = (k: string) => (s.rafts[k]?.building as string | undefined) === R.HOUSE;
    if (slots.some((k) => s.rafts[k]?.building && !isHouse(k) && s.rafts[k]!.level < RAFT_BUILDING_MAX_LEVEL)) return false;
    const low = slots.filter((k) => isHouse(k) && s.rafts[k]!.level < P.houseMaxLevel(p, s.buildings.lighthouse)).sort((a, b) => s.rafts[a]!.level - s.rafts[b]!.level)[0];
    const free = RAFT_SLOTS.find((x) => !s.rafts[x.key] && slotOpen(x.ring, s.buildings.lighthouse));
    const tries: { wood: number; go: () => boolean }[] = [];
    if (low) tries.push({ wood: P.houseCost(p, s.rafts[low]!.level).wood ?? 0, go: () => act({ type: "upgradeRaft", slot: low }, `house ${low} level ${s.rafts[low]!.level + 1}`) });
    if (free) tries.push({ wood: raftCost(rafts.length).wood ?? 0, go: () => act({ type: "dockRaft", slot: free.key }, `raft at ${free.key}`) });
    return tries.sort((a, b) => a.wood - b.wood).some((t) => t.go());
  };

type Setup = { key: string; name: string; proposal: Proposal | null; fisheryMax?: number; production?: number; profile?: Partial<Profile> };
const withBuilders = (b: readonly number[]): Proposal => ({ ...P.START, id: `b${b.join("-")}`, name: `builders at ${b.join(" and ")} survivors`, builders: b });

/** The builders' thresholds measured, and the one proposed. */
const THRESHOLDS = [[40, 120], [100, 250], [200, 500]] as const;
const PROPOSED = THRESHOLDS[1];

const SETUPS: readonly Setup[] = [
  { key: "rules", name: "The rules (8 survivors, 2 builders)", proposal: null },
  { key: "start", name: "Population, 2 builders", proposal: P.START },
  ...THRESHOLDS.map((b) => ({ key: `b${b.join("-")}`, name: `Population, ${withBuilders(b).name}`, proposal: withBuilders(b) })),
  { key: "A", name: "The idle study's A (production ×3.5), 8 survivors, 2 builders", proposal: null, production: 3.5 },
  { key: "A-start", name: "A and the population, 2 builders", proposal: P.START, production: 3.5 },
  { key: `A-b${PROPOSED.join("-")}`, name: `A and the population, ${withBuilders(PROPOSED).name}`, proposal: withBuilders(PROPOSED), production: 3.5 },
];
/** The House's costs and the survivors' eating, for the owner's request of 25 October (step 2). */
const H = P.START.house!;
const HOUSE_OPTIONS: readonly Setup[] = [
  { key: "start", name: "The starting values: 600 wood and 300 fish, ×3 a level; 0.6 fish an hour", proposal: P.START },
  { key: "h-fish0", name: "1. No fish: 600 wood, ×3 a level; 0.6 fish an hour", proposal: { ...P.START, house: { ...H, cost: { wood: 600 } } } },
  { key: "h-g2", name: "2. A gentler rise: 600 wood and 300 fish, ×2 a level; 0.6 fish an hour", proposal: { ...P.START, house: { ...H, growth: 2 } } },
  { key: "h-fish0-room3", name: "3. No fish, 3 room a level: 600 wood, ×3 a level; 0.6 fish an hour", proposal: { ...P.START, house: { ...H, cost: { wood: 600 }, roomPerLevel: 3 } } },
  { key: "h-fish0-eat075", name: "4. No fish, and 0.45 fish an hour", proposal: { ...P.START, eats: 0.75, house: { ...H, cost: { wood: 600 } } } },
  { key: "h-fish0-eat05", name: "5. No fish, and 0.3 fish an hour", proposal: { ...P.START, eats: 0.5, house: { ...H, cost: { wood: 600 } } } },
  { key: "h-fish0-eat025", name: "7. No fish, and 0.25 fish an hour", proposal: { ...P.START, eats: 0.25 / 0.6, house: { ...H, cost: { wood: 600 } } } },
  { key: "h-fish0-eat02", name: "8. No fish, and 0.2 fish an hour", proposal: { ...P.START, eats: 0.2 / 0.6, house: { ...H, cost: { wood: 600 } } } },
  { key: "h-fish100-eat05", name: "6. 600 wood and 100 fish, ×3 a level, and 0.3 fish an hour", proposal: { ...P.START, eats: 0.5, house: { ...H, cost: { wood: 600, fish: 100 } } } },
];

/** A city short of fish: its Fishery kept at level 2, never at sea (no shoal), every other choice the balance's. */
const SHORT: Setup = { key: "short", name: "The Fishery kept at level 2, never at sea", proposal: P.START, fisheryMax: 2, profile: { noSea: true } };

const play = (profile: Profile, setup: Setup) => {
  R.begin(setup.proposal, setup.fisheryMax ?? null, setup.production ?? 1);
  const played = { ...profile, ...setup.profile };
  const run = simulate(setup.proposal ? { ...played, shipyard: houses(setup.proposal) } : played, DAYS);
  return { run, days: [...R.study.days], builders: { ...R.study.builders }, arrived: R.study.arrived, rescued: R.study.rescued, full: R.study.fullHours / Math.max(1, R.study.hours), spent: structuredClone(R.study.spent) };
};
type Played = ReturnType<typeof play>;

const balance = readFileSync(`${docs}balance.md`, "utf8");
const played = new Map<string, Played>();
const get = (s: Setup, p: Profile) => {
  const key = `${s.key} ${p.id}`;
  if (!played.has(key)) {
    const out = play(p, s);
    if (s.key === "rules") {
      // The rules first: the study's runs must be the balance's own (docs/balance.md, its milestones).
      const row = balance.split("\n").find((l) => l.startsWith(`| ${p.name} | day `));
      const days = [5, 10, 15, 20, 25, 30].map((l) => `day ${(out.run.lighthouse[l]! / 24).toFixed(1)}`);
      if (!row || !row.startsWith(`| ${p.name} | ${days.join(" | ")} |`)) throw new Error(`${p.name}: the study's run is not the balance's (${days.join(", ")})`);
    }
    played.set(key, out);
  }
  return played.get(key)!;
};
const MAIN = PROFILES.slice(0, 3);
const regular = PROFILES[1]!;
const neverStokes = MORE_PROFILES.find((p) => p.id === "neverStokes")!;
const setup = (key: string) => [...SETUPS, ...HOUSE_OPTIONS].find((s) => s.key === key)!;

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const pct = (v: number) => `${Math.round(v * 100)} %`;
const day = (h: number | undefined) => (h === undefined ? "never" : `day ${(h / 24).toFixed(1)}`);
const months = (h: number | undefined) => (h === undefined ? "" : ` (${(h / 24 / 30.44).toFixed(1)} months)`);
const cityAt30 = (r: Played) => r.run.days.find((d) => Object.values(d.buildings).every((l) => l >= 30))?.day ?? null;
const at = (r: Played, d: number) => r.days[d - 1] ?? r.days.at(-1)!;
/** The day a Lighthouse level was reached (counted from 1), or null. */
const dayOf = (r: Played, level: number) => (r.run.lighthouse[level] === undefined ? null : Math.ceil(r.run.lighthouse[level]! / 24));
/** Until the whole city is at 30 (or the run's end): after, nothing is left to build. */
const untilDone = <T>(r: Played, rows: readonly T[]) => rows.slice(0, cityAt30(r) ?? rows.length);

const CURVE_DAYS = [1, 3, 7, 14, 30, 60, 90, 180, 365, 730] as const;
function curveTable(): string {
  const rows = [`| Player | ${CURVE_DAYS.map((d) => `Day ${d}`).join(" | ")} |`, `| --- |${" --- |".repeat(CURVE_DAYS.length)}`];
  for (const p of MAIN) {
    const r = get(setup("start"), p);
    rows.push(`| ${p.name} | ${CURVE_DAYS.map((d) => `${at(r, d).survivors} / ${at(r, d).room}`).join(" | ")} |`);
  }
  return rows.join("\n");
}

const LH_LEVELS = [5, 10, 15, 20, 25, 30] as const;
function byLighthouseTable(): string {
  const rows = [`| Player | ${LH_LEVELS.map((l) => `Lighthouse ${l}`).join(" | ")} | Survivors who came | brought by the fleets | Hours with every room taken |`, `| --- |${" --- |".repeat(LH_LEVELS.length + 3)}`];
  for (const p of MAIN) {
    const r = get(setup("start"), p);
    const cells = LH_LEVELS.map((l) => {
      const d = dayOf(r, l);
      return d === null ? "never" : `${at(r, Math.max(1, d)).survivors}`;
    });
    rows.push(`| ${p.name} | ${cells.join(" | ")} | ${r.arrived} | ${r.rescued} | ${pct(r.full)} |`);
  }
  return rows.join("\n");
}

/** The day each number of survivors the builders' thresholds name is first reached, and the Lighthouse then. */
function reachedTable(): string {
  const counts = [...new Set(THRESHOLDS.flat())].sort((x, y) => x - y);
  const rows = [`| Player | ${counts.map((c) => `${c} survivors`).join(" | ")} |`, `| --- |${" --- |".repeat(counts.length)}`];
  for (const p of MAIN) {
    const r = get(setup("start"), p);
    rows.push(`| ${p.name} | ${counts.map((c) => {
      const d = r.days.find((x) => x.survivors >= c);
      return d ? `day ${d.day + 1} (Lighthouse ${d.lighthouse})` : "never";
    }).join(" | ")} |`);
  }
  return rows.join("\n");
}

function fishTable(): string {
  const rows = [
    "| Setup | Player | At Lighthouse 10: fish made a day, eaten | at 20 | at 30 | Days ended with fish full | Sessions short of fish | Hours without fish |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const s of [setup("rules"), setup("start")]) for (const p of MAIN) {
    const r = get(s, p);
    const cells = [10, 20, 30].map((l) => {
      const d = dayOf(r, l);
      if (d === null) return "never";
      const row = at(r, Math.min(d + 1, r.days.length));
      return `${n(row.fishMade)}, ${n(row.fishEaten)} (${pct(row.fishEaten / row.fishMade)})`;
    });
    const days = untilDone(r, r.days);
    const short = untilDone(r, r.run.days).reduce((k, d) => k + Number(d.blockedBy.match(/fish (\d+)/)?.[1] ?? 0), 0);
    rows.push(`| ${s.name} | ${p.name} | ${cells.join(" | ")} | ${days.filter((d) => d.fishFull).length} | ${short} | ${n(days.reduce((k, d) => k + d.hungry, 0))} |`);
  }
  return rows.join("\n");
}

function resourcesTable(): string {
  const rows = ["| Setup | Player | Sessions ended with a builder free | Short of wood | of oil | of fish | Fish in stock / storage, day 90 | day 180 |", "| --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const s of [setup("rules"), setup("start")]) for (const p of MAIN) {
    const r = get(s, p);
    const days = untilDone(r, r.run.days);
    const sessions = days.reduce((k, d) => k + d.sessions, 0);
    const blocked = days.reduce((k, d) => k + d.blockedSessions, 0);
    const by = (k: string) => days.reduce((m, d) => m + Number(d.blockedBy.match(new RegExp(`${k} (\\d+)`))?.[1] ?? 0), 0);
    const stock = (d: number) => {
      const row = r.run.days[d - 1]!;
      return `${n(row.stock.fish)} / ${n(row.storage)}`;
    };
    rows.push(`| ${s.name} | ${p.name} | ${blocked} of ${sessions} (${pct(blocked / sessions)}) | ${by("wood")} | ${by("oil")} | ${by("fish")} | ${stock(90)} | ${stock(180)} |`);
  }
  return rows.join("\n");
}

/** A city out of fish, hour by hour: 300 survivors, room for 406, its Fishery at 1, no fish left; the Fishery up to 10 at hour 48. */
function hungerTable(): string {
  R.begin(P.START);
  let s = R.newPlayerState(0);
  // The room: the Shelters at 30 (126) and 14 Houses at level 5 (280).
  const rafts = Object.fromEntries(RAFT_SLOTS.slice(0, 14).map((x) => [x.key, { hp: 100, building: R.HOUSE as never, level: 5 }]));
  s = { ...s, survivors: 300, rafts, buildings: { ...s.buildings, lighthouse: 10, shelters: 30, fishery: 1 }, stock: { ...s.stock, fish: 0 } };
  const rows = ["| Hour | Survivors | Room | Morale | Fish in stock | Fish an hour: made, eaten |", "| --- | --- | --- | --- | --- | --- |"];
  const line = (h: number) => {
    const made = R.netRates({ ...s, buildings: { ...s.buildings, lighthouse: 0 }, survivors: 0 }).fish;
    rows.push(`| ${h} | ${s.survivors} | ${R.roomOf(s)} | ${Math.round(s.morale)} | ${n(s.stock.fish)} | ${n(made)}, ${n(made - R.netRates(s).fish)} |`);
  };
  for (let h = 0; h <= 96; h++) {
    if ([0, 6, 12, 24, 48, 54, 60, 72, 96].includes(h)) line(h);
    if (h === 48) s = { ...s, buildings: { ...s.buildings, fishery: 10 } };
    s = R.advance(s, 3600);
  }
  return rows.join("\n");
}

function houseCostsTable(): string {
  const rows = [
    "| Option | Player | Sessions short of fish: until the city is done | the first year | Lighthouse 30 | Whole city at 30 | Survivors, day 365 | The Houses cost: wood | fish |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  const fishShort = (r: Played, until: number) => r.run.days.slice(0, until).reduce((k, d) => k + Number(d.blockedBy.match(/fish (\d+)/)?.[1] ?? 0), 0);
  for (const s of [setup("rules"), ...HOUSE_OPTIONS]) for (const p of MAIN) {
    const r = get(s, p);
    const city = cityAt30(r);
    rows.push(`| ${s.name} | ${p.name} | ${fishShort(r, city ?? DAYS)} | ${fishShort(r, 365)} | ${day(r.run.lighthouse[30])} | ${city === null ? "not in 2 years" : `day ${city}`} | ${at(r, 365).survivors} | ${n(r.spent.houses.wood)} | ${n(r.spent.houses.fish)} |`);
  }
  return rows.join("\n");
}

function paceTable(): string {
  const rows = ["| Setup | Player | Lighthouse 10 | 20 | 30 | Whole city at 30 | Survivors, day 180 | day 365 |", "| --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const s of SETUPS) for (const p of MAIN) {
    const r = get(s, p);
    const lh = r.run.lighthouse;
    const city = cityAt30(r);
    rows.push(`| ${s.name} | ${p.name} | ${day(lh[10])} | ${day(lh[20])} | ${day(lh[30])}${months(lh[30])} | ${city === null ? "not in 2 years" : `day ${city}`} | ${at(r, 180).survivors} | ${at(r, 365).survivors} |`);
  }
  return rows.join("\n");
}

const BANDS = [
  { from: 1, to: 10, name: "1 to 10" },
  { from: 11, to: 20, name: "11 to 20" },
  { from: 21, to: 30, name: "21 to 30, until the city is done" },
] as const;
function buildersTable(): string {
  const rows = ["| Setup | Lighthouse | Builders | At work | Free, the player away | Free, nothing to start |", "| --- | --- | --- | --- | --- | --- |"];
  for (const s of SETUPS) {
    const r = get(s, regular);
    const done = cityAt30(r) ?? DAYS;
    for (const band of BANDS) {
      // Hour by hour, as the study's rules wrote them; at 30, only until the whole city is at 30.
      const sum = { slots: 0, away: 0, nothing: 0 };
      for (let l = band.from; l <= band.to; l++) {
        const b = r.builders[l];
        if (!b) continue;
        sum.away += b.away;
        sum.nothing += b.nothing;
      }
      const days = r.days.filter((d) => d.day < done && d.lighthouse >= band.from && d.lighthouse <= band.to);
      for (const d of days) sum.slots += d.builders * 24;
      if (band.to === 30) {
        // The free builder hours after the city is done are left out.
        const last = r.days.at(-1)!.builders;
        sum.nothing -= last * 24 * Math.max(0, DAYS - done);
      }
      if (sum.slots <= 0) continue;
      const counts = [...new Set(days.map((d) => d.builders))].join(" to ");
      rows.push(`| ${s.name} | ${band.name} | ${counts} | ${pct(1 - (sum.away + sum.nothing) / sum.slots)} | ${pct(sum.away / sum.slots)} | ${pct(Math.max(0, sum.nothing) / sum.slots)} |`);
    }
  }
  return rows.join("\n");
}

const HOUSE_DAYS = [7, 30, 60, 90, 180, 365] as const;
function housesTable(): string {
  const rows = [`| Day | ${HOUSE_DAYS.map((d) => `${d}`).join(" | ")} |`, `| --- |${" --- |".repeat(HOUSE_DAYS.length)}`];
  const r = get(setup("start"), regular);
  const rules = get(setup("rules"), regular);
  const perLevel = P.START.house!.roomPerLevel;
  rows.push(`| The rules: rafts | ${HOUSE_DAYS.map((d) => at(rules, d).rafts).join(" | ")} |`);
  rows.push(`| Population: rafts | ${HOUSE_DAYS.map((d) => at(r, d).rafts).join(" | ")} |`);
  rows.push(`| Houses, their levels added up | ${HOUSE_DAYS.map((d) => `${at(r, d).houses}, ${at(r, d).houseLevels}`).join(" | ")} |`);
  rows.push(`| Room: the Shelters', the Houses' | ${HOUSE_DAYS.map((d) => `${at(r, d).room - at(r, d).houseLevels * perLevel}, ${at(r, d).houseLevels * perLevel}`).join(" | ")} |`);
  return rows.join("\n");
}

function spentTable(): string {
  const rows = ["| Player | Houses: wood | fish | Rafts: wood, the rules | with the population |", "| --- | --- | --- | --- | --- |"];
  for (const p of MAIN) {
    const r = get(setup("start"), p);
    const rules = get(setup("rules"), p);
    rows.push(`| ${p.name} | ${n(r.spent.houses.wood)} | ${n(r.spent.houses.fish)} | ${n(rules.spent.rafts.wood)} | ${n(r.spent.rafts.wood)} |`);
  }
  return rows.join("\n");
}

function shortTable(): string {
  const rows = ["| City | Hours without fish (two years) | Days with some | Lowest morale | Survivors, day 30 | 90 | 365 | Lighthouse 30 |", "| --- | --- | --- | --- | --- | --- | --- | --- |"];
  const cases = [
    { name: "The regular player", r: get(setup("start"), regular) },
    { name: `The regular player, ${SHORT.name.charAt(0).toLowerCase()}${SHORT.name.slice(1)}`, r: get(SHORT, regular) },
    { name: "The player who never stokes (6 sessions)", r: get(setup("start"), neverStokes) },
  ];
  for (const c of cases) {
    const lowest = Math.min(...c.r.days.map((d) => d.morale));
    rows.push(`| ${c.name} | ${n(c.r.days.reduce((k, d) => k + d.hungry, 0))} | ${c.r.days.filter((d) => d.hungry > 0).length} | ${Math.round(lowest)} | ${at(c.r, 30).survivors} | ${at(c.r, 90).survivors} | ${at(c.r, 365).survivors} | ${day(c.r.run.lighthouse[30])} |`);
  }
  return rows.join("\n");
}

/** Categorical colors, in fixed order (the balance chart's, validated: blue, orange, aqua on a light surface). */
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a"] as const;
/** The survivors day by day, the first year, one line per player; the rules' 8 as a gray dashed line. */
function curveSvg(): string {
  const W = 800, H = 380, L = 52, Rm = 200, T = 40, B = 44, maxDay = 365, maxPop = 800;
  const x = (d: number) => L + ((W - L - Rm) * d) / maxDay;
  const y = (v: number) => T + ((H - T - B) * (maxPop - v)) / maxPop;
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, sans-serif" font-size="12" role="img" aria-labelledby="t">`,
    `<title id="t">Survivors by day, the first year, for the three players (population study, starting values)</title>`,
    `<rect width="${W}" height="${H}" fill="#fcfcfb"/>`,
    `<text x="${L}" y="22" font-size="14" font-weight="600" fill="#0b0b0b">Survivors by day (starting values)</text>`,
  ];
  for (let v = 0; v <= maxPop; v += 100) {
    out.push(`<line x1="${L}" x2="${W - Rm}" y1="${y(v)}" y2="${y(v)}" stroke="${v % 200 === 0 ? "#d4d3cf" : "#ecebe8"}" stroke-width="1"/>`);
    if (v % 200 === 0) out.push(`<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" fill="#52514e">${v}</text>`);
  }
  for (let d = 0; d <= maxDay; d += 30) {
    out.push(`<line x1="${x(d)}" x2="${x(d)}" y1="${T}" y2="${H - B}" stroke="#ecebe8" stroke-width="1"/>`);
    out.push(`<text x="${x(d)}" y="${H - B + 18}" text-anchor="middle" fill="#52514e">${d}</text>`);
  }
  out.push(`<text x="${(L + W - Rm) / 2}" y="${H - 6}" text-anchor="middle" fill="#52514e">Days since the city was founded</text>`);
  out.push(`<line x1="${x(0)}" x2="${x(maxDay)}" y1="${y(8)}" y2="${y(8)}" stroke="#8a8984" stroke-width="2" stroke-dasharray="4 4"><title>The rules today: 8 survivors</title></line>`);
  const ends: { y: number; text: string }[] = [];
  MAIN.forEach((p, i) => {
    const r = get(setup("start"), p);
    const pts = [`${x(0)},${y(8)}`, ...r.days.slice(0, maxDay).map((d, k) => `${x(k + 1).toFixed(1)},${y(d.survivors).toFixed(1)}`)];
    const last = at(r, maxDay).survivors;
    out.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="${COLORS[i]}" stroke-width="2" stroke-linejoin="round"><title>${p.name}</title></polyline>`);
    out.push(`<circle cx="${x(maxDay)}" cy="${y(last)}" r="4" fill="${COLORS[i]}" stroke="#fcfcfb" stroke-width="2"/>`);
    ends.push({ y: y(last) + 4, text: `${p.name.split(" (")[0]} · ${last}` });
    out.push(`<rect x="${W - Rm + 12}" y="${H - B - 78 + i * 18}" width="12" height="3" rx="1.5" fill="${COLORS[i]}"/>`);
    out.push(`<text x="${W - Rm + 30}" y="${H - B - 74 + i * 18}" fill="#52514e">${p.name}</text>`);
  });
  out.push(`<rect x="${W - Rm + 12}" y="${H - B - 24}" width="12" height="3" rx="1.5" fill="#8a8984"/>`);
  out.push(`<text x="${W - Rm + 30}" y="${H - B - 20}" fill="#52514e">The rules today: 8</text>`);
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i]!.y = Math.max(ends[i]!.y, ends[i - 1]!.y + 14);
  for (const e of ends) out.push(`<text x="${x(maxDay) + 10}" y="${e.y}" fill="#0b0b0b">${e.text}</text>`);
  out.push("</svg>");
  return out.join("\n") + "\n";
}

const v = P.START;
const tables = [
  "### The values played",
  [
    `- Arrivals: ${v.arrivals.base} + ${v.arrivals.perLevel} × the Lighthouse's level survivors an hour (Lighthouse 10: ${(v.arrivals.base + 10 * v.arrivals.perLevel).toFixed(2)}; 20: ${(v.arrivals.base + 20 * v.arrivals.perLevel).toFixed(2)}; 30: ${(v.arrivals.base + 30 * v.arrivals.perLevel).toFixed(2)}), × the morale / ${v.morale.fed}; none without fish or room.`,
    `- Morale: toward ${v.morale.fed} with fish, ${v.morale.hungry} without, ${v.morale.perHour} point an hour; +${v.morale.held} for a Mist held, −${v.morale.missed} for a Mist not held.`,
    `- The fleets: ${v.rescues.wreck} survivor for a wreck salvaged, ${v.rescues.camp} for a camp beaten, if there is room.`,
    `- Eating: the rules' 0.6 fish an hour a survivor, less with the Smokehouses (half at most).`,
    `- House: on a free raft, at the shipyard. Level 1 costs ${n(v.house!.cost.wood!)} wood and ${n(v.house!.cost.fish!)} fish, ×${v.house!.growth} a level (level 5: ${n(P.houseCost(v, 4).wood!)} wood, ${n(P.houseCost(v, 4).fish!)} fish); ${v.house!.roomPerLevel} survivors of room a level, ${v.house!.maxLevel} levels, one more every ${v.house!.levelEvery} Lighthouse levels (level 5 from Lighthouse ${4 * v.house!.levelEvery}). The build times of the raft buildings.`,
    "- Builders: two, and in the setups that say so a third and a fourth at a number of survivors.",
  ].join("\n"),
  "### 1. The population over time (starting values): survivors / room",
  curveTable(),
  "![Survivors by day](population-curve.svg)",
  "### 2. The survivors when the Lighthouse reaches each level",
  byLighthouseTable(),
  "The day the population first reaches each number of survivors the builders' thresholds name (starting values, two builders):",
  reachedTable(),
  "### 3. The fish: made and eaten",
  "A day's fish made by the city (the Fishery, the Greenhouses) and eaten by the survivors, the day after the Lighthouse reaches the level. The days, sessions and hours until the whole city is at 30 (or two years).",
  fishTable(),
  "### 4. A city short of fish, and the morale",
  shortTable(),
  "Hour by hour, a city out of fish: 300 survivors, the Fishery at level 1 and no fish left; at hour 48 its Fishery goes to level 10.",
  hungerTable(),
  "### 4b. What blocks the builders, and the fish in stock",
  "Until the whole city is at 30 (or two years), as `docs/studies/costs.md`: the sessions that ended with a builder free, and the resource the first thing to start lacked.",
  resourcesTable(),
  "### 5. The pace (two years)",
  paceTable(),
  "### 6. The regular player's builders, by the Lighthouse's level",
  "Shares of the builders' time, as in `docs/studies/idle.md`; at Lighthouse 21 to 30, until the whole city is at 30.",
  buildersTable(),
  "### 7. The regular player's rafts and Houses",
  housesTable(),
  "### 8. What the Houses and the rafts cost (two years)",
  spentTable(),,
  "### 9. The House's costs and the survivors' eating (step 2, the owner's request of 25 October)",
  "The sessions that ended with a builder free and the first thing to start short of fish, until the whole city is at 30 (as section 4b) and in the first year. Target for the regular player: about 150 at most, Lighthouse 30 no more than a week later than the rules (day 190.9).",
  houseCostsTable()
].join("\n\n");

const file = `${docs}studies/population.md`;
const text = readFileSync(file, "utf8");
const a = text.indexOf(MARK_START);
const b = text.indexOf(MARK_END);
if (a < 0 || b < a) throw new Error(`${file}: its markers are missing`);
writeFileSync(file, `${text.slice(0, a + MARK_START.length)}\n\n${tables}\n\n${text.slice(b)}`);
writeFileSync(`${docs}studies/population-curve.svg`, curveSvg());
console.log(`${file}: written (${played.size} runs of ${DAYS} days)`);
