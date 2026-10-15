/** Types communs aux règles du jeu. Aucune dépendance au réseau, au DOM ou au temps réel. */

export type Resource = "huile" | "poisson" | "bois" | "cord";
export type Cost = Partial<Record<Resource, number>>;
export type Stock = Record<Resource, number>;

export type BuildingId =
  | "phare"
  | "raffinerie"
  | "pecherie"
  | "chantier"
  | "abris"
  | "caserne"
  | "port"
  | "observatoire"
  | "infirmerie";

export type Buildings = Record<BuildingId, number>;

export type TroopType = "ab" | "ha" | "ar";
export type Troops = Record<TroopType, number>;

export type Rarity = "officier" | "commandant" | "amiral";

/** Résultat d'une vérification de règle : on refuse toujours avec une raison lisible. */
export type Check = { ok: true } | { ok: false; reason: string };

export const OK: Check = { ok: true };
export const refuse = (reason: string): Check => ({ ok: false, reason });

export const emptyTroops = (): Troops => ({ ab: 0, ha: 0, ar: 0 });
export const totalTroops = (t: Troops): number => t.ab + t.ha + t.ar;

/** Le coût est-il couvert par le stock ? */
export function canPay(stock: Partial<Stock>, cost: Cost): boolean {
  return (Object.entries(cost) as [Resource, number][]).every(([k, v]) => (stock[k] ?? 0) >= v);
}

/** Retire un coût du stock. Lève une erreur si le stock ne suffit pas : l'appelant doit vérifier avant. */
export function payCost(stock: Stock, cost: Cost): Stock {
  if (!canPay(stock, cost)) throw new Error("Ressources insuffisantes");
  const next = { ...stock };
  for (const [k, v] of Object.entries(cost) as [Resource, number][]) next[k] -= v;
  return next;
}

/** Arrondit chaque montant à la dizaine, comme le prototype. */
export function roundCost(cost: Cost): Cost {
  const out: Cost = {};
  for (const [k, v] of Object.entries(cost) as [Resource, number][]) out[k] = Math.round(v / 10) * 10;
  return out;
}
