import { OK, canPay, refuse, roundCost, type BuildingId, type Buildings, type Check, type Cost, type Stock } from "./types.js";
import { protoSeconds } from "./time.js";

/** Niveau maximal du Phare dans le jeu complet (le prototype s'arrêtait à 10). */
export const PHARE_MAX = 30;
/** Nombre d'ouvriers : améliorations simultanées. */
export const BUILDERS = 2;

type BuildingDef = {
  name: string;
  description: string;
  /** Coût de base, multiplié par growth^niveau. */
  base: Cost;
  growth: number;
  /** Durée de base en secondes prototype, multipliée par timeGrowth^niveau. */
  baseTime: number;
  timeGrowth: number;
};

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  phare: { name: "Phare", description: "Repousse la Brume et fixe le niveau maximal des autres bâtiments.", base: { bois: 180, huile: 120 }, growth: 1.62, baseTime: 9, timeGrowth: 1.55 },
  raffinerie: { name: "Raffinerie", description: "Produit l'huile qui fait brûler le Phare.", base: { bois: 90, poisson: 40 }, growth: 1.6, baseTime: 6, timeGrowth: 1.5 },
  pecherie: { name: "Pêcherie", description: "Nourrit les survivants et les équipages.", base: { bois: 80, huile: 30 }, growth: 1.6, baseTime: 6, timeGrowth: 1.5 },
  chantier: { name: "Chantier", description: "Récupère et découpe le bois flotté.", base: { poisson: 70, huile: 30 }, growth: 1.6, baseTime: 6, timeGrowth: 1.5 },
  abris: { name: "Abris", description: "Logent les survivants : plus d'abris, plus de bras.", base: { bois: 110, poisson: 60 }, growth: 1.6, baseTime: 7, timeGrowth: 1.5 },
  caserne: { name: "Caserne", description: "Forme abordeurs, harponneurs et arbalétriers.", base: { bois: 140, huile: 60, poisson: 60 }, growth: 1.6, baseTime: 8, timeGrowth: 1.5 },
  port: { name: "Port", description: "Chaque palier ajoute une flotte en mer et de la capacité de cale.", base: { bois: 150, huile: 80 }, growth: 1.6, baseTime: 8, timeGrowth: 1.5 },
  observatoire: { name: "Observatoire", description: "Débloque les recherches.", base: { bois: 160, huile: 90 }, growth: 1.6, baseTime: 8, timeGrowth: 1.5 },
  infirmerie: { name: "Infirmerie", description: "Soigne les blessés au retour des combats.", base: { bois: 120, poisson: 90 }, growth: 1.6, baseTime: 7, timeGrowth: 1.5 },
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

export const STARTING_BUILDINGS: Buildings = {
  phare: 2, raffinerie: 1, pecherie: 1, chantier: 1, abris: 1, caserne: 0, port: 0, observatoire: 0, infirmerie: 0,
};

/** Coût pour passer du niveau `level` au niveau `level + 1`, arrondi à la dizaine. */
export function upgradeCost(id: BuildingId, level: number): Cost {
  const d = BUILDINGS[id];
  const raw: Cost = {};
  for (const [k, v] of Object.entries(d.base) as [keyof Cost, number][]) raw[k] = v * d.growth ** level;
  return roundCost(raw);
}

/** Durée réelle (secondes) pour passer du niveau `level` au niveau `level + 1`. */
export function upgradeTime(id: BuildingId, level: number): number {
  const d = BUILDINGS[id];
  return Math.round(protoSeconds(d.baseTime * d.timeGrowth ** level));
}

/** Niveau maximal atteignable : le Phare plafonne tous les autres bâtiments. */
export function maxLevel(id: BuildingId, buildings: Buildings): number {
  return id === "phare" ? PHARE_MAX : buildings.phare;
}

export type UpgradeContext = {
  buildings: Buildings;
  stock: Stock;
  /** Bâtiments déjà en chantier. */
  queue: BuildingId[];
};

/** Le serveur appelle cette règle avant d'accepter toute amélioration. */
export function canUpgrade(id: BuildingId, ctx: UpgradeContext): Check {
  const level = ctx.buildings[id];
  if (level >= maxLevel(id, ctx.buildings)) {
    return refuse(id === "phare" ? "Le Phare est au niveau maximal" : "Améliore d'abord le Phare");
  }
  if (ctx.queue.includes(id)) return refuse("Ce bâtiment est déjà en chantier");
  if (ctx.queue.length >= BUILDERS) return refuse(`Tes ${BUILDERS} ouvriers sont occupés`);
  if (!canPay(ctx.stock, upgradeCost(id, level))) return refuse("Ressources insuffisantes");
  return OK;
}
