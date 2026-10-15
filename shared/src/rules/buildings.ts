import { OK, canPay, refuse, roundCost, type BuildingId, type Buildings, type Check, type Cost, type Stock } from "./types.js";
import { protoSeconds } from "./time.js";

/** Maximum Lighthouse level in the full game (the prototype stopped at 10). */
export const LIGHTHOUSE_MAX = 30;
/** Number of builders: simultaneous upgrades. */
export const BUILDERS = 2;

type BuildingDef = {
  name: string;
  description: string;
  /** Base cost, multiplied by growth^level. */
  base: Cost;
  growth: number;
  /** Base duration in prototype seconds, multiplied by timeGrowth^level. */
  baseTime: number;
  timeGrowth: number;
};

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  lighthouse: { name: "Lighthouse", description: "Pushes back the Mist and sets the maximum level of every other building.", base: { wood: 180, oil: 120 }, growth: 1.62, baseTime: 9, timeGrowth: 1.55 },
  refinery: { name: "Refinery", description: "Makes the oil that keeps the Lighthouse burning.", base: { wood: 90, fish: 40 }, growth: 1.6, baseTime: 6, timeGrowth: 1.5 },
  fishery: { name: "Fishery", description: "Feeds your survivors and crews.", base: { wood: 80, oil: 30 }, growth: 1.6, baseTime: 6, timeGrowth: 1.5 },
  lumberyard: { name: "Lumberyard", description: "Salvages and cuts driftwood.", base: { fish: 70, oil: 30 }, growth: 1.6, baseTime: 6, timeGrowth: 1.5 },
  shelters: { name: "Shelters", description: "House your survivors: more shelters, more hands.", base: { wood: 110, fish: 60 }, growth: 1.6, baseTime: 7, timeGrowth: 1.5 },
  barracks: { name: "Barracks", description: "Trains boarders, harpooners and crossbowmen.", base: { wood: 140, oil: 60, fish: 60 }, growth: 1.6, baseTime: 8, timeGrowth: 1.5 },
  harbor: { name: "Harbor", description: "Each tier adds a fleet at sea and more hold capacity.", base: { wood: 150, oil: 80 }, growth: 1.6, baseTime: 8, timeGrowth: 1.5 },
  observatory: { name: "Observatory", description: "Unlocks research.", base: { wood: 160, oil: 90 }, growth: 1.6, baseTime: 8, timeGrowth: 1.5 },
  infirmary: { name: "Infirmary", description: "Heals the wounded when they return from battle.", base: { wood: 120, fish: 90 }, growth: 1.6, baseTime: 7, timeGrowth: 1.5 },
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

export const STARTING_BUILDINGS: Buildings = {
  lighthouse: 2, refinery: 1, fishery: 1, lumberyard: 1, shelters: 1, barracks: 0, harbor: 0, observatory: 0, infirmary: 0,
};

/** Cost to go from level `level` to level `level + 1`, rounded to the nearest ten. */
export function upgradeCost(id: BuildingId, level: number): Cost {
  const d = BUILDINGS[id];
  const raw: Cost = {};
  for (const [k, v] of Object.entries(d.base) as [keyof Cost, number][]) raw[k] = v * d.growth ** level;
  return roundCost(raw);
}

/** Real duration (seconds) to go from level `level` to level `level + 1`. */
export function upgradeTime(id: BuildingId, level: number): number {
  const d = BUILDINGS[id];
  return Math.round(protoSeconds(d.baseTime * d.timeGrowth ** level));
}

/** Highest reachable level: the Lighthouse caps every other building. */
export function maxLevel(id: BuildingId, buildings: Buildings): number {
  return id === "lighthouse" ? LIGHTHOUSE_MAX : buildings.lighthouse;
}

export type UpgradeContext = {
  buildings: Buildings;
  stock: Stock;
  /** Buildings already being upgraded. */
  queue: BuildingId[];
};

/** The server calls this rule before accepting any upgrade. */
export function canUpgrade(id: BuildingId, ctx: UpgradeContext): Check {
  const level = ctx.buildings[id];
  if (level >= maxLevel(id, ctx.buildings)) {
    return refuse(id === "lighthouse" ? "The Lighthouse is at max level" : "Upgrade the Lighthouse first");
  }
  if (ctx.queue.includes(id)) return refuse("This building is already being upgraded");
  if (ctx.queue.length >= BUILDERS) return refuse(`Your ${BUILDERS} builders are busy`);
  if (!canPay(ctx.stock, upgradeCost(id, level))) return refuse("Not enough resources");
  return OK;
}
