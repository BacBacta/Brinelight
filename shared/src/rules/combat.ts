import { emptyTroops, type Rarity, type TroopType, type Troops } from "./types.js";
import { attackBonus, type CaptainClass } from "./captains.js";
import { woundedSaved } from "./healing.js";

/** Each troop type beats the next: boarders > harpooners > crossbowmen > boarders. */
export const BEATS: Record<TroopType, TroopType> = { boarders: "harpooners", harpooners: "crossbowmen", crossbowmen: "boarders" };
export const COUNTER_BONUS = 1.2;
export const VETERAN_WEIGHT = 1.8;
/** The attack a fleet gains per Watchtower level on your rafts (prototype: +5%). */
export const WATCHTOWER_ATTACK = 0.05;
const TYPES: TroopType[] = ["boarders", "harpooners", "crossbowmen"];

/** Makeup of a level `level` pirate camp. */
export function pirateCamp(level: number): Troops {
  const main = TYPES[level % 3] as TroopType;
  const base = 30 + level * 28;
  const c: Troops = { boarders: Math.round(base * 0.25), harpooners: Math.round(base * 0.25), crossbowmen: Math.round(base * 0.25) };
  c[main] += Math.round(base * 0.5);
  return c;
}

export type CombatInput = {
  troops: Troops;
  veterans?: Troops;
  enemy: Troops;
  captain?: { cls: CaptainClass; rarity: Rarity; level: number } | null;
  techs?: { blades?: number; hulls?: number; stretchers?: number };
  /** Sum of Watchtower levels (weighted by their condition). */
  watchtowers?: number;
  /** Infirmary: total beds and beds already taken. Absent = no infirmary. */
  hospital?: { capacity: number; occupied: number } | null;
};

export type CombatResult = {
  win: boolean;
  attack: number;
  defense: number;
  lossRate: number;
  /** Soldiers lost (dead + wounded). */
  losses: Troops;
  veteranLosses: Troops;
  /** Share of the losses sent to the infirmary. */
  wounded: Troops;
  survivors: Troops;
  veteranSurvivors: Troops;
};

/** Effective strength: a veteran counts as 1.8 soldiers. */
export function effective(troops: Troops, veterans: Troops = emptyTroops()): Troops {
  return {
    boarders: troops.boarders + veterans.boarders * VETERAN_WEIGHT,
    harpooners: troops.harpooners + veterans.harpooners * VETERAN_WEIGHT,
    crossbowmen: troops.crossbowmen + veterans.crossbowmen * VETERAN_WEIGHT,
  };
}

/** Attack and defense strength, without applying losses. Also used to display the odds. */
export function strengths(input: CombatInput): { attack: number; defense: number } {
  const eff = effective(input.troops, input.veterans);
  const cap = input.captain;
  const capMul = cap && cap.cls in BEATS ? attackBonus(cap.rarity, cap.level) : 1;
  let attack = 0;
  for (const k of TYPES) {
    let v = eff[k];
    if (input.enemy[BEATS[k]] > 0) v *= COUNTER_BONUS;
    if (cap && cap.cls === k) v *= capMul;
    attack += v;
  }
  attack *= 1 + 0.06 * (input.techs?.blades ?? 0);
  attack *= 1 + WATCHTOWER_ATTACK * (input.watchtowers ?? 0);
  let defense = 0;
  for (const k of TYPES) {
    // Pirates also benefit from the triangle when you field their prey.
    defense += input.enemy[k] * (eff[BEATS[k]] > 0 ? COUNTER_BONUS : 1);
  }
  return { attack, defense };
}

/** Deterministic combat: at equal strength, the army makeup decides. No randomness. */
export function resolveCombat(input: CombatInput): CombatResult {
  const { attack, defense } = strengths(input);
  const win = attack > defense;
  const base = win ? Math.min(0.6, Math.max(0.05, (defense / attack) * 0.5)) : 0.7;
  const lossRate = base * (1 - 0.08 * (input.techs?.hulls ?? 0));
  const vets = input.veterans ?? emptyTroops();
  const losses = emptyTroops(), veteranLosses = emptyTroops(), wounded = emptyTroops();
  const survivors = emptyTroops(), veteranSurvivors = emptyTroops();
  const saveRate = woundedSaved(input.techs?.stretchers ?? 0);
  let room = input.hospital ? Math.max(0, input.hospital.capacity - input.hospital.occupied) : 0;
  for (const k of TYPES) {
    losses[k] = Math.round(input.troops[k] * lossRate);
    survivors[k] = input.troops[k] - losses[k];
    veteranLosses[k] = Math.round(vets[k] * lossRate);
    veteranSurvivors[k] = vets[k] - veteranLosses[k];
    const w = input.hospital ? Math.min(room, Math.round(losses[k] * saveRate)) : 0;
    wounded[k] = w;
    room -= w;
  }
  return { win, attack, defense, lossRate, losses, veteranLosses, wounded, survivors, veteranSurvivors };
}

/** Loot from a defeated pirate camp. */
export const pirateLoot = (level: number) => ({ oil: 60 + level * 50, wood: 60 + level * 50, pearls: 10 + level * 6, rope: 1, fragments: level });

/** Odds shown before the attack. */
export function odds(input: CombatInput): "easy" | "close" | "hard" {
  const { attack, defense } = strengths(input);
  const r = attack / Math.max(1, defense);
  return r > 1.4 ? "easy" : r > 1 ? "close" : "hard";
}
