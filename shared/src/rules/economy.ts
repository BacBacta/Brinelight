import type { Buildings, Resource, Stock } from "./types.js";
import { techLevel, type Techs } from "./research.js";
import { raftEffect, type Rafts } from "./rafts.js";
import { protoRatePerHour } from "./time.js";

/** Débits du prototype, par seconde prototype et par niveau. */
const PROTO = {
  raffinerie: 1.1,
  pecherie: 1.4,
  chantier: 1.4,
  phareBurn: 0.25,
  survivorEats: 0.06,
  serre: 0.45,
};
export const PUSH_MULTIPLIER = 2.2;
export const BRUME_PENALTY = 0.7;
export const HIGH_MORALE = 90;
export const HIGH_MORALE_BONUS = 1.1;

export function storeCap(phare: number, techs: Techs = {}): number {
  return Math.round((2500 * phare + 1500) * (1 + 0.15 * techLevel(techs, "stock")));
}

export const survivorCap = (abris: number): number => 6 + abris * 4;

export type EconomyState = {
  buildings: Buildings;
  techs: Techs;
  rafts: Rafts;
  survivors: number;
  morale: number;
};

export type Weather = { brume: boolean; pushed: boolean };

/** Débits nets PAR HEURE réelle (production moins consommation). */
export function netRates(s: EconomyState, w: Weather = { brume: false, pushed: false }): Record<Exclude<Resource, "cord">, number> {
  const mul = (s.morale >= HIGH_MORALE ? HIGH_MORALE_BONUS : 1) * (w.brume && !w.pushed ? BRUME_PENALTY : 1);
  const t = (id: "raff" | "filets" | "scie") => 1 + 0.1 * techLevel(s.techs, id);
  const fum = Math.max(0.5, 1 - 0.1 * raftEffect(s.rafts, "fumoir"));
  const huile = PROTO.raffinerie * s.buildings.raffinerie * mul * t("raff") - PROTO.phareBurn * s.buildings.phare * (w.pushed ? PUSH_MULTIPLIER : 1);
  const poisson = PROTO.pecherie * s.buildings.pecherie * mul * t("filets") + PROTO.serre * raftEffect(s.rafts, "serre") - s.survivors * PROTO.survivorEats * fum;
  const bois = PROTO.chantier * s.buildings.chantier * mul * t("scie");
  return { huile: protoRatePerHour(huile), poisson: protoRatePerHour(poisson), bois: protoRatePerHour(bois) };
}

/**
 * Fait avancer le stock de `seconds` secondes réelles à débits constants.
 * Une ressource ne descend jamais sous 0 et ne dépasse pas le stockage,
 * sauf si elle le dépassait déjà (butin, récompense) : dans ce cas elle n'augmente plus.
 * C'est la base du calcul « à la demande » côté serveur : pas de boucle qui tourne en continu.
 */
export function advanceStock(stock: Stock, rates: Record<Exclude<Resource, "cord">, number>, seconds: number, cap: number): Stock {
  const out = { ...stock };
  for (const k of ["huile", "poisson", "bois"] as const) {
    const next = stock[k] + (rates[k] * seconds) / 3600;
    out[k] = Math.min(Math.max(0, next), Math.max(cap, stock[k]));
  }
  return out;
}

/** Autonomie en huile pendant une Brume poussée, en secondes réelles. Infinity si la production suffit. */
export function oilAutonomy(s: EconomyState, oil: number): number {
  const r = netRates(s, { brume: true, pushed: true }).huile;
  return r >= 0 ? Infinity : (oil / -r) * 3600;
}
