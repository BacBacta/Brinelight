/**
 * The population study (docs/studies/population.md): the values it proposes and their pure rules. A study only: none
 * of it is in `shared/`, and nothing goes into the game without the owner's agreement, value by value.
 *
 * - Survivors come with time while the city has room (the Shelters and the Houses) and fish: the Lighthouse's light
 *   calls them, so more come at a higher level; the morale speeds or slows them. The fleets bring some back.
 * - Each eats fish every hour (the rules' 0.6). Out of fish, no one comes and the morale falls; no one dies or leaves.
 * - A House stands on a plot won (a raft), built and upgraded at the shipyard, and gives room.
 * - A third and a fourth builder come with the survivors. Never for sale.
 */
import { roundCost, survivorCap, type Cost } from "@brinelight/shared";

export type Proposal = {
  id: string;
  name: string;
  /** Survivors who come per real hour: `base` + `perLevel` × the Lighthouse's level, at the morale of a fed city. */
  arrivals: { base: number; perLevel: number };
  /**
   * The morale: it moves `perHour` points an hour toward `fed` while the city has fish, toward `hungry` while it has
   * none; a Mist the Lighthouse held adds `held` at once, one it did not hold takes `missed` away. Between 0 and 100.
   */
  morale: { fed: number; hungry: number; perHour: number; held: number; missed: number };
  /** Survivors a fleet brings home: from a wreck it salvaged, from a camp it beat. */
  rescues: { wreck: number; camp: number };
  /**
   * The House: its cost to build (level 0 to 1), × `growth` a level after; its room per level; its last level, and one
   * level more every `levelEvery` Lighthouse levels (level 1 from the start, as the other buildings follow the Lighthouse).
   */
  house: { cost: Cost; growth: number; roomPerLevel: number; maxLevel: number; levelEvery: number } | null;
  /** The survivors at which the third, then the fourth builder comes (never for sale). Empty: the rules' two. */
  builders: readonly number[];
};

/** The study's starting values. */
export const START: Proposal = {
  id: "start",
  name: "The starting values",
  arrivals: { base: 0.1, perLevel: 0.02 },
  morale: { fed: 84, hungry: 40, perHour: 1, held: 2, missed: 5 },
  rescues: { wreck: 1, camp: 2 },
  house: { cost: { wood: 600, fish: 300 }, growth: 3, roomPerLevel: 4, maxLevel: 5, levelEvery: 7 },
  builders: [],
};

/** The morale the rules give every city today, from its start to its end. */
export const RULES_MORALE = 84;

/** The room for survivors: the Shelters' (the rules': 6 + 4 a level), and each House's levels. */
export const room = (p: Proposal, shelters: number, houseLevels: number): number => survivorCap(shelters) + (p.house?.roomPerLevel ?? 0) * houseLevels;

/** Survivors who come per real hour, at this Lighthouse level and morale (none without fish: `fed` false). */
export const arrivalsPerHour = (p: Proposal, lighthouse: number, morale: number, fed: boolean): number =>
  fed ? (p.arrivals.base + p.arrivals.perLevel * lighthouse) * (morale / p.morale.fed) : 0;

/** The morale after `hours` toward its target (fed or hungry), never past it. */
export function moraleAfter(p: Proposal, morale: number, fed: boolean, hours: number): number {
  const target = fed ? p.morale.fed : p.morale.hungry;
  const step = p.morale.perHour * hours;
  return morale < target ? Math.min(target, morale + step) : Math.max(target, morale - step);
}

/** The morale after Mists held and not held. */
export const moraleAfterMists = (p: Proposal, morale: number, held: number, missed: number): number =>
  Math.min(100, Math.max(0, morale + held * p.morale.held - missed * p.morale.missed));

/** The builders a city of this many survivors has: two, then one more at each threshold. */
export const buildersFor = (p: Proposal, survivors: number): number => 2 + p.builders.filter((n) => survivors >= n).length;

/** A House's highest level at this Lighthouse level. */
export const houseMaxLevel = (p: Proposal, lighthouse: number): number => Math.min(p.house!.maxLevel, 1 + Math.floor(lighthouse / p.house!.levelEvery));

/** A House's cost from `level` to `level + 1`. */
export function houseCost(p: Proposal, level: number): Cost {
  const h = p.house!;
  return roundCost(Object.fromEntries(Object.entries(h.cost).map(([k, v]) => [k, v * h.growth ** level])) as Cost);
}
