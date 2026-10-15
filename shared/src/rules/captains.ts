import type { Rarity, TroopType } from "./types.js";

export type CaptainClass = TroopType | "col" | "def" | "vit";
export type CaptainId = "bran" | "isa" | "mira" | "tom" | "nera" | "sel";

export const CAPTAINS: Record<CaptainId, { name: string; cls: CaptainClass; rarity: Rarity; skill: string }> = {
  bran: { name: "Bran l'Abordeur", cls: "ab", rarity: "commandant", skill: "+15 % d'attaque des abordeurs" },
  isa: { name: "Isa la Harponneuse", cls: "ha", rarity: "commandant", skill: "+15 % d'attaque des harponneurs" },
  mira: { name: "Mira Œil-de-Lynx", cls: "ar", rarity: "amiral", skill: "+25 % d'attaque des arbalétriers" },
  tom: { name: "Vieux Tom", cls: "col", rarity: "officier", skill: "+30 % de collecte" },
  nera: { name: "Néra la Brumeuse", cls: "def", rarity: "amiral", skill: "−50 % de pertes en Grande Brume" },
  sel: { name: "Sel le Navigateur", cls: "vit", rarity: "officier", skill: "+40 % de vitesse des flottes" },
};

/** Probabilités publiées du recrutement gratuit, en pourcentage. Leur somme vaut 100. */
export const RECRUIT_ODDS: Record<Rarity, number> = { amiral: 5, commandant: 25, officier: 70 };

/** Rareté tirée à partir d'un nombre de 0 à 99 issu de la preuve d'aléa. */
export function rarityFromRoll(roll: number): Rarity {
  if (!Number.isInteger(roll) || roll < 0 || roll > 99) throw new Error("Le tirage doit être un entier de 0 à 99");
  if (roll < RECRUIT_ODDS.amiral) return "amiral";
  if (roll < RECRUIT_ODDS.amiral + RECRUIT_ODDS.commandant) return "commandant";
  return "officier";
}

export const CAPTAIN_MAX_LEVEL = 20;
export const FRAGMENTS_PER_STAR = 10;
export const xpNeeded = (level: number): number => 80 * level;

/** Ajoute de l'expérience et applique les passages de niveau. */
export function addXp(c: { level: number; xp: number }, amount: number): { level: number; xp: number; levelsGained: number } {
  let { level, xp } = c;
  xp += amount;
  let gained = 0;
  while (level < CAPTAIN_MAX_LEVEL && xp >= xpNeeded(level)) {
    xp -= xpNeeded(level);
    level++;
    gained++;
  }
  return { level, xp, levelsGained: gained };
}

/** Facteur appliqué à la compétence : +4 % par niveau au-delà du premier. */
export const skillFactor = (level: number): number => 1 + 0.04 * (level - 1);

/** Bonus d'attaque d'un capitaine de combat sur sa classe de troupe. */
export function attackBonus(rarity: Rarity, level: number): number {
  const base = rarity === "amiral" ? 0.25 : 0.15;
  return 1 + base * skillFactor(level);
}

/** Carnet de bord : de l'expérience contre des Perles, gagnées en jouant. */
export const LOGBOOK = { perles: 50, xp: 40 };
