/**
 * The sea-hunt study's proposals (docs/studies/sea-hunt.md): long expeditions to far zones that bring back a rare
 * resource, Amber, and base resources, at the risk of a share of their escort (never the city); and the speed-up of a
 * construction paid in wood, oil or fish, with a daily cap. Pure values and functions: the study's rules
 * (`sea-hunt-rules.ts`) play them. Nothing here is in the game, and nothing changes `shared/`.
 */
import { HOUR, type BuildingId, type Cost } from "@brinelight/shared";

/** A far zone: its trip there and back, what it brings and what it risks. */
export type Zone = {
  id: string;
  name: string;
  /** The whole trip, out, on site and back, in real hours. */
  hours: number;
  /** Base resources brought back, in full isles or shoals of the Lighthouse's level (450 × (1 + 0.1 × (level − 1))). */
  sites: number;
  /** Amber brought back. */
  amber: number;
  /** Soldiers it needs as an escort, per Lighthouse level. */
  escort: number;
  /** The share of the escort lost on the way, known before sailing (no draw). */
  loss: number;
};

/** The owner's example: 2, 8 and 12 hours. */
export const ZONES_2_8_12: readonly Zone[] = [
  { id: "shelf", name: "The Outer Shelf", hours: 2, sites: 0.5, amber: 1, escort: 1, loss: 0 },
  { id: "deeps", name: "The Drowned Deeps", hours: 8, sites: 2, amber: 5, escort: 1, loss: 0.05 },
  { id: "abyss", name: "The Abyss", hours: 12, sites: 3, amber: 8, escort: 1.5, loss: 0.1 },
];
/** The study's zones: 5, 8 and 12 hours, the gaps of a player who comes three times a day (8:00, 13:00, 21:00). */
export const ZONES: readonly Zone[] = [
  { id: "reef", name: "The Far Reef", hours: 5, sites: 1.25, amber: 3, escort: 1, loss: 0.03 },
  ZONES_2_8_12[1]!,
  ZONES_2_8_12[2]!,
];

/** The same zones bringing 1, 2 and 3 Amber (the owner's request of 25 October: Amber a little short). */
export const ZONES_LOW: readonly Zone[] = ZONES.map((z, i) => ({ ...z, amber: i + 1 }));

/** What Amber is for. */
export type AmberUse =
  /** Nothing: the expeditions bring base resources only (to tell the hunt's share from Amber's). */
  | { kind: "none" }
  /** Needed: the eight island buildings' levels 16 to 30 (never the Lighthouse) and the House's levels 4 and 5. */
  | { kind: "gate"; perLevel: number; house: Record<number, number> }
  /** Optional: from level 16, each Amber pays 1 % of an upgrade's base cost, up to `max` % of it. */
  | { kind: "swap"; max: number };

export type Speedup = {
  /** Hours a day a city may take off its constructions. */
  dayHours: number;
  /** An hour taken off costs this many times the job's cost per hour of its full time, in the job's own resources. */
  price: number;
  /** "spare": whatever the Lighthouse's reserve leaves; "surplus": only from a resource at 80 % of the storage or more. */
  policy: "spare" | "surplus";
};

export type Proposal = {
  id: string;
  name: string;
  /** The expeditions: none, or the zones and what Amber is for. */
  /** `share`: at most this share of the city's fleets away at once; `one`: one fleet at most, whatever the Harbor. */
  hunt: { zones: readonly Zone[]; amber: AmberUse; from: number; share: number; one?: boolean } | null;
  speedup: Speedup | null;
  /**
   * Contested shoals (point 3): the share of what the city's fleets take from the isles and shoals that another city on
   * the same site takes instead. None: the city is alone on the map, as today.
   */
  contest?: number;
};

/** The expeditions open at Lighthouse 10; at most half the city's fleets are away on one at a time. */
const HUNT = { zones: ZONES, from: 10, share: 0.5 };

