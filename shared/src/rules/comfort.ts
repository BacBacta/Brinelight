import { OK, refuse, type Check } from "./types.js";

/**
 * Cap on paid convenience. These values are public and recorded in the Fairness Ledger.
 * The cap is counted PER GAME ACCOUNT, never per wallet.
 */
export const COMFORT_CAP = {
  /** USDC per month per account. */
  monthUsdc: 100,
  /** USDC per month for a minor's account (in-app store purchases only). */
  monthUsdcMinor: 30,
  /** Hours of convenience per day. */
  dayHours: 4,
};

export type ComfortSpend = { monthUsdc: number; dayHours: number };

export function canBuyComfort(
  spend: ComfortSpend,
  item: { priceUsdc: number; hours: number },
  account: { minor: boolean; payWithUsdc: boolean },
): Check {
  if (account.minor && account.payWithUsdc) return refuse("USDC payment is for adults only");
  const monthCap = account.minor ? COMFORT_CAP.monthUsdcMinor : COMFORT_CAP.monthUsdc;
  if (spend.monthUsdc + item.priceUsdc > monthCap + 1e-9) return refuse(`You reached the monthly cap of ${monthCap} USDC`);
  if (spend.dayHours + item.hours > COMFORT_CAP.dayHours) return refuse(`You reached the daily cap of ${COMFORT_CAP.dayHours} h of convenience`);
  return OK;
}

/** Maximum lead a payer can buy, in production per day, for a player active `activeHours` h/day. */
export function maxPaidAdvance(activeHours = 1): number {
  const free = 24 + activeHours * 2;
  return (free + COMFORT_CAP.dayHours) / free - 1;
}
