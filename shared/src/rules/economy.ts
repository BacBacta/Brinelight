import type { Buildings, Resource, Stock } from "./types.js";
import { techLevel, type Techs } from "./research.js";
import { raftEffect, type Rafts } from "./rafts.js";
import { protoRatePerHour } from "./time.js";
import { upgradeCost } from "./buildings.js";

/** Prototype rates, per prototype second and per level. */
const PROTO = {
  refinery: 1.1,
  fishery: 1.4,
  lumberyard: 4.2,
  lighthouseBurn: 0.25,
  survivorEats: 0.02,
  greenhouse: 0.45,
};
/**
 * A producer (the Refinery, the Fishery, the Lumberyard) of level L makes what level L + min(L, 5) made: double up to
 * level 5, then five levels ahead (owner's decision, 23 October; docs/studies/resources.md). Never for sale.
 */
export const producerLevel = (level: number): number => level + Math.min(level, 5);

/** What a Kelp Greenhouse adds per level, in fish per real hour (prototype: 0.45 per prototype second). */
export const GREENHOUSE_FISH_PER_HOUR = protoRatePerHour(PROTO.greenhouse);
/** The fish a survivor eats per real hour: 0.2 (owner's decision, 25 October, with the population and the House; the prototype's 0.6 before). */
export const SURVIVOR_EATS_PER_HOUR = protoRatePerHour(PROTO.survivorEats);
/** The share of fish eaten a Smokehouse saves per level (prototype: 10%), down to half at most. */
export const SMOKEHOUSE_SAVES = 0.1;
/** How many times its oil the Lighthouse burns while stoked in the Mist (week 7: 1.5, was 2.2). */
export const STOKE_MULTIPLIER = 1.5;
export const MIST_PENALTY = 0.7;
export const HIGH_MORALE = 90;
export const HIGH_MORALE_BONUS = 1.1;

/** What the storage holds beyond the next Lighthouse level's wood: never a cost the storage cannot hold. */
export const STORE_MARGIN = 1.25;

/** The storage of each resource: 2,500 a Lighthouse level, and at least 1.25 times the next level's wood; Warehouses add to it. */
export function storeCap(lighthouse: number, techs: Techs = {}): number {
  const base = Math.max(2500 * lighthouse + 1500, STORE_MARGIN * (upgradeCost("lighthouse", lighthouse).wood ?? 0));
  return Math.round(base * (1 + 0.15 * techLevel(techs, "warehouses")));
}

export const survivorCap = (shelters: number): number => 6 + shelters * 4;

export type EconomyState = {
  buildings: Buildings;
  techs: Techs;
  rafts: Rafts;
  survivors: number;
  morale: number;
};

export type Weather = { mist: boolean; stoked: boolean };

/** Net rates PER real HOUR (production minus consumption). */
export function netRates(s: EconomyState, w: Weather = { mist: false, stoked: false }): Record<Exclude<Resource, "rope">, number> {
  const mul = (s.morale >= HIGH_MORALE ? HIGH_MORALE_BONUS : 1) * (w.mist && !w.stoked ? MIST_PENALTY : 1);
  const t = (id: "refining" | "nets" | "saws") => 1 + 0.1 * techLevel(s.techs, id);
  const smoke = Math.max(0.5, 1 - SMOKEHOUSE_SAVES * raftEffect(s.rafts, "smokehouse"));
  const oil = PROTO.refinery * producerLevel(s.buildings.refinery) * mul * t("refining") - PROTO.lighthouseBurn * s.buildings.lighthouse * (w.stoked ? STOKE_MULTIPLIER : 1);
  const fish = PROTO.fishery * producerLevel(s.buildings.fishery) * mul * t("nets") + PROTO.greenhouse * raftEffect(s.rafts, "greenhouse") - s.survivors * PROTO.survivorEats * smoke;
  const wood = PROTO.lumberyard * producerLevel(s.buildings.lumberyard) * mul * t("saws");
  return { oil: protoRatePerHour(oil), fish: protoRatePerHour(fish), wood: protoRatePerHour(wood) };
}

/**
 * Advances the stock by `seconds` real seconds at constant rates.
 * A resource never drops below 0 and never goes above storage,
 * unless it was already above it (loot, reward): in that case it stops growing.
 * This is the basis of the "on demand" computation on the server: no loop running all the time.
 */
export function advanceStock(stock: Stock, rates: Record<Exclude<Resource, "rope">, number>, seconds: number, cap: number): Stock {
  const out = { ...stock };
  for (const k of ["oil", "fish", "wood"] as const) {
    const next = stock[k] + (rates[k] * seconds) / 3600;
    out[k] = Math.min(Math.max(0, next), Math.max(cap, stock[k]));
  }
  return out;
}

/** How long the oil lasts while the Lighthouse is stoked during the Mist, in real seconds. Infinity if production is enough. */
export function oilAutonomy(s: EconomyState, oil: number): number {
  const r = netRates(s, { mist: true, stoked: true }).oil;
  return r >= 0 ? Infinity : (oil / -r) * 3600;
}
