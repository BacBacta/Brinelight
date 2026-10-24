/**
 * The resources study (docs/studies/resources.md): its variants, and what it reads from a run. Pure: the runs are
 * played by `resources-run.ts`; nothing here changes a value of the rules.
 */
import { HOUR } from "@brinelight/shared";
import type { Measures, Source, Variant } from "./resources-rules.js";

type Res = "oil" | "fish" | "wood";

/** A: a producer of level L makes what the rules' producer of level L + min(L, 5) makes (proposed, never in the game). */
export const raised = (level: number): number => level + Math.min(level, 5);

/** C: what a Wooded Isle or a Fish Shoal holds at this Lighthouse level, from the map's amount (proposed). */
export const harvestAmount = (base: number, lighthouse: number): number => base * (1 + 0.1 * (lighthouse - 1));
/** C: how long an emptied isle or shoal waits before it fills again (proposed; a wreck: 2 hours). */
export const HARVEST_REFILL = 8 * HOUR;

/** D: the builders at this Lighthouse level: 2, a third at 10, a fourth at 20 (proposed, never for sale). */
export const buildersAt = (lighthouse: number): number => 2 + (lighthouse >= 10 ? 1 : 0) + (lighthouse >= 20 ? 1 : 0);

const A: Partial<Variant> = { production: (_producer, level) => raised(level) };
const B: Partial<Variant> = { storageHours: 10 };
const C: Partial<Variant> = { harvest: { amount: harvestAmount, refill: HARVEST_REFILL } };
const D: Partial<Variant> = { builders: buildersAt };
const OPTIONS = { A, B, C, D } as const;

/** A variant made of options: "A+C" is A and C together. */
export function combine(id: string, name = id): Variant {
  const parts = id.split("+") as (keyof typeof OPTIONS)[];
  return parts.reduce<Variant>((v, k) => ({ ...v, ...OPTIONS[k] }), { id, name });
}

/** The study's variants, alone and combined; E, the recommended one, is A + C. */
export const VARIANTS: readonly Variant[] = [
  ...["A", "B", "C", "D", "A+B", "A+D", "B+C", "C+D", "A+B+C", "A+B+C+D"].map((id) => combine(id)),
  { ...combine("A+C"), id: "E", name: "E (A + C)" },
  // The same, with A on the Lumberyard and the Refinery only: the fish of the island is not short.
  { ...combine("A+C"), id: "E-wood-oil", name: "E, A without the Fishery", production: (producer, level) => (producer === "fishery" ? level : raised(level)) },
];

/** The day of a measure (the founding day is 0; the simulator's day 2 is 1). */
export const DAY_TWO = 1;

/** What came in at Lighthouse `from` and above, by resource: the share that came from the sea (wrecks, isles, shoals, camps). */
export function seaShare(income: Measures["income"], from: number): Record<Res, number | null> {
  const sum = { oil: { sea: 0, all: 0 }, fish: { sea: 0, all: 0 }, wood: { sea: 0, all: 0 } };
  for (const [level, sources] of Object.entries(income)) {
    if (Number(level) < from) continue;
    for (const [source, got] of Object.entries(sources) as [Source, Record<Res, number>][]) {
      for (const k of ["oil", "fish", "wood"] as const) {
        sum[k].all += got[k];
        if (source !== "buildings" && source !== "rewards") sum[k].sea += got[k];
      }
    }
  }
  return { oil: sum.oil.all ? sum.oil.sea / sum.oil.all : null, fish: sum.fish.all ? sum.fish.sea / sum.fish.all : null, wood: sum.wood.all ? sum.wood.sea / sum.wood.all : null };
}

/** What came in between two Lighthouse levels (from included, to excluded), by source and resource. */
export function incomeBetween(income: Measures["income"], from: number, to: number): Record<Source, Record<Res, number>> {
  const out = {} as Record<Source, Record<Res, number>>;
  for (const [level, sources] of Object.entries(income)) {
    if (Number(level) < from || Number(level) >= to) continue;
    for (const [source, got] of Object.entries(sources) as [Source, Record<Res, number>][]) {
      const o = (out[source] ??= { oil: 0, fish: 0, wood: 0 });
      for (const k of ["oil", "fish", "wood"] as const) o[k] += got[k];
    }
  }
  return out;
}

/** What the storage cut off a day, on average, from day `from` to day `to` (excluded), all three resources. */
export function lostPerDay(lost: Measures["lost"], from: number, to: number): Record<Res, number> {
  const t = { oil: 0, fish: 0, wood: 0 };
  for (const [day, l] of Object.entries(lost)) if (Number(day) >= from && Number(day) < to) for (const k of ["oil", "fish", "wood"] as const) t[k] += l[k];
  const n = Math.max(1, to - from);
  return { oil: t.oil / n, fish: t.fish / n, wood: t.wood / n };
}

/** The mornings a builder was free and neither the Lighthouse nor a producer could be paid for. */
export const failedMornings = (m: Measures) => m.mornings.filter((x) => x.builderFree && !x.affordable).length;

/** A day of the run from hours after the founding, for the tables. */
export const dayOf = (hours: number | undefined) => (hours === undefined ? null : hours / 24);
/** A difference in %, rounded to a tenth, with its sign. */
export function pct(value: number | null, base: number | null): string {
  if (value === null || base === null || base === 0) return "–";
  const p = Math.round(((value - base) / base) * 1000) / 10;
  return `${p > 0 ? "+" : ""}${p} %`;
}
export const share = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)} %`);
export const day = (d: number | null) => (d === null ? "not reached" : `day ${d.toFixed(1)}`);
