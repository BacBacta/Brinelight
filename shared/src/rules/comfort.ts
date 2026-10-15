import { OK, refuse, type Check } from "./types.js";

/**
 * Plafond du confort payant. Ces valeurs sont publiques et inscrites au Registre de l'équité.
 * Le plafond est compté PAR COMPTE DE JEU, jamais par wallet.
 */
export const COMFORT_CAP = {
  /** USDC par mois et par compte. */
  monthUsdc: 100,
  /** USDC par mois pour un compte mineur (achats intégrés des stores uniquement). */
  monthUsdcMinor: 30,
  /** Heures de confort par jour. */
  dayHours: 4,
};

export type ComfortSpend = { monthUsdc: number; dayHours: number };

export function canBuyComfort(
  spend: ComfortSpend,
  item: { priceUsdc: number; hours: number },
  account: { minor: boolean; payWithUsdc: boolean },
): Check {
  if (account.minor && account.payWithUsdc) return refuse("Le paiement en USDC est réservé aux majeurs");
  const monthCap = account.minor ? COMFORT_CAP.monthUsdcMinor : COMFORT_CAP.monthUsdc;
  if (spend.monthUsdc + item.priceUsdc > monthCap + 1e-9) return refuse(`Plafond mensuel de ${monthCap} USDC atteint`);
  if (spend.dayHours + item.hours > COMFORT_CAP.dayHours) return refuse(`Plafond de ${COMFORT_CAP.dayHours} h de confort par jour atteint`);
  return OK;
}

/** Avance maximale qu'un payeur peut acheter, en production par jour, pour un joueur actif `activeHours` h/j. */
export function maxPaidAdvance(activeHours = 1): number {
  const free = 24 + activeHours * 2;
  return (free + COMFORT_CAP.dayHours) / free - 1;
}
