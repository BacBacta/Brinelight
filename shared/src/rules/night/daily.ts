/**
 * The portal's day (Hold the Light): five tasks and three chests, and the free daily recruitment, all starting again at
 * midnight UTC (`dayOf`, the daily rules the game already has). The recruitment's rarity is drawn from the day's seed by
 * `rarityFromRoll`, which reads the published odds (`RECRUIT_ODDS`): read, never changed. Free, never sold.
 */
import { rarityFromRoll } from "../captains.js";
import { dayOf } from "../daily.js";
import type { Rarity } from "../types.js";
import { CAPTAIN_IDS, type CaptainId } from "./captains.js";
import type { PortalCity } from "./city.js";
import { wavesCleared } from "./loot.js";
import { nextFloat, nextInt, seedRng } from "./random.js";
import type { NightState } from "./state.js";
import { SHARDS_TO_UNLOCK } from "./values.js";

export const PORTAL_TASK_IDS = ["nights", "wins", "burned", "waves", "upgrades"] as const;
export type PortalTaskId = (typeof PORTAL_TASK_IDS)[number];

export const PORTAL_TASKS: readonly { id: PortalTaskId; text: string; goal: number; points: number }[] = [
  { id: "nights", text: "Play 3 Nights", goal: 3, points: 20 },
  { id: "wins", text: "Win a Night", goal: 1, points: 20 },
  { id: "burned", text: "Burn 100 boats", goal: 100, points: 20 },
  { id: "waves", text: "Hold 20 waves", goal: 20, points: 20 },
  { id: "upgrades", text: "Upgrade a building", goal: 1, points: 20 },
];

export const DAILY_CHESTS: readonly { points: number; reward: { wood: number; fish: number; pearls: number } }[] = [
  { points: 30, reward: { wood: 150, fish: 100, pearls: 0 } },
  { points: 60, reward: { wood: 300, fish: 200, pearls: 5 } },
  { points: 100, reward: { wood: 500, fish: 350, pearls: 15 } },
];

/** Shards the daily recruitment gives a captain of each rarity. */
export const RECRUIT_SHARDS: Readonly<Record<Rarity, number>> = { admiral: 10, commander: 6, officer: 3 };
/** The portal's captains by the rarity the game gives them. */
const RARITY_OF: Readonly<Record<CaptainId, Rarity>> = { tom: "officer", sel: "officer", bran: "commander", isa: "commander", mira: "admiral", nera: "admiral" };

export type PortalDaily = { day: number; counts: Record<PortalTaskId, number>; chests: number[]; recruited: boolean };

const fresh = (day: number): PortalDaily => ({ day, counts: { nights: 0, wins: 0, burned: 0, waves: 0, upgrades: 0 }, chests: [], recruited: false });
export const newDaily = (): PortalDaily => fresh(-1);
/** The day of a device's clock (seconds), midnight UTC. */
export const portalDay = (now: number): number => dayOf(now, "s1");

/** The city with today's tasks: started again if the day changed. */
export function dailyNow(c: PortalCity, now: number): PortalCity {
  const day = portalDay(now);
  return c.daily.day === day ? c : { ...c, daily: fresh(day) };
}

const count = (c: PortalCity, now: number, add: Partial<Record<PortalTaskId, number>>): PortalCity => {
  const d = dailyNow(c, now);
  const counts = { ...d.daily.counts };
  for (const [k, v] of Object.entries(add)) counts[k as PortalTaskId] += v ?? 0;
  return { ...d, daily: { ...d.daily, counts } };
};

/** A Night over counts: played, won, the boats burned, the waves held. */
export const dailyAfterNight = (c: PortalCity, n: NightState, now: number): PortalCity =>
  count(c, now, { nights: 1, wins: n.phase === "won" ? 1 : 0, burned: n.burned, waves: wavesCleared(n) });
export const dailyAfterUpgrade = (c: PortalCity, now: number): PortalCity => count(c, now, { upgrades: 1 });

export const dailyPointsOf = (c: PortalCity): number => PORTAL_TASKS.reduce((p, t) => p + (c.daily.counts[t.id] >= t.goal ? t.points : 0), 0);

type Result = { ok: true; city: PortalCity } | { ok: false; reason: string };

/** Today's chest of `points`, opened; or why not. */
export function openDailyChest(c0: PortalCity, now: number, points: number): Result {
  const c = dailyNow(c0, now);
  const chest = DAILY_CHESTS.find((k) => k.points === points);
  if (!chest) return { ok: false, reason: "There is no such chest." };
  if (c.daily.chests.includes(points)) return { ok: false, reason: "You already opened this chest today." };
  if (dailyPointsOf(c) < points) return { ok: false, reason: `You need ${points} points today to open this chest.` };
  const s = c.stock;
  return { ok: true, city: { ...c, stock: { wood: s.wood + chest.reward.wood, fish: s.fish + chest.reward.fish, pearls: s.pearls + chest.reward.pearls }, daily: { ...c.daily, chests: [...c.daily.chests, points] } } };
}

/** The day's draw: a roll from 0 to 99 from the day's own seed, its rarity by the published odds, and which captain of it. */
export function recruitDraw(day: number): { rarity: Rarity; pick: number } {
  const [f, r] = nextFloat(seedRng(day * 2654435761));
  const rarity = rarityFromRoll(Math.floor(f * 100));
  const [pick] = nextInt(r, 2);
  return { rarity, pick };
}

/** The free recruitment, once a day: shards for a captain of the rarity drawn, who joins at 10. */
export function recruitDaily(c0: PortalCity, now: number): ({ ok: true; city: PortalCity; captain: CaptainId; rarity: Rarity }) | { ok: false; reason: string } {
  const c = dailyNow(c0, now);
  if (c.daily.recruited) return { ok: false, reason: "You already recruited today. Come back tomorrow." };
  const { rarity, pick } = recruitDraw(c.daily.day);
  const of = CAPTAIN_IDS.filter((id) => RARITY_OF[id] === rarity);
  const captain = of[pick % of.length]!;
  const cap = c.captains;
  const shards = { ...cap.shards, [captain]: cap.shards[captain] + RECRUIT_SHARDS[rarity] };
  const unlocked = !cap.unlocked.includes(captain) && shards[captain] >= SHARDS_TO_UNLOCK ? [...cap.unlocked, captain] : cap.unlocked;
  return { ok: true, captain, rarity, city: { ...c, captains: { ...cap, shards, unlocked }, daily: { ...c.daily, recruited: true } } };
}
