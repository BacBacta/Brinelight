import { describe, expect, it } from "vitest";
import { BUILDERS, BUILDING_IDS, STARTING_BUILDINGS, canUpgrade, maxLevel, upgradeCost, upgradeTime, PHARE_MAX, TIME_SCALE } from "../src/index.js";

const stock = { huile: 10_000, poisson: 10_000, bois: 10_000, cord: 0 };

describe("bâtiments", () => {
  it("connaît les 9 bâtiments", () => {
    expect(BUILDING_IDS).toHaveLength(9);
  });

  it("le coût de la Raffinerie au niveau 1 correspond au prototype", () => {
    // 90 × 1,6 = 144 → 140 ; 40 × 1,6 = 64 → 60
    expect(upgradeCost("raffinerie", 1)).toEqual({ bois: 140, poisson: 60 });
  });

  it("le coût du Phare au niveau 2 correspond au prototype", () => {
    // 180 × 1,62² = 472,4 → 470 ; 120 × 1,62² = 314,9 → 310
    expect(upgradeCost("phare", 2)).toEqual({ bois: 470, huile: 310 });
  });

  it("les coûts sont arrondis à la dizaine", () => {
    for (const id of BUILDING_IDS) {
      for (let l = 0; l < 12; l++) {
        for (const v of Object.values(upgradeCost(id, l))) expect(v % 10).toBe(0);
      }
    }
  });

  it("les coûts augmentent à chaque niveau", () => {
    for (const id of BUILDING_IDS) {
      const a = Object.values(upgradeCost(id, 3)).reduce((x, y) => x + y, 0);
      const b = Object.values(upgradeCost(id, 4)).reduce((x, y) => x + y, 0);
      expect(b).toBeGreaterThan(a);
    }
  });

  it("une durée prototype de 6 s vaut 36 minutes réelles", () => {
    expect(upgradeTime("raffinerie", 0)).toBe(6 * TIME_SCALE);
    expect(upgradeTime("raffinerie", 0)).toBe(2160);
  });

  it("le Phare plafonne les autres bâtiments", () => {
    expect(maxLevel("raffinerie", { ...STARTING_BUILDINGS, phare: 4 })).toBe(4);
    expect(maxLevel("phare", STARTING_BUILDINGS)).toBe(PHARE_MAX);
  });

  it("accepte une amélioration valide", () => {
    expect(canUpgrade("raffinerie", { buildings: STARTING_BUILDINGS, stock, queue: [] })).toEqual({ ok: true });
  });

  it("refuse si le Phare est trop bas", () => {
    const b = { ...STARTING_BUILDINGS, raffinerie: 2 };
    expect(canUpgrade("raffinerie", { buildings: b, stock, queue: [] })).toEqual({ ok: false, reason: "Améliore d'abord le Phare" });
  });

  it("refuse si les ouvriers sont occupés", () => {
    const r = canUpgrade("chantier", { buildings: STARTING_BUILDINGS, stock, queue: ["raffinerie", "pecherie"] });
    expect(r.ok).toBe(false);
    expect(BUILDERS).toBe(2);
  });

  it("refuse un bâtiment déjà en chantier", () => {
    const r = canUpgrade("raffinerie", { buildings: STARTING_BUILDINGS, stock, queue: ["raffinerie"] });
    expect(r).toEqual({ ok: false, reason: "Ce bâtiment est déjà en chantier" });
  });

  it("refuse sans ressources suffisantes", () => {
    const r = canUpgrade("phare", { buildings: STARTING_BUILDINGS, stock: { huile: 0, poisson: 0, bois: 0, cord: 0 }, queue: [] });
    expect(r).toEqual({ ok: false, reason: "Ressources insuffisantes" });
  });
});
