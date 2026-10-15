import { OK, canPay, refuse, type Check, type Cost, type Stock } from "./types.js";
import { protoSeconds } from "./time.js";

export type TechId = "raff" | "filets" | "scie" | "stock" | "voiles" | "cales" | "lames" | "coques" | "soins" | "veteran";
export type Techs = Partial<Record<TechId, number>>;

type TechDef = { name: string; branch: "Économie" | "Mer" | "Guerre"; effect: string; max: number; tier: number };

export const TECHS: Record<TechId, TechDef> = {
  raff: { name: "Raffinage", branch: "Économie", effect: "+10 % d'huile par niveau", max: 3, tier: 1 },
  filets: { name: "Filets tressés", branch: "Économie", effect: "+10 % de poisson par niveau", max: 3, tier: 1 },
  scie: { name: "Scies à marée", branch: "Économie", effect: "+10 % de bois par niveau", max: 3, tier: 1 },
  stock: { name: "Entrepôts étanches", branch: "Économie", effect: "+15 % de stockage par niveau", max: 3, tier: 2 },
  voiles: { name: "Voiles latines", branch: "Mer", effect: "+10 % de vitesse des flottes par niveau", max: 3, tier: 1 },
  cales: { name: "Cales profondes", branch: "Mer", effect: "+15 % de cale par niveau", max: 3, tier: 2 },
  lames: { name: "Lames trempées", branch: "Guerre", effect: "+6 % d'attaque par niveau", max: 3, tier: 1 },
  coques: { name: "Coques doublées", branch: "Guerre", effect: "−8 % de pertes par niveau", max: 3, tier: 2 },
  soins: { name: "Brancardiers", branch: "Guerre", effect: "+10 % de blessés sauvés par niveau", max: 3, tier: 2 },
  veteran: { name: "Doctrine des vétérans", branch: "Guerre", effect: "Débloque les vétérans à la Caserne", max: 1, tier: 3 },
};

export const techLevel = (techs: Techs, id: TechId): number => techs[id] ?? 0;

/** Coût du niveau `level + 1`. */
export function techCost(id: TechId, level: number): Cost {
  const t = TECHS[id].tier;
  return {
    bois: Math.round((180 * t * 1.8 ** level) / 10) * 10,
    huile: Math.round((110 * t * 1.8 ** level) / 10) * 10,
  };
}

/** Durée réelle (secondes) du niveau `level + 1`. */
export function techTime(id: TechId, level: number): number {
  return Math.round(protoSeconds(10 * TECHS[id].tier * 1.6 ** level));
}

/** Niveau d'Observatoire requis pour étudier le niveau `level + 1`. */
export const observatoryRequired = (id: TechId, level: number): number => TECHS[id].tier + level;

export function canResearch(id: TechId, ctx: { techs: Techs; observatory: number; busy: boolean; stock: Stock }): Check {
  const level = techLevel(ctx.techs, id);
  if (level >= TECHS[id].max) return refuse("Recherche au niveau maximal");
  if (ctx.busy) return refuse("Une recherche est déjà en cours");
  const need = observatoryRequired(id, level);
  if (ctx.observatory < need) return refuse(`Observatoire niveau ${need} requis`);
  if (!canPay(ctx.stock, techCost(id, level))) return refuse("Ressources insuffisantes");
  return OK;
}
