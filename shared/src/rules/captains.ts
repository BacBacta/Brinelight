import { OK, refuse, type Check, type Rarity, type TroopType } from "./types.js";

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
/** Stars a captain can reach (prototype: 5). */
export const CAPTAIN_MAX_STARS = 5;
/** Experience of a combat for the captain who sailed (prototype): 20 + 10 × the camp's level for a victory, 10 for a defeat. */
export const XP_WIN_BASE = 20;
export const XP_WIN_PER_LEVEL = 10;
export const XP_DEFEAT = 10;
export const combatXp = (win: boolean, campLevel: number): number => (win ? XP_WIN_BASE + XP_WIN_PER_LEVEL * campLevel : XP_DEFEAT);
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

/** A captain you own, and the shards you have for each captain, owned or not. */
export type CaptainState = { level: number; xp: number; stars: number };
export type Captains = Partial<Record<CaptainId, CaptainState>>;
export type Shards = Partial<Record<CaptainId, number>>;

/** Any captain you own can lead your fleets. */
export function canSetLead(id: CaptainId, captains: Captains): Check {
  return captains[id] ? OK : refuse("Recruit this captain first");
}

/** Can you give a Logbook to your lead captain now? */
export function canUseLogbook(ctx: { lead: CaptainId | null; captains: Captains; pearls: number }): Check {
  const c = ctx.lead ? ctx.captains[ctx.lead] : undefined;
  if (!ctx.lead || !c) return refuse("Choose a lead captain first");
  if (c.level >= CAPTAIN_MAX_LEVEL) return refuse("Your lead captain is at max level");
  if (ctx.pearls < LOGBOOK.pearls) return refuse("Not enough Pearls");
  return OK;
}

export type UseLogbook = { ok: true; captains: Captains; pearls: number } | { ok: false; reason: string };

/** A Logbook: LOGBOOK.xp experience for your lead captain, for LOGBOOK.pearls Pearls, with its level-ups. */
export function useLogbook(ctx: { lead: CaptainId | null; captains: Captains; pearls: number }): UseLogbook {
  const check = canUseLogbook(ctx);
  if (!check.ok) return check;
  const id = ctx.lead!;
  const c = ctx.captains[id]!;
  const { level, xp } = addXp(c, LOGBOOK.xp);
  return { ok: true, captains: { ...ctx.captains, [id]: { ...c, level, xp } }, pearls: ctx.pearls - LOGBOOK.pearls };
}

export type UseShards = { ok: true; captains: Captains; shards: Shards } | { ok: false; reason: string };

/** Can you unlock this captain with FRAGMENTS_PER_STAR shards? */
export function canUnlockCaptain(id: CaptainId, ctx: { captains: Captains; shards: Shards }): Check {
  if (ctx.captains[id]) return refuse("You already have this captain");
  if ((ctx.shards[id] ?? 0) < FRAGMENTS_PER_STAR) return refuse(`You need ${FRAGMENTS_PER_STAR} shards`);
  return OK;
}

/** Unlocks a captain: FRAGMENTS_PER_STAR shards, and the captain joins you at level 1, with 1 star. */
export function unlockWithShards(id: CaptainId, ctx: { captains: Captains; shards: Shards }): UseShards {
  const check = canUnlockCaptain(id, ctx);
  if (!check.ok) return check;
  return {
    ok: true,
    captains: { ...ctx.captains, [id]: { level: 1, xp: 0, stars: 1 } },
    shards: { ...ctx.shards, [id]: ctx.shards[id]! - FRAGMENTS_PER_STAR },
  };
}

/** Can you add a star to this captain with FRAGMENTS_PER_STAR shards? */
export function canAddStar(id: CaptainId, ctx: { captains: Captains; shards: Shards }): Check {
  const c = ctx.captains[id];
  if (!c) return refuse("Recruit this captain first");
  if (c.stars >= CAPTAIN_MAX_STARS) return refuse("Max stars");
  if ((ctx.shards[id] ?? 0) < FRAGMENTS_PER_STAR) return refuse(`You need ${FRAGMENTS_PER_STAR} shards`);
  return OK;
}

/** Adds a star to a captain you own, for FRAGMENTS_PER_STAR shards. */
export function starWithShards(id: CaptainId, ctx: { captains: Captains; shards: Shards }): UseShards {
  const check = canAddStar(id, ctx);
  if (!check.ok) return check;
  const c = ctx.captains[id]!;
  return {
    ok: true,
    captains: { ...ctx.captains, [id]: { ...c, stars: c.stars + 1 } },
    shards: { ...ctx.shards, [id]: ctx.shards[id]! - FRAGMENTS_PER_STAR },
  };
}
