import { describe, expect, it } from "vitest";
import { COMFORT_CAP, canBuyComfort, maxPaidAdvance } from "../src/index.js";

const adult = { minor: false, payWithUsdc: true };
const pack = { priceUsdc: 1.99, hours: 1 };

describe("plafond du confort", () => {
  it("valeurs publiques : 100 USDC par mois, 30 pour un mineur, 4 h par jour", () => {
    expect(COMFORT_CAP).toEqual({ monthUsdc: 100, monthUsdcMinor: 30, dayHours: 4 });
  });

  it("accepte un achat sous les plafonds", () => {
    expect(canBuyComfort({ monthUsdc: 0, dayHours: 0 }, pack, adult)).toEqual({ ok: true });
  });

  it("refuse la 5e heure du jour", () => {
    expect(canBuyComfort({ monthUsdc: 8, dayHours: 4 }, pack, adult).ok).toBe(false);
  });

  it("refuse au-delà de 100 USDC dans le mois", () => {
    expect(canBuyComfort({ monthUsdc: 99, dayHours: 0 }, pack, adult).ok).toBe(false);
  });

  it("accepte exactement 100 USDC", () => {
    expect(canBuyComfort({ monthUsdc: 98.01, dayHours: 0 }, pack, adult).ok).toBe(true);
  });

  it("un mineur ne paie jamais en USDC", () => {
    expect(canBuyComfort({ monthUsdc: 0, dayHours: 0 }, pack, { minor: true, payWithUsdc: true })).toEqual({ ok: false, reason: "Le paiement en USDC est réservé aux majeurs" });
  });

  it("un mineur est plafonné à 30 par mois", () => {
    expect(canBuyComfort({ monthUsdc: 29, dayHours: 0 }, pack, { minor: true, payWithUsdc: false }).ok).toBe(false);
  });

  it("l'avance maximale d'un payeur est d'environ 15 %", () => {
    expect(maxPaidAdvance(1)).toBeCloseTo(4 / 26, 9);
    expect(maxPaidAdvance(1)).toBeLessThan(0.16);
  });
});
