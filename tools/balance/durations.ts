/**
 * The durations study (docs/studies/durations.md): the build times of today's rules, level by level, and the curves the
 * study proposes for levels 6 to 30. Pure: the runs are played by `durations-run.ts`; nothing here changes a value of
 * the rules.
 */
import { BUILDING_IDS, BUILDINGS, HOUR, QUICK_LEVELS, upgradeTime, type BuildingId } from "@brinelight/shared";

const MIN = 60;
export const LEVELS = Array.from({ length: 30 }, (_, i) => i + 1);

/** Today's build time to reach `level` (from the level before), in real seconds: the rules' own. */
export const todayTime = (id: BuildingId, level: number): number => upgradeTime(id, level - 1);

/**
 * A proposed curve for levels 6 to 30 (1 to 5 keep the rules' quick levels: 1, 1, 2, 5 and 15 minutes). For the
 * producers (Refinery, Fishery, Lumberyard), the time to reach level L is
 *
 *     15 min × exp(k × (L − 5)^p)
 *
 * with k and p set by two times the player's day gives: level 10 (`at10`) and level 30 (`at30`). Since p < 1, each
 * level takes a little more than the one before, and the rise shrinks level after level: no cliff, at 5 → 6 either.
 * Every other building follows the same curve, its rise raised so that at level 30 it takes `times[id]` the producers'
 * (today's proportions between the buildings, from their base times): the Lighthouse is always the longest of its
 * level, then the Barracks, the Harbor and the Observatory, then the Shelters and the Infirmary.
 */
export type Curve = { id: string; name: string; at10: number; at30: number };

/**
 * At level 30, each building's time in producers' times: today's base times (6, 7 and 8 prototype seconds), and the
 * Lighthouse a little more than its own 9 (1.6 in place of 1.5): it is the longest of its level from level 6 on.
 */
export const TIMES: Readonly<Record<BuildingId, number>> = Object.fromEntries(
  BUILDING_IDS.map((id) => [id, id === "lighthouse" ? 1.6 : BUILDINGS[id].baseTime / 6]),
) as Record<BuildingId, number>;

const BASE = 15 * MIN;

/** The curve's two numbers for the producers: k and p. */
export function shape(c: Curve): { k: number; p: number } {
  const a = Math.log(c.at10 / BASE);
  const b = Math.log(c.at30 / BASE);
  const p = Math.log(b / a) / Math.log(5);
  return { k: a / 5 ** p, p };
}

/** The curve's time to reach `level`, in real seconds, rounded to the minute; levels 1 to 5 are the rules' quick ones. */
export function curveTime(c: Curve, id: BuildingId, level: number): number {
  if (level <= 5) return QUICK_LEVELS[level]!;
  const { k, p } = shape(c);
  // The rise of this building: its time at 30 is TIMES[id] the producers'.
  const w = 1 + Math.log(TIMES[id]) / Math.log(c.at30 / BASE);
  return Math.round((BASE * Math.exp(w * k * (level - 5) ** p)) / MIN) * MIN;
}

/** The study's two curves. */
export const CURVES: readonly Curve[] = [
  { id: "fast", name: "Faster", at10: 2 * HOUR, at30: 48 * HOUR },
  { id: "slow", name: "Slower", at10: 2.75 * HOUR, at30: 84 * HOUR },
];

/** "1 h 38", "48 min", "2 d 5 h", "3.2 y": a duration as a player reads it. */
export function duration(seconds: number): string {
  const m = Math.round(seconds / MIN);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h} h ${String(m % 60).padStart(2, "0")}` : `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 365) return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
  return `${(d / 365).toFixed(1)} y`;
}

/** The buildings that share their times, as one column each: the Lighthouse, then the three groups of the others. */
export const GROUPS: readonly { ids: readonly BuildingId[]; name: string }[] = [
  { ids: ["lighthouse"], name: "Lighthouse" },
  { ids: ["refinery", "fishery", "lumberyard"], name: "Refinery, Fishery, Lumberyard" },
  { ids: ["shelters", "infirmary"], name: "Shelters, Infirmary" },
  { ids: ["barracks", "harbor", "observatory"], name: "Barracks, Harbor, Observatory" },
];

/** The level bands of the owner's request. */
export const BANDS: readonly { from: number; to: number }[] = [
  { from: 6, to: 10 },
  { from: 11, to: 20 },
  { from: 21, to: 30 },
];

type TimeOf = (id: BuildingId, level: number) => number;

const ratio = (r: number) => `×${r.toFixed(2)}`;

/** Levels 1 to 30, each group's time to reach the level and its ratio to the level before. */
export function durationTable(time: TimeOf): string {
  const head = GROUPS.map((g) => `${g.name} | ratio`).join(" | ");
  const rows = [`| Level | ${head} |`, `| --- |${" --- | --- |".repeat(GROUPS.length)}`];
  for (const level of LEVELS) {
    const cells = GROUPS.map((g) => {
      const now = time(g.ids[0]!, level);
      return `${duration(now)} | ${level === 1 ? "" : ratio(now / time(g.ids[0]!, level - 1))}`;
    });
    rows.push(`| ${level} | ${cells.join(" | ")} |`);
  }
  return rows.join("\n");
}

/** Each group's shortest and longest time in each band, and the sum of every level's time for the whole city. */
export function bandsTable(curves: readonly { name: string; time: TimeOf }[]): string {
  const rows = [`| Curve | Group | ${BANDS.map((b) => `Levels ${b.from} to ${b.to}`).join(" | ")} |`, `| --- | --- |${" --- |".repeat(BANDS.length)}`];
  for (const c of curves) {
    for (const g of GROUPS) {
      const id = g.ids[0]!;
      rows.push(`| ${c.name} | ${g.name} | ${BANDS.map((b) => `${duration(c.time(id, b.from))} to ${duration(c.time(id, b.to))}`).join(" | ")} |`);
    }
  }
  return rows.join("\n");
}

/** Every level's time of every building, 1 to 30, added up: the city built in full, and by two builders at best. */
export function wholeCity(time: TimeOf): { total: number; twoBuilders: number; lighthouse: number } {
  let total = 0;
  for (const id of BUILDING_IDS) for (const level of LEVELS) total += time(id, level);
  const lighthouse = LEVELS.reduce((sum, level) => sum + time("lighthouse", level), 0);
  // Two builders: never shorter than half the total, nor than the Lighthouse alone (the others wait for its levels).
  return { total, twoBuilders: Math.max(total / 2, lighthouse), lighthouse };
}

/** The next session after `clock` (seconds since day 1, 0:00) for a profile's daily times. */
export function nextSession(clock: number, sessions: readonly number[], day = 24 * HOUR): number {
  const d = Math.floor(clock / day);
  for (let i = 0; i < 2; i++) {
    const next = sessions.map((t) => (d + i) * day + t).find((t) => t > clock);
    if (next !== undefined) return next;
  }
  return clock + day;
}

/** For the builds started of each band of levels: how many, how many ended before the next session, and the time each waited for it. */
export function betweenSessions(started: readonly { clock: number; level: number; seconds: number }[], sessions: readonly number[]) {
  return BANDS.map((b) => {
    const mine = started.filter((s) => s.level >= b.from && s.level <= b.to);
    const before = mine.filter((s) => s.clock + s.seconds <= nextSession(s.clock, sessions));
    const waits = before.map((s) => nextSession(s.clock, sessions) - (s.clock + s.seconds));
    return { band: b, builds: mine.length, before: before.length, wait: waits.length ? waits.reduce((a, w) => a + w, 0) / waits.length : 0 };
  });
}
