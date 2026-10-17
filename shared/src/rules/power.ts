import type { Buildings, BuildingId, Rarity, Troops } from "./types.js";
import { totalTroops } from "./types.js";
import type { Techs } from "./research.js";
import type { Rafts } from "./rafts.js";

const RARITY_POWER: Record<Rarity, number> = { officer: 150, commander: 320, admiral: 650 };
/** Power of a moored raft, and of each level of the building on it. */
export const RAFT_POWER = 60;
export const RAFT_LEVEL_POWER = 90;

export type PowerState = {
  buildings: Buildings;
  troops: Troops;
  veterans: Troops;
  captains: { rarity: Rarity; stars: number; level: number }[];
  techs: Techs;
  rafts: Rafts;
};

/** Displayed Power: the progression measure compared on the leaderboard. */
export function power(s: PowerState): number {
  let p = 0;
  for (const [id, l] of Object.entries(s.buildings) as [BuildingId, number][]) p += (id === "lighthouse" ? 320 : 110) * l * (1 + l * 0.4);
  p += totalTroops(s.troops) * 4;
  p += totalTroops(s.veterans) * 8;
  for (const c of s.captains) p += RARITY_POWER[c.rarity] * c.stars * (1 + 0.05 * (c.level - 1));
  for (const l of Object.values(s.techs)) p += (l ?? 0) * 140;
  for (const r of Object.values(s.rafts)) p += RAFT_POWER + (r.building ? r.level * RAFT_LEVEL_POWER : 0);
  return Math.round(p);
}
