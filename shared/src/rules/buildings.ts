import { OK, canPay, payCost, refuse, roundCost, type BuildingId, type Buildings, type Check, type Cost, type Stock } from "./types.js";

/** Maximum Lighthouse level in the full game (the prototype stopped at 10). */
export const LIGHTHOUSE_MAX = 30;
/** Number of builders: simultaneous upgrades. */
export const BUILDERS = 2;

/** The buildings that share their build times from level 6 on. */
export type TimeGroup = "lighthouse" | "producers" | "shelters" | "large";

type BuildingDef = {
  name: string;
  description: string;
  /** Base cost, multiplied by growth^level (and see `after`). */
  base: Cost;
  growth: number;
  /** From this level on, a gentler growth: each level costs `growth` times the one before. */
  after?: { level: number; growth: number };
  /** Its build times from level 6 on (`BUILD_MINUTES`). */
  times: TimeGroup;
};

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  lighthouse: { name: "Lighthouse", description: "Pushes back the Mist and sets the maximum level of every other building.", base: { wood: 180, oil: 120 }, growth: 1.4, after: { level: 15, growth: 1.3 }, times: "lighthouse" },
  refinery: { name: "Refinery", description: "Makes the oil that keeps the Lighthouse burning.", base: { wood: 90, fish: 40 }, growth: 1.6, times: "producers" },
  fishery: { name: "Fishery", description: "Feeds your survivors and crews.", base: { wood: 80, oil: 30 }, growth: 1.6, times: "producers" },
  lumberyard: { name: "Lumberyard", description: "Salvages and cuts driftwood.", base: { fish: 70, oil: 30 }, growth: 1.6, times: "producers" },
  shelters: { name: "Shelters", description: "House your survivors: more shelters, more hands.", base: { wood: 110, fish: 60 }, growth: 1.6, times: "shelters" },
  barracks: { name: "Barracks", description: "Trains boarders, harpooners and crossbowmen.", base: { wood: 140, oil: 60, fish: 60 }, growth: 1.6, times: "large" },
  harbor: { name: "Harbor", description: "Each tier adds a fleet at sea and more hold capacity.", base: { wood: 150, oil: 80 }, growth: 1.6, times: "large" },
  observatory: { name: "Observatory", description: "Unlocks research.", base: { wood: 160, oil: 90 }, growth: 1.6, times: "large" },
  infirmary: { name: "Infirmary", description: "Heals the wounded when they return from battle.", base: { wood: 120, fish: 90 }, growth: 1.6, times: "shelters" },
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

export const STARTING_BUILDINGS: Buildings = {
  lighthouse: 2, refinery: 1, fishery: 1, lumberyard: 1, shelters: 1, barracks: 0, harbor: 0, observatory: 0, infirmary: 0,
};

/** growth^level up to `after.level`, then `after.growth` a level past it (the Lighthouse's costs past level 15). */
const grown = (growth: number, level: number, after?: { level: number; growth: number }) =>
  after && level > after.level ? growth ** after.level * after.growth ** (level - after.level) : growth ** level;

/** The cost of a level by its growth alone, rounded to the nearest ten: every level of the Lighthouse, the others' to 15. */
function grownCost(id: BuildingId, level: number): Cost {
  const d = BUILDINGS[id];
  const f = grown(d.growth, level, d.after);
  const raw: Cost = {};
  for (const [k, v] of Object.entries(d.base) as [keyof Cost, number][]) raw[k] = v * f;
  return roundCost(raw);
}

/**
 * The other buildings' costs past level 15 (owner's decision, 24 October: `docs/studies/costs.md`). From the level 16
 * (`from`: the cost to go from 15 to 16), each level costs `growth` times the one before (×1.6 until then); then
 * `woodShare` of its wood is asked in the building's oil and fish instead, at their worth in wood, shared equally
 * between them. The Lighthouse keeps its own costs.
 */
export const COST_PAST_15 = { from: 15, growth: 1.12, woodShare: 1 / 3 } as const;

/** What a unit of oil and of fish is worth in wood: what a producer's level adds an hour (42 wood, 11 oil, 14 fish). */
export const WOOD_WORTH: Readonly<Record<"oil" | "fish", number>> = { oil: 42 / 11, fish: 42 / 14 };

/** Cost to go from level `level` to level `level + 1`, rounded to the nearest ten. */
export function upgradeCost(id: BuildingId, level: number): Cost {
  if (id === "lighthouse" || level < COST_PAST_15.from) return grownCost(id, level);
  // ×1.12 a level from the level 15's cost, rounded to ten.
  const at15 = grownCost(id, COST_PAST_15.from - 1);
  const times = COST_PAST_15.growth ** (level - COST_PAST_15.from + 1);
  const grownPast = roundCost(Object.fromEntries(Object.entries(at15).map(([k, v]) => [k, v * times])) as Cost);
  // A third of the wood in the building's oil and fish, at their worth in wood (the Lumberyard costs no wood).
  const others = (["oil", "fish"] as const).filter((k) => (grownPast[k] ?? 0) > 0);
  if (!grownPast.wood || !others.length) return grownPast;
  const moved = grownPast.wood * COST_PAST_15.woodShare;
  const out: Cost = { ...grownPast, wood: grownPast.wood - moved };
  for (const k of others) out[k] = (grownPast[k] ?? 0) + moved / others.length / WOOD_WORTH[k];
  return roundCost(out);
}

/**
 * The quick first levels (owner's decision, 23 October; `docs/tasks/early-start.md`): an upgrade to these levels, of
 * any building of the island, takes at most this long, in real seconds, by the level it reaches. From level 6, the
 * growth's own time. The same for every city; never a reward, never for sale.
 */
