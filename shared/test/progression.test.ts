import { describe, expect, it } from "vitest";
import {
  CAPTAIN_MAX_LEVEL, RECRUIT_ODDS, addXp, attackBonus, rarityFromRoll, skillFactor, xpNeeded,
  TECHS, canResearch, observatoryRequired, techCost,
  RAFT_SLOTS, applyBrumeDamage, canAddRaft, raftCap, raftCost, raftEffect, repairCost, slotOpen,
  STARTING_BUILDINGS, power,
} from "../src/index.js";

const rich = { huile: 99_999, poisson: 99_999, bois: 99_999, cord: 99 };

describe("capitaines", () => {
  it("les probabilités publiées font 100 %", () => {
    expect(Object.values(RECRUIT_ODDS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("tirage : 0-4 amiral, 5-29 commandant, 30-99 officier", () => {
    expect(rarityFromRoll(4)).toBe("amiral");
    expect(rarityFromRoll(5)).toBe("commandant");
    expect(rarityFromRoll(29)).toBe("commandant");
    expect(rarityFromRoll(30)).toBe("officier");
    expect(() => rarityFromRoll(100)).toThrow();
  });

  it("l'expérience fait monter de plusieurs niveaux d'un coup si besoin", () => {
    // niveau 1 → 2 coûte 80, 2 → 3 coûte 160
    expect(addXp({ level: 1, xp: 0 }, 250)).toEqual({ level: 3, xp: 10, levelsGained: 2 });
  });

  it("le niveau est plafonné à 20", () => {
    expect(addXp({ level: 19, xp: 0 }, 1_000_000).level).toBe(CAPTAIN_MAX_LEVEL);
    expect(xpNeeded(5)).toBe(400);
  });

  it("chaque niveau renforce la compétence de 4 %", () => {
    expect(skillFactor(6)).toBeCloseTo(1.2, 9);
    expect(attackBonus("commandant", 6)).toBeCloseTo(1 + 0.15 * 1.2, 9);
  });
});

describe("recherche", () => {
  it("10 recherches, dont une seule à un niveau", () => {
    expect(Object.keys(TECHS)).toHaveLength(10);
    expect(TECHS.veteran.max).toBe(1);
  });

  it("le niveau d'Observatoire requis monte avec la recherche", () => {
    expect(observatoryRequired("raff", 0)).toBe(1);
    expect(observatoryRequired("raff", 2)).toBe(3);
    expect(observatoryRequired("veteran", 0)).toBe(3);
  });

  it("le coût du premier niveau de Raffinage vaut 180 bois et 110 huile", () => {
    expect(techCost("raff", 0)).toEqual({ bois: 180, huile: 110 });
  });

  it("refuse une recherche quand une autre est en cours", () => {
    expect(canResearch("raff", { techs: {}, observatory: 3, busy: true, stock: rich }).ok).toBe(false);
  });

  it("refuse sans Observatoire assez haut", () => {
    expect(canResearch("veteran", { techs: {}, observatory: 2, busy: false, stock: rich })).toEqual({ ok: false, reason: "Observatoire niveau 3 requis" });
  });

  it("refuse au-delà du niveau maximal", () => {
    expect(canResearch("veteran", { techs: { veteran: 1 }, observatory: 9, busy: false, stock: rich }).ok).toBe(false);
  });
});

describe("radeaux", () => {
  it("39 emplacements : 17 en première couronne, 22 en seconde", () => {
    expect(RAFT_SLOTS).toHaveLength(39);
    expect(RAFT_SLOTS.filter((s) => s.ring === 3)).toHaveLength(17);
  });

  it("les radeaux s'ouvrent au Phare niveau 4", () => {
    expect(raftCap(3)).toBe(0);
    expect(raftCap(4)).toBe(6);
    expect(raftCap(7)).toBe(17);
    expect(raftCap(30)).toBe(39);
  });

  it("la seconde couronne s'ouvre au Phare niveau 8", () => {
    expect(slotOpen(4, 7)).toBe(false);
    expect(slotOpen(4, 8)).toBe(true);
  });

  it("le coût du radeau monte avec le nombre amarré", () => {
    expect(raftCost(0)).toEqual({ bois: 350, cord: 1 });
    expect(raftCost(3)).toEqual({ bois: 580, cord: 2 });
  });

  it("refuse un radeau quand le Phare est trop bas", () => {
    const r = canAddRaft({ rafts: {}, phare: 3, slot: "-3,0", stock: rich, yardBusy: false });
    expect(r).toEqual({ ok: false, reason: "Améliore le Phare pour amarrer plus de radeaux" });
  });

  it("refuse un emplacement déjà occupé ou inconnu", () => {
    const rafts = { "-3,0": { hp: 100, building: null, level: 0 } };
    expect(canAddRaft({ rafts, phare: 4, slot: "-3,0", stock: rich, yardBusy: false }).ok).toBe(false);
    expect(canAddRaft({ rafts, phare: 4, slot: "9,9", stock: rich, yardBusy: false }).ok).toBe(false);
  });

  it("un radeau abîmé ne compte qu'à moitié", () => {
    const rafts = { a: { hp: 40, building: "serre" as const, level: 2 } };
    expect(raftEffect(rafts, "serre")).toBe(1);
  });

  it("la Brume abîme les radeaux seulement si le Phare n'a pas tenu", () => {
    const rafts = { a: { hp: 100, building: null, level: 0 } };
    expect(applyBrumeDamage(rafts, true).a?.hp).toBe(100);
    expect(applyBrumeDamage(rafts, false).a?.hp).toBe(65);
    expect(repairCost({ hp: 65, building: null, level: 0 })).toEqual({ bois: 105 });
  });
});

describe("puissance", () => {
  it("une cité de départ a une puissance stable", () => {
    const p = power({ buildings: STARTING_BUILDINGS, troops: { ab: 25, ha: 25, ar: 25 }, veterans: { ab: 0, ha: 0, ar: 0 }, captains: [{ rarity: "officier", stars: 1, level: 1 }], techs: {}, rafts: {} });
    expect(p).toBe(2218);
  });
});
