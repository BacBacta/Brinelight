import type { Buildings, BuildingId, Rarity, Troops } from "./types.js";
import { totalTroops } from "./types.js";
import type { Techs } from "./research.js";
import type { Rafts } from "./rafts.js";

const RARITY_POWER: Record<Rarity, number> = { officier: 150, commandant: 320, amiral: 650 };

export type PowerState = {
  buildings: Buildings;
  troops: Troops;
  veterans: Troops;
  captains: { rarity: Rarity; stars: number; level: number }[];
  techs: Techs;
  rafts: Rafts;
};

/** Puissance affichée : la mesure de progression comparée au classement. */
export function power(s: PowerState): number {
  let p = 0;
  for (const [id, l] of Object.entries(s.buildings) as [BuildingId, number][]) p += (id === "phare" ? 320 : 110) * l * (1 + l * 0.4);
  p += totalTroops(s.troops) * 4;
  p += totalTroops(s.veterans) * 8;
  for (const c of s.captains) p += RARITY_POWER[c.rarity] * c.stars * (1 + 0.05 * (c.level - 1));
  for (const l of Object.values(s.techs)) p += (l ?? 0) * 140;
  for (const r of Object.values(s.rafts)) p += 60 + (r.building ? r.level * 90 : 0);
  return Math.round(p);
}
