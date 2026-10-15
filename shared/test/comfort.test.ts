import { describe, expect, it } from "vitest";
import { COMFORT_CAP, canBuyComfort, maxPaidAdvance } from "../src/index.js";

const adult = { minor: false, payWithUsdc: true };
const pack = { priceUsdc: 1.99, hours: 1 };

describe("convenience cap", () => {
  it("public values: 100 USDC per month, 30 for a minor, 4 h per day", () => {
    expect(COMFORT_CAP).toEqual({ monthUsdc: 100, monthUsdcMinor: 30, dayHours: 4 });
  });

  it("accepts a purchase under the caps", () => {
    expect(canBuyComfort({ monthUsdc: 0, dayHours: 0 }, pack, adult)).toEqual({ ok: true });
  });

  it("refuses the 5th hour of the day", () => {
    expect(canBuyComfort({ monthUsdc: 8, dayHours: 4 }, pack, adult).ok).toBe(false);
  });

  it("refuses beyond 100 USDC in the month", () => {
    expect(canBuyComfort({ monthUsdc: 99, dayHours: 0 }, pack, adult).ok).toBe(false);
  });

  it("accepts exactly 100 USDC", () => {
    expect(canBuyComfort({ monthUsdc: 98.01, dayHours: 0 }, pack, adult).ok).toBe(true);
  });

  it("a minor never pays in USDC", () => {
    expect(canBuyComfort({ monthUsdc: 0, dayHours: 0 }, pack, { minor: true, payWithUsdc: true })).toEqual({ ok: false, reason: "USDC payment is for adults only" });
  });

  it("a minor is capped at 30 per month", () => {
    expect(canBuyComfort({ monthUsdc: 29, dayHours: 0 }, pack, { minor: true, payWithUsdc: false }).ok).toBe(false);
  });

  it("a payer's maximum lead is about 15%", () => {
    expect(maxPaidAdvance(1)).toBeCloseTo(4 / 26, 9);
    expect(maxPaidAdvance(1)).toBeLessThan(0.16);
  });
});
