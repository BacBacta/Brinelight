/**
 * The sea chart (Hold the Light): 30 Nights, each with its waves, how many come at once, its families, how tough they
 * are, and its rule. Nights 1 to 5 are the first ones; further out the Nights are longer and harder, and a rule comes
 * back in turn. Starting values, to be measured (tools/night).
 */
import type { Family } from "./values.js";

export const RULES = ["none", "swift", "wraiths", "beasts", "nopause", "dark"] as const;
export type NightRule = (typeof RULES)[number];

export type ChartNight = {
  name: string;
  waves: number;
  burst: number;
  mix: Readonly<Partial<Record<Family, number>>>;
  /** Enemies' health, times their family's. */
  health: number;
  rule: NightRule;
};

const RULE_NAMES: Readonly<Record<NightRule, string>> = {
  none: "",
  swift: "Swift Night",
  wraiths: "Night of Wraiths",
  beasts: "Night of Beasts",
  nopause: "Night without rest",
  dark: "Dark Night",
};

const FIRST: readonly Omit<ChartNight, "name" | "rule" | "health">[] = [
  { waves: 5, burst: 1, mix: { raider: 1 } },
  { waves: 8, burst: 1, mix: { raider: 0.8, beast: 0.2 } },
  { waves: 9, burst: 2, mix: { raider: 0.8, beast: 0.2 } },
  { waves: 10, burst: 2, mix: { raider: 0.6, beast: 0.2, wraith: 0.2 } },
  { waves: 12, burst: 3, mix: { raider: 0.6, beast: 0.2, wraith: 0.2 } },
];
/** The rules of Nights 6 to 30, in turn. */
const TURN: readonly NightRule[] = ["swift", "none", "wraiths", "beasts", "nopause", "dark"];
const MIX: Readonly<Record<NightRule, Readonly<Partial<Record<Family, number>>>>> = {
  none: { raider: 0.5, beast: 0.25, wraith: 0.25 },
  swift: { raider: 0.5, beast: 0.25, wraith: 0.25 },
  wraiths: { raider: 0.3, wraith: 0.7 },
  beasts: { raider: 0.4, beast: 0.6 },
  nopause: { raider: 0.5, beast: 0.25, wraith: 0.25 },
  dark: { raider: 0.5, beast: 0.25, wraith: 0.25 },
};

function make(k: number): ChartNight {
  if (k <= FIRST.length) return { ...FIRST[k - 1]!, name: `Night ${k}`, health: 1, rule: "none" };
  const rule = TURN[(k - 6) % TURN.length]!;
  return {
    name: rule === "none" ? `Night ${k}` : `Night ${k} · ${RULE_NAMES[rule]}`,
    waves: Math.min(30, 12 + Math.round(((k - 5) * 18) / 25)),
    burst: Math.min(5, 3 + Math.floor((k - 5) / 9)),
    mix: MIX[rule],
    health: 1 + 0.06 * (k - 5),
    rule,
  };
}

export const CHART: readonly ChartNight[] = Array.from({ length: 30 }, (_, i) => make(i + 1));

/** A Night of the chart (the last one past its end). */
export const chartNight = (k: number): ChartNight => CHART[Math.min(Math.max(1, k), CHART.length) - 1]!;
