/**
 * The costs study (docs/studies/costs.md): the other buildings' costs past level 15, with the slower build times in
 * the game. Pure: its options and what it reads from a run; the runs are played by `costs-run.ts`. Nothing here changes
 * a value of the rules.
 */
import { BUILDING_IDS, LIGHTHOUSE_MAX, TECHS, roundCost, storeCap, upgradeCost, type BuildingId, type Cost } from "@brinelight/shared";

/** A cost option: the cost to go from `level` to `level + 1`, or null where the rules' cost stays. */
export type CostOption = { id: string; name: string; cost: ((id: BuildingId, level: number) => Cost | null) | null };

/** From this level on (the cost to go from 15 to 16), the options change the other buildings' costs; the Lighthouse keeps its own. */
export const FROM = 15;

/**
 * The other buildings' levels 16 to 30 cost `g` times the level before (the rules: ×1.6 a level all the way): the level 16
 * costs `g` times the level 15, and so on.
 */
export function growth(g: number) {
  return (id: BuildingId, level: number): Cost | null => {
    if (id === "lighthouse" || level < FROM) return null;
    const at = upgradeCost(id, FROM - 1);
    return roundCost(Object.fromEntries(Object.entries(at).map(([k, v]) => [k, v * g ** (level - FROM + 1)])) as Cost);
  };
}

/**
 * What a unit of each resource is worth in wood, from what a producer's level adds an hour (42 wood, 11 oil, 14 fish):
 * an hour of the Refinery is worth an hour of the Lumberyard.
 */
export const WOOD_WORTH: Readonly<Record<"oil" | "fish", number>> = { oil: 42 / 11, fish: 42 / 14 };

/**
 * `share` of the wood a level costs, past level 15, asked in the building's other resources instead (fish and oil),
 * at what they are worth in wood (`WOOD_WORTH`), shared equally between them. Wood is what holds the builders back;
 * the oil and the fish fill the storage hundreds of hours a year.
 */
export function lessWood(base: (id: BuildingId, level: number) => Cost | null, share: number) {
  return (id: BuildingId, level: number): Cost | null => {
    const c = base(id, level);
    if (!c || !c.wood) return c;
    const others = (["oil", "fish"] as const).filter((k) => (c[k] ?? 0) > 0);
    if (!others.length) return c;
    const moved = c.wood * share;
    const out: Cost = { ...c, wood: c.wood - moved };
    for (const k of others) out[k] = (c[k] ?? 0) + moved / others.length / WOOD_WORTH[k];
    return roundCost(out);
  };
}

export const OPTIONS: readonly CostOption[] = [
  { id: "rules", name: "Today (×1.6 a level)", cost: null },
  { id: "g1.3", name: "×1.3 a level past 15 (as the Lighthouse)", cost: growth(1.3) },
  { id: "g1.2", name: "×1.2", cost: growth(1.2) },
  { id: "g1.15", name: "×1.15", cost: growth(1.15) },
  { id: "g1.1", name: "×1.1", cost: growth(1.1) },
  { id: "g1.15-wood", name: "×1.15, a third of the wood in oil and fish", cost: lessWood(growth(1.15), 1 / 3) },
  { id: "g1.12-wood", name: "×1.12, a third of the wood in oil and fish", cost: lessWood(growth(1.12), 1 / 3) },
  { id: "g1.1-wood", name: "×1.1, a third of the wood in oil and fish", cost: lessWood(growth(1.1), 1 / 3) },
  { id: "g1.1-wood-half", name: "×1.1, half the wood in oil and fish", cost: lessWood(growth(1.1), 0.5) },
];

/** The most the storage ever holds: Lighthouse 30 with every Sealed Warehouses. */
export const STORAGE_MAX = storeCap(LIGHTHOUSE_MAX, { warehouses: TECHS.warehouses.max });

/**
 * Each building's first level the storage can never hold with this option: its cost of one resource is more than the
 * most the storage ever holds (`STORAGE_MAX`); none when every level fits.
 */
export function walls(option: CostOption): Partial<Record<BuildingId, number>> {
  const out: Partial<Record<BuildingId, number>> = {};
  for (const id of BUILDING_IDS) {
    for (let level = 1; level < LIGHTHOUSE_MAX; level++) {
      const cost = option.cost?.(id, level) ?? upgradeCost(id, level);
      if (Object.values(cost).some((v) => (v ?? 0) > STORAGE_MAX)) {
        out[id] = level + 1;
        break;
      }
    }
  }
  return out;
}

/** Every level of every building, 15 → 30, added up by resource: what the whole city costs past 15 with this option. */
export function pastFifteen(option: CostOption): Record<"wood" | "oil" | "fish", number> {
  const sum = { wood: 0, oil: 0, fish: 0 };
  for (const id of BUILDING_IDS) {
    if (id === "lighthouse") continue;
    for (let level = FROM; level < LIGHTHOUSE_MAX; level++) {
      const cost = option.cost?.(id, level) ?? upgradeCost(id, level);
      for (const k of ["wood", "oil", "fish"] as const) sum[k] += cost[k] ?? 0;
    }
  }
  return sum;
}

/** The option the study recommends. */
export const RECOMMENDED = "g1.12-wood";

/** The cost of a few levels of each building but the Lighthouse, today and with an option. */
export function valuesTable(option: CostOption, levels: readonly number[] = [16, 20, 25, 30]): string {
  const show = (c: Cost) => (["wood", "oil", "fish"] as const).filter((k) => c[k]).map((k) => `${c[k]!.toLocaleString("en-US")} ${k}`).join(" + ");
  const rows = ["| Building | Level | Today | With the option |", "| --- | --- | --- | --- |"];
  for (const id of BUILDING_IDS) {
    if (id === "lighthouse") continue;
    for (const level of levels) rows.push(`| ${id} | ${level} | ${show(upgradeCost(id, level - 1))} | ${show(option.cost?.(id, level - 1) ?? upgradeCost(id, level - 1))} |`);
  }
  return rows.join("\n");
}
