import { emptyTroops, type Rarity, type TroopType, type Troops } from "./types.js";
import { attackBonus, type CaptainClass } from "./captains.js";

/** Chaque type de troupe bat le suivant : abordeurs > harponneurs > arbalétriers > abordeurs. */
export const BEATS: Record<TroopType, TroopType> = { ab: "ha", ha: "ar", ar: "ab" };
export const COUNTER_BONUS = 1.2;
export const VETERAN_WEIGHT = 1.8;
const TYPES: TroopType[] = ["ab", "ha", "ar"];

/** Composition d'un camp de pirates de niveau `level`. */
export function pirateCamp(level: number): Troops {
  const main = TYPES[level % 3] as TroopType;
  const base = 30 + level * 28;
  const c: Troops = { ab: Math.round(base * 0.25), ha: Math.round(base * 0.25), ar: Math.round(base * 0.25) };
  c[main] += Math.round(base * 0.5);
  return c;
}

export type CombatInput = {
  troops: Troops;
  veterans?: Troops;
  enemy: Troops;
  captain?: { cls: CaptainClass; rarity: Rarity; level: number } | null;
  techs?: { lames?: number; coques?: number; soins?: number };
  /** Somme des niveaux de Tours de guet (pondérée par leur solidité). */
  watchtowers?: number;
  /** Infirmerie : places totales et déjà occupées. Absente = pas d'infirmerie. */
  hospital?: { capacity: number; occupied: number } | null;
};

export type CombatResult = {
  win: boolean;
  attack: number;
  defense: number;
  lossRate: number;
  /** Soldats perdus (morts + blessés). */
  losses: Troops;
  veteranLosses: Troops;
  /** Part des pertes envoyée à l'infirmerie. */
  wounded: Troops;
  survivors: Troops;
  veteranSurvivors: Troops;
};

/** Force effective : un vétéran compte pour 1,8 soldat. */
export function effective(troops: Troops, veterans: Troops = emptyTroops()): Troops {
  return { ab: troops.ab + veterans.ab * VETERAN_WEIGHT, ha: troops.ha + veterans.ha * VETERAN_WEIGHT, ar: troops.ar + veterans.ar * VETERAN_WEIGHT };
}

/** Force d'attaque et de défense, sans appliquer les pertes. Utilisé aussi pour afficher les chances. */
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
  attack *= 1 + 0.06 * (input.techs?.lames ?? 0);
  attack *= 1 + 0.05 * (input.watchtowers ?? 0);
  let defense = 0;
  for (const k of TYPES) {
    // Les pirates profitent aussi du triangle quand on aligne leur proie.
    defense += input.enemy[k] * (eff[BEATS[k]] > 0 ? COUNTER_BONUS : 1);
  }
  return { attack, defense };
}

/** Combat déterministe : à forces égales, la composition décide. Aucun hasard. */
export function resolveCombat(input: CombatInput): CombatResult {
  const { attack, defense } = strengths(input);
  const win = attack > defense;
  const base = win ? Math.min(0.6, Math.max(0.05, (defense / attack) * 0.5)) : 0.7;
  const lossRate = base * (1 - 0.08 * (input.techs?.coques ?? 0));
  const vets = input.veterans ?? emptyTroops();
  const losses = emptyTroops(), veteranLosses = emptyTroops(), wounded = emptyTroops();
  const survivors = emptyTroops(), veteranSurvivors = emptyTroops();
  const saveRate = 0.5 + 0.1 * (input.techs?.soins ?? 0);
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

/** Butin d'un camp de pirates vaincu. */
export const pirateLoot = (level: number) => ({ huile: 60 + level * 50, bois: 60 + level * 50, perles: 10 + level * 6, cord: 1, fragments: level });

/** Chances affichées avant l'attaque. */
export function odds(input: CombatInput): "easy" | "close" | "hard" {
  const { attack, defense } = strengths(input);
  const r = attack / Math.max(1, defense);
  return r > 1.4 ? "easy" : r > 1 ? "close" : "hard";
}