export const QUICK_LEVELS: Readonly<Record<number, number>> = { 1: 60, 2: 60, 3: 2 * 60, 4: 5 * 60, 5: 15 * 60 };

/**
 * The build times of levels 6 to 30 (owner's decision, 24 October: the slower curve of `docs/studies/durations.md`),
 * in minutes, by the level reached: index 0 is level 6. Each level takes a little more than the one before, less and
 * less (×2.9 at 5 → 6, ×1.14 at 29 → 30): no cliff. The Lighthouse is the longest of its level, then the Barracks,
 * Harbor and Observatory, then the Shelters and Infirmary, then the producers. Never a reward, never for sale.
 */
export const BUILD_MINUTES: Readonly<Record<TimeGroup, readonly number[]>> = {
  lighthouse: [44, 72, 106, 148, 200, 263, 339, 431, 539, 668, 819, 997, 1205, 1446, 1726, 2050, 2422, 2849, 3339, 3898, 4535, 5260, 6082, 7012, 8064],
  producers: [40, 64, 92, 125, 165, 213, 269, 335, 413, 503, 608, 729, 868, 1028, 1211, 1419, 1656, 1925, 2229, 2572, 2959, 3394, 3882, 4429, 5040],
  shelters: [41, 66, 96, 132, 176, 228, 290, 364, 450, 552, 670, 808, 967, 1150, 1360, 1601, 1876, 2189, 2545, 2948, 3404, 3918, 4498, 5149, 5880],
  large: [42, 69, 100, 139, 186, 242, 310, 391, 486, 598, 730, 883, 1061, 1267, 1504, 1777, 2090, 2447, 2854, 3318, 3843, 4438, 5110, 5867, 6720],
};

/** Real duration (seconds) to go from level `level` to level `level + 1`: the quick levels to 5, then `BUILD_MINUTES`. */
export function upgradeTime(id: BuildingId, level: number): number {
  const quick = QUICK_LEVELS[level + 1];
  if (quick !== undefined) return quick;
  const minutes = BUILD_MINUTES[BUILDINGS[id].times];
  return minutes[Math.min(Math.max(level + 1 - 6, 0), minutes.length - 1)]! * 60;
}

/**
 * Pearls the Lighthouse's last levels ask on top of their cost, by the level they reach (owner's decision, 18 October):
 * 5,000 for level 26, then 1,000 more a level, 35,000 in all. Never anything for sale: Pearls are earned by playing.
 */
export const LIGHTHOUSE_PEARLS: Readonly<Record<number, number>> = { 26: 5000, 27: 6000, 28: 7000, 29: 8000, 30: 9000 };

/** Pearls to go from level `level` to level `level + 1`: only the Lighthouse's last levels ask some. */
export const upgradePearls = (id: BuildingId, level: number): number => (id === "lighthouse" ? (LIGHTHOUSE_PEARLS[level + 1] ?? 0) : 0);

/** "7,000": a whole number with its thousands, for the refusals. */
const thousands = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Highest reachable level: the Lighthouse caps every other building. */
export function maxLevel(id: BuildingId, buildings: Buildings): number {
  return id === "lighthouse" ? LIGHTHOUSE_MAX : buildings.lighthouse;
}

export type UpgradeContext = {
  buildings: Buildings;
  stock: Stock;
  /** Your Pearls: the Lighthouse's last levels ask some (upgradePearls). */
  pearls: number;
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
  const pearls = upgradePearls(id, level);
  if (ctx.pearls < pearls) return refuse(`You need ${thousands(pearls)} Pearls for this level.`);
  return OK;
}

/** An upgrade in progress. `left` and `duration` are real seconds; the duration is fixed when the upgrade starts. */
export type UpgradeJob = { id: BuildingId; left: number; duration: number };

export type StartUpgrade =
  | { ok: true; stock: Stock; pearls: number; queue: UpgradeJob[] }
  | { ok: false; reason: string };

/** Starts an upgrade: checks canUpgrade, pays the cost (and the Pearls) and adds the job at the end of the queue. */
export function startUpgrade(id: BuildingId, ctx: { buildings: Buildings; stock: Stock; pearls: number; queue: UpgradeJob[] }): StartUpgrade {
  const check = canUpgrade(id, { buildings: ctx.buildings, stock: ctx.stock, pearls: ctx.pearls, queue: ctx.queue.map((j) => j.id) });
  if (!check.ok) return check;
  const level = ctx.buildings[id];
  const duration = upgradeTime(id, level);
  return { ok: true, stock: payCost(ctx.stock, upgradeCost(id, level)), pearls: ctx.pearls - upgradePearls(id, level), queue: [...ctx.queue, { id, left: duration, duration }] };
}

/**
 * Advances the queue by `seconds` real seconds. Each finished job raises its building by one level.
 * Jobs finish in the order of their end time; jobs ending at the same moment finish in the order they were started.
 * The duration of a job in progress is never recomputed.
 */
export function advanceQueue(buildings: Buildings, queue: UpgradeJob[], seconds: number): { buildings: Buildings; queue: UpgradeJob[]; finished: BuildingId[] } {
  const step = Math.max(0, seconds);
  // Array.prototype.sort is stable: equal end times keep the starting order.
  const finished = queue.filter((j) => j.left <= step).sort((a, b) => a.left - b.left).map((j) => j.id);
  const next = { ...buildings };
  for (const id of finished) next[id] += 1;
  const rest = queue.filter((j) => j.left > step).map((j) => ({ ...j, left: j.left - step }));
  return { buildings: next, queue: rest, finished };
}
