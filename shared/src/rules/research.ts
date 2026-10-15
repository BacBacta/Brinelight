import { OK, canPay, refuse, type Check, type Cost, type Stock } from "./types.js";
import { protoSeconds } from "./time.js";

export type TechId = "refining" | "nets" | "saws" | "warehouses" | "sails" | "holds" | "blades" | "hulls" | "stretchers" | "veterans";
export type Techs = Partial<Record<TechId, number>>;

type TechDef = { name: string; branch: "Economy" | "Sea" | "War"; effect: string; max: number; tier: number };

export const TECHS: Record<TechId, TechDef> = {
  refining: { name: "Refining", branch: "Economy", effect: "+10% oil per level", max: 3, tier: 1 },
  nets: { name: "Braided Nets", branch: "Economy", effect: "+10% fish per level", max: 3, tier: 1 },
  saws: { name: "Tide Saws", branch: "Economy", effect: "+10% wood per level", max: 3, tier: 1 },
  warehouses: { name: "Sealed Warehouses", branch: "Economy", effect: "+15% storage per level", max: 3, tier: 2 },
  sails: { name: "Lateen Sails", branch: "Sea", effect: "+10% fleet speed per level", max: 3, tier: 1 },
  holds: { name: "Deep Holds", branch: "Sea", effect: "+15% hold capacity per level", max: 3, tier: 2 },
  blades: { name: "Tempered Blades", branch: "War", effect: "+6% attack per level", max: 3, tier: 1 },
  hulls: { name: "Double Hulls", branch: "War", effect: "−8% losses per level", max: 3, tier: 2 },
  stretchers: { name: "Stretcher Bearers", branch: "War", effect: "+10% wounded saved per level", max: 3, tier: 2 },
  veterans: { name: "Veteran Doctrine", branch: "War", effect: "Unlocks veterans at the Barracks", max: 1, tier: 3 },
};

export const techLevel = (techs: Techs, id: TechId): number => techs[id] ?? 0;

/** Cost of level `level + 1`. */
export function techCost(id: TechId, level: number): Cost {
  const t = TECHS[id].tier;
  return {
    wood: Math.round((180 * t * 1.8 ** level) / 10) * 10,
    oil: Math.round((110 * t * 1.8 ** level) / 10) * 10,
  };
}

/** Real duration (seconds) of level `level + 1`. */
export function techTime(id: TechId, level: number): number {
  return Math.round(protoSeconds(10 * TECHS[id].tier * 1.6 ** level));
}

/** Observatory level required to research level `level + 1`. */
export const observatoryRequired = (id: TechId, level: number): number => TECHS[id].tier + level;

export function canResearch(id: TechId, ctx: { techs: Techs; observatory: number; busy: boolean; stock: Stock }): Check {
  const level = techLevel(ctx.techs, id);
  if (level >= TECHS[id].max) return refuse("This research is at max level");
  if (ctx.busy) return refuse("Research is already in progress");
  const need = observatoryRequired(id, level);
  if (ctx.observatory < need) return refuse(`Observatory level ${need} required`);
  if (!canPay(ctx.stock, techCost(id, level))) return refuse("Not enough resources");
  return OK;
}
