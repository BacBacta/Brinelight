import type { Rarity, TroopType } from "./types.js";

export type CaptainClass = TroopType | "collect" | "defense" | "speed";
export type CaptainId = "bran" | "isa" | "mira" | "tom" | "nera" | "sel";

export const CAPTAINS: Record<CaptainId, { name: string; cls: CaptainClass; rarity: Rarity; skill: string }> = {
  bran: { name: "Bran the Boarder", cls: "boarders", rarity: "commander", skill: "+15% boarder attack" },
  isa: { name: "Isa the Harpooner", cls: "harpooners", rarity: "commander", skill: "+15% harpooner attack" },
  mira: { name: "Mira Lynx-Eye", cls: "crossbowmen", rarity: "admiral", skill: "+25% crossbowman attack" },
  tom: { name: "Old Tom", cls: "collect", rarity: "officer", skill: "+30% gathering" },
  nera: { name: "Nera of the Mist", cls: "defense", rarity: "admiral", skill: "−50% losses in the Great Mist" },
  sel: { name: "Sel the Navigator", cls: "speed", rarity: "officer", skill: "+40% fleet speed" },
};

/** Published odds of the free recruitment, in percent. They add up to 100. */
export const RECRUIT_ODDS: Record<Rarity, number> = { admiral: 5, commander: 25, officer: 70 };

/** Rarity drawn from a number from 0 to 99 taken from the randomness proof. */
export function rarityFromRoll(roll: number): Rarity {
  if (!Number.isInteger(roll) || roll < 0 || roll > 99) throw new Error("The roll must be an integer from 0 to 99");
  if (roll < RECRUIT_ODDS.admiral) return "admiral";
  if (roll < RECRUIT_ODDS.admiral + RECRUIT_ODDS.commander) return "commander";
  return "officer";
}

export const CAPTAIN_MAX_LEVEL = 20;
export const FRAGMENTS_PER_STAR = 10;
export const xpNeeded = (level: number): number => 80 * level;

/** Adds experience and applies level-ups. */
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

/** Factor applied to the skill: +4% per level above the first. */
export const skillFactor = (level: number): number => 1 + 0.04 * (level - 1);

/** Attack bonus of a combat captain on its troop class. */
export function attackBonus(rarity: Rarity, level: number): number {
  const base = rarity === "admiral" ? 0.25 : 0.15;
  return 1 + base * skillFactor(level);
}

/** Logbook: experience in exchange for Pearls, earned by playing. */
export const LOGBOOK = { pearls: 50, xp: 40 };
