import { CAPTAINS, emptyTroops, oilAutonomy, power, storeCap, survivorCap, type CaptainId } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";

/** Short amounts for the pills, as in the prototype: "520", "1.2 k", "12 k". */
export function shortAmount(n: number): string {
  const v = Math.floor(n);
  if (v >= 10_000) return `${Math.floor(v / 1000)} k`;
  if (v >= 1000) return `${(Math.floor(v / 100) / 10).toFixed(1)} k`;
  return String(v);
}

/** Longer amounts (Power): "2,312", "12.3 k", "123 k". */
export function longAmount(n: number): string {
  const v = Math.floor(n);
  if (v >= 100_000) return `${Math.floor(v / 1000)} k`;
  if (v >= 10_000) return `${(Math.floor(v / 100) / 10).toFixed(1)} k`;
  return v.toLocaleString("en-US");
}

/** A net rate per hour from netRates: "+14.0/h", "−0.4/h". */
export const rateText = (perHour: number): string => `${perHour >= 0 ? "+" : "−"}${Math.abs(perHour).toFixed(1)}/h`;

/** How full the warehouses are for one resource, from 0 to 1 (storeCap from the shared rules). */
export const fillRatio = (state: PlayerState, amount: number): number =>
  Math.min(1, Math.max(0, amount / storeCap(state.buildings.lighthouse, state.techs)));

/** A pill turns red from this filling: production soon stops. */
export const FULL_AT = 0.95;

/** The city's Power, computed by power() from the shared rules. There are no veterans yet. */
export function cityPower(state: PlayerState): number {
  const captains = (Object.entries(state.captains) as [CaptainId, { level: number; stars: number } | undefined][])
    .filter((e): e is [CaptainId, { level: number; stars: number }] => !!e[1])
    .map(([id, c]) => ({ rarity: CAPTAINS[id].rarity, stars: c.stars, level: c.level }));
  return power({ buildings: state.buildings, troops: state.troops, veterans: emptyTroops(), captains, techs: state.techs, rafts: state.rafts });
}

export const survivorsText = (state: PlayerState): string => `${state.survivors}/${survivorCap(state.buildings.shelters)}`;

/**
 * The Mist banner, with no countdown (the Mist calendar will come from the server):
 * how long your oil lasts with the Lighthouse stoked, from oilAutonomy in the shared rules.
 */
export function mistText(state: PlayerState): string {
  const s = oilAutonomy(state, state.stock.oil);
  if (!Number.isFinite(s)) return "Calm sea · your oil holds in the Mist";
  const minutes = Math.round(s / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const time = h >= 100 ? "99+ h" : h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
  return `Calm sea · oil for ${time} in the Mist`;
}
