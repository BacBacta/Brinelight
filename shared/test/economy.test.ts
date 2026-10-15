import { describe, expect, it } from "vitest";
import { STARTING_BUILDINGS, advanceStock, netRates, oilAutonomy, storeCap, survivorCap, protoRatePerHour, type EconomyState } from "../src/index.js";

const base: EconomyState = { buildings: STARTING_BUILDINGS, techs: {}, rafts: {}, survivors: 8, morale: 84 };

describe("économie", () => {
  it("1 unité par seconde prototype vaut 10 unités par heure réelle", () => {
    expect(protoRatePerHour(1)).toBe(10);
  });

  it("stockage : 2 500 par niveau de Phare + 1 500", () => {
    expect(storeCap(2)).toBe(6500);
    expect(storeCap(10)).toBe(26500);
  });

  it("la recherche Entrepôts augmente le stockage de 15 % par niveau", () => {
    expect(storeCap(2, { stock: 2 })).toBe(Math.round(6500 * 1.3));
  });

  it("logement : 6 survivants + 4 par niveau d'Abris", () => {
    expect(survivorCap(1)).toBe(10);
  });

  it("débits de départ cohérents avec le prototype", () => {
    const r = netRates(base);
    // huile : 1,1 − 0,25 × 2 = 0,6 /s proto → 6 /h
    expect(r.huile).toBeCloseTo(6, 6);
    // poisson : 1,4 − 8 × 0,06 = 0,92 → 9,2 /h
    expect(r.poisson).toBeCloseTo(9.2, 6);
    expect(r.bois).toBeCloseTo(14, 6);
  });

  it("un moral à 90 % ou plus donne +10 % de production", () => {
    const r = netRates({ ...base, morale: 95 });
    expect(r.bois).toBeCloseTo(15.4, 6);
  });

  it("la Brume non repoussée réduit la production de 30 %", () => {
    const r = netRates(base, { brume: true, pushed: false });
    expect(r.bois).toBeCloseTo(14 * 0.7, 6);
  });

  it("pousser le Phare multiplie sa consommation par 2,2", () => {
    const r = netRates(base, { brume: true, pushed: true });
    // 1,1 − 0,25 × 2 × 2,2 = 0 → 0 /h
    expect(r.huile).toBeCloseTo(0, 6);
  });

  it("une Serre à algues niveau 2 ajoute 9 poissons par heure", () => {
    const r = netRates({ ...base, rafts: { "-3,0": { hp: 100, building: "serre", level: 2 } } });
    expect(r.poisson - netRates(base).poisson).toBeCloseTo(9, 6);
  });

  it("le Fumoir réduit ce que mangent les survivants, sans descendre sous la moitié", () => {
    const many = { ...base, rafts: { a: { hp: 100, building: "fumoir" as const, level: 3 }, b: { hp: 100, building: "fumoir" as const, level: 3 } } };
    const eaten = netRates(base).poisson - netRates({ ...many, survivors: 0 }).poisson;
    const eatenWithFumoir = netRates(many).poisson - netRates({ ...many, survivors: 0 }).poisson;
    expect(eatenWithFumoir).toBeCloseTo(eaten * 0.5, 6);
  });

  it("le stock avance à débit constant et s'arrête au stockage", () => {
    const s = advanceStock({ huile: 0, poisson: 6000, bois: 100, cord: 0 }, { huile: 6, poisson: 1000, bois: -1000 }, 3600, 6500);
    expect(s.huile).toBe(6);
    expect(s.poisson).toBe(6500);
    expect(s.bois).toBe(0);
  });

  it("un stock déjà au-dessus du plafond ne baisse pas à cause du plafond", () => {
    const s = advanceStock({ huile: 9000, poisson: 0, bois: 0, cord: 0 }, { huile: 10, poisson: 0, bois: 0 }, 3600, 6500);
    expect(s.huile).toBe(9000);
  });

  it("l'autonomie en huile est infinie quand la production couvre le Phare poussé", () => {
    expect(oilAutonomy(base, 100)).toBe(Infinity);
  });

  it("l'autonomie en huile se calcule quand le Phare consomme plus qu'il ne reçoit", () => {
    const s = { ...base, buildings: { ...STARTING_BUILDINGS, phare: 6 } };
    // 1,1 − 0,25 × 6 × 2,2 = −2,2 /s proto → −22 /h ; 220 huile = 10 h
    expect(oilAutonomy(s, 220)).toBeCloseTo(10 * 3600, 3);
  });
});
