import { describe, expect, it } from "vitest";
import { BEATS, effective, odds, pirateCamp, pirateLoot, resolveCombat, strengths } from "../src/index.js";

const army = { ab: 25, ha: 25, ar: 25 };

describe("combat", () => {
  it("camp de pirates niveau 1 : 15 / 44 / 15, comme le prototype", () => {
    expect(pirateCamp(1)).toEqual({ ab: 15, ha: 44, ar: 15 });
  });

  it("le triangle est complet et sans boucle courte", () => {
    expect(BEATS).toEqual({ ab: "ha", ha: "ar", ar: "ab" });
  });

  it("scénario connu du prototype : 90 contre 89, victoire, 12 pertes par type", () => {
    const r = resolveCombat({ troops: army, enemy: pirateCamp(1), captain: { cls: "col", rarity: "officier", level: 1 } });
    expect(r.attack).toBeCloseTo(90, 6);
    expect(Math.round(r.defense)).toBe(89);
    expect(r.win).toBe(true);
    expect(r.losses).toEqual({ ab: 12, ha: 12, ar: 12 });
    expect(r.survivors).toEqual({ ab: 13, ha: 13, ar: 13 });
  });

  it("le combat est déterministe", () => {
    const input = { troops: army, enemy: pirateCamp(3) };
    expect(resolveCombat(input)).toEqual(resolveCombat(input));
  });

  it("une défaite coûte 70 % des troupes", () => {
    const r = resolveCombat({ troops: army, enemy: pirateCamp(6) });
    expect(r.win).toBe(false);
    expect(r.lossRate).toBeCloseTo(0.7, 9);
    expect(r.losses.ab).toBe(18);
  });

  it("une victoire écrasante coûte au moins 5 %", () => {
    const r = resolveCombat({ troops: { ab: 500, ha: 500, ar: 500 }, enemy: pirateCamp(1) });
    expect(r.lossRate).toBeCloseTo(0.05, 9);
  });

  it("un vétéran compte pour 1,8 soldat", () => {
    expect(effective({ ab: 10, ha: 0, ar: 0 }, { ab: 10, ha: 0, ar: 0 }).ab).toBeCloseTo(28, 9);
  });

  it("un capitaine amiral de sa classe donne +25 % au niveau 1", () => {
    const solo = { ab: 0, ha: 0, ar: 50 };
    const sans = strengths({ troops: solo, enemy: { ab: 1, ha: 0, ar: 0 } }).attack;
    const avec = strengths({ troops: solo, enemy: { ab: 1, ha: 0, ar: 0 }, captain: { cls: "ar", rarity: "amiral", level: 1 } }).attack;
    expect(avec / sans).toBeCloseTo(1.25, 9);
  });

  it("la recherche Lames trempées ajoute 6 % d'attaque par niveau", () => {
    const a = strengths({ troops: army, enemy: pirateCamp(1) }).attack;
    const b = strengths({ troops: army, enemy: pirateCamp(1), techs: { lames: 2 } }).attack;
    expect(b / a).toBeCloseTo(1.12, 9);
  });

  it("la recherche Coques doublées réduit les pertes de 8 % par niveau", () => {
    const r = resolveCombat({ troops: army, enemy: pirateCamp(6), techs: { coques: 1 } });
    expect(r.lossRate).toBeCloseTo(0.7 * 0.92, 9);
  });

  it("sans infirmerie, aucun blessé n'est sauvé", () => {
    const r = resolveCombat({ troops: army, enemy: pirateCamp(6) });
    expect(r.wounded).toEqual({ ab: 0, ha: 0, ar: 0 });
  });

  it("l'infirmerie sauve la moitié des pertes, dans la limite des places", () => {
    const r = resolveCombat({ troops: army, enemy: pirateCamp(6), hospital: { capacity: 60, occupied: 0 } });
    expect(r.wounded).toEqual({ ab: 9, ha: 9, ar: 9 });
    const full = resolveCombat({ troops: army, enemy: pirateCamp(6), hospital: { capacity: 60, occupied: 50 } });
    expect(full.wounded.ab + full.wounded.ha + full.wounded.ar).toBe(10);
  });

  it("les chances affichées suivent le rapport des forces", () => {
    expect(odds({ troops: { ab: 300, ha: 300, ar: 300 }, enemy: pirateCamp(1) })).toBe("easy");
    expect(odds({ troops: army, enemy: pirateCamp(1) })).toBe("close");
    expect(odds({ troops: army, enemy: pirateCamp(6) })).toBe("hard");
  });

  it("le butin grandit avec le niveau du camp", () => {
    expect(pirateLoot(3)).toEqual({ huile: 210, bois: 210, perles: 28, cord: 1, fragments: 3 });
  });
});