export const PROPOSALS: readonly Proposal[] = [
  { id: "rules", name: "The rules (no expedition, no speed-up)", hunt: null, speedup: null },
  { id: "base3", name: "C · base resources only, zones of 2, 8 and 12 h", hunt: { ...HUNT, zones: ZONES_2_8_12, amber: { kind: "none" } }, speedup: null },
  { id: "base", name: "C · base resources only, zones of 5, 8 and 12 h", hunt: { ...HUNT, amber: { kind: "none" } }, speedup: null },
  { id: "gate", name: "A · Amber needed for the high levels (2 a level past 15)", hunt: { ...HUNT, amber: { kind: "gate", perLevel: 2, house: { 4: 10, 5: 20 } } }, speedup: null },
  { id: "gate1", name: "A · Amber needed for the high levels (1 a level past 15)", hunt: { ...HUNT, amber: { kind: "gate", perLevel: 1, house: { 4: 5, 5: 10 } } }, speedup: null },
  { id: "swap", name: "B · Amber in place of up to 25 % of a cost", hunt: { ...HUNT, amber: { kind: "swap", max: 25 } }, speedup: null },
  { id: "swap10", name: "B · Amber in place of up to 10 % of a cost", hunt: { ...HUNT, amber: { kind: "swap", max: 10 } }, speedup: null },
  { id: "contest25", name: "Contested isles and shoals: a quarter of their harvest to another city", hunt: null, speedup: null, contest: 0.25 },
  { id: "contest50", name: "Contested isles and shoals: half their harvest to another city", hunt: null, speedup: null, contest: 0.5 },
  ...([[1, 5, 10], [2, 0, 0], [2, 2, 4], [2, 3, 6], [2, 5, 10], [2, 10, 20], [3, 10, 20]] as const).map(([perLevel, h4, h5]): Proposal => ({
    id: `low${perLevel}-${h4}`,
    name: `A · 1, 2 and 3 Amber an expedition; ${perLevel} a level past 15, ${h4} and ${h5} for the House's levels 4 and 5`,
    hunt: { ...HUNT, zones: ZONES_LOW, amber: { kind: "gate", perLevel, house: { 4: h4, 5: h5 } } },
    speedup: null,
  })),
  { id: "base1", name: "C · base resources only, one fleet away at a time", hunt: { ...HUNT, one: true, amber: { kind: "none" } }, speedup: null },
  { id: "gate1one", name: "A · Amber needed (1 a level past 15), one fleet away at a time", hunt: { ...HUNT, one: true, amber: { kind: "gate", perLevel: 1, house: { 4: 5, 5: 10 } } }, speedup: null },
  { id: "swap1", name: "B · Amber in place of up to 25 % of a cost, one fleet away at a time", hunt: { ...HUNT, one: true, amber: { kind: "swap", max: 25 } }, speedup: null },
  { id: "speed1", name: "Speed-up, 1 h a day, price ×1, what the reserve leaves", hunt: null, speedup: { dayHours: 1, price: 1, policy: "spare" } },
  { id: "speed1s", name: "Speed-up, 1 h a day, price ×1, from a full storage only", hunt: null, speedup: { dayHours: 1, price: 1, policy: "surplus" } },
  { id: "speed2", name: "Speed-up, 2 h a day, price ×1, what the reserve leaves", hunt: null, speedup: { dayHours: 2, price: 1, policy: "spare" } },
  { id: "speed1x2", name: "Speed-up, 1 h a day, price ×2, what the reserve leaves", hunt: null, speedup: { dayHours: 1, price: 2, policy: "spare" } },
];

/** The Amber an island upgrade to `level + 1` needs (the gate), or 0. */
export function amberForUpgrade(use: AmberUse, id: BuildingId, level: number): number {
  if (use.kind !== "gate" || id === "lighthouse" || level + 1 < 16) return 0;
  return use.perLevel * (level + 1 - 15);
}

/** The Amber a House's upgrade to `level + 1` needs (the gate), or 0. */
export const amberForHouse = (use: AmberUse, level: number): number => (use.kind === "gate" ? (use.house[level + 1] ?? 0) : 0);

/** A full isle or shoal, on average (their map amounts: 450), at this Lighthouse level, as `harvestAmount`. */
export const SITE = 450;
/** The base resources an expedition brings back, all of the resource the city holds least of. */
export const expeditionCargo = (zone: Zone, lighthouse: number): number => Math.round(zone.sites * SITE * (1 + 0.1 * (lighthouse - 1)));

/** The soldiers an expedition takes, at this Lighthouse level. */
export const escortOf = (zone: Zone, lighthouse: number): number => zone.escort * lighthouse;

/** What taking `seconds` off a job costs: its cost × price × the share of its full time taken off. */
export function speedupCost(cost: Cost, duration: number, seconds: number, price: number): Cost {
  const share = (price * seconds) / Math.max(duration, HOUR);
  return Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, Math.ceil((v ?? 0) * share)])) as Cost;
}
