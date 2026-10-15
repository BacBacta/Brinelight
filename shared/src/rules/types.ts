/** Types shared by the game rules. No dependency on the network, the DOM or real time. */

export type Resource = "oil" | "fish" | "wood" | "rope";
export type Cost = Partial<Record<Resource, number>>;
export type Stock = Record<Resource, number>;

export type BuildingId =
  | "lighthouse"
  | "refinery"
  | "fishery"
  | "lumberyard"
  | "shelters"
  | "barracks"
  | "harbor"
  | "observatory"
  | "infirmary";

export type Buildings = Record<BuildingId, number>;

export type TroopType = "boarders" | "harpooners" | "crossbowmen";
export type Troops = Record<TroopType, number>;

export type Rarity = "officer" | "commander" | "admiral";

/** Result of a rule check: a refusal always comes with a readable reason. */
export type Check = { ok: true } | { ok: false; reason: string };

export const OK: Check = { ok: true };
export const refuse = (reason: string): Check => ({ ok: false, reason });

export const emptyTroops = (): Troops => ({ boarders: 0, harpooners: 0, crossbowmen: 0 });
export const totalTroops = (t: Troops): number => t.boarders + t.harpooners + t.crossbowmen;

/** Does the stock cover the cost? */
export function canPay(stock: Partial<Stock>, cost: Cost): boolean {
  return (Object.entries(cost) as [Resource, number][]).every(([k, v]) => (stock[k] ?? 0) >= v);
}

/** Removes a cost from the stock. Throws if the stock is not enough: the caller must check first. */
export function payCost(stock: Stock, cost: Cost): Stock {
  if (!canPay(stock, cost)) throw new Error("Not enough resources");
  const next = { ...stock };
  for (const [k, v] of Object.entries(cost) as [Resource, number][]) next[k] -= v;
  return next;
}

/** Rounds each amount to the nearest ten, like the prototype. */
export function roundCost(cost: Cost): Cost {
  const out: Cost = {};
  for (const [k, v] of Object.entries(cost) as [Resource, number][]) out[k] = Math.round(v / 10) * 10;
  return out;
}
