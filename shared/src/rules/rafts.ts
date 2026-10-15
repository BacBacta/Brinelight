import { OK, canPay, refuse, roundCost, type Check, type Cost, type Stock } from "./types.js";
import { protoSeconds } from "./time.js";

export type RaftBuildingId = "serre" | "fumoir" | "guet";
export type Raft = { hp: number; building: RaftBuildingId | null; level: number };
/** Clé "q,r" en coordonnées hexagonales axiales. */
export type Rafts = Record<string, Raft>;

export const RAFT_BUILDINGS: Record<RaftBuildingId, { name: string; effect: string; base: Cost }> = {
  serre: { name: "Serre à algues", effect: "+0,45 poisson par seconde prototype et par niveau", base: { bois: 200, huile: 80 } },
  fumoir: { name: "Fumoir", effect: "−10 % de poisson mangé par niveau", base: { bois: 220, poisson: 100 } },
  guet: { name: "Tour de guet", effect: "+5 % d'attaque des flottes par niveau", base: { bois: 260, huile: 120 } },
};

export const RAFT_BUILDING_MAX_LEVEL = 3;
export const RAFT_BUILDING_MAX_COPIES = 2;
/** Solidité sous laquelle un radeau tourne à moitié. */
export const RAFT_DAMAGED_BELOW = 60;
/** Perte de solidité si la Brume frappe sans Phare poussé. */
export const BRUME_RAFT_DAMAGE = 35;

/** Radeaux autorisés selon le niveau du Phare. Table du prototype jusqu'au niveau 10, plafond ensuite. */
const RAFT_CAP_TABLE = [0, 0, 0, 0, 6, 10, 14, 17, 25, 33, 39];
export const RAFT_MAX = 39;
export function raftCap(phare: number): number {
  if (phare >= RAFT_CAP_TABLE.length) return RAFT_MAX;
  return RAFT_CAP_TABLE[Math.max(0, phare)] ?? 0;
}

/** Emplacements : couronnes 3 et 4 autour de l'île, sauf ceux occupés par le ponton. */
const PIER = new Set(["1,-3", "1,-4", "2,-4"]);
export const RAFT_SLOTS: { key: string; q: number; r: number; ring: 3 | 4 }[] = (() => {
  const out: { key: string; q: number; r: number; ring: 3 | 4 }[] = [];
  for (const ring of [3, 4] as const) {
    for (let q = -ring; q <= ring; q++) {
      for (let r = -ring; r <= ring; r++) {
        const s = -q - r;
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) !== ring) continue;
        const key = `${q},${r}`;
        if (!PIER.has(key)) out.push({ key, q, r, ring });
      }
    }
  }
  return out;
})();

/** La seconde couronne ne s'ouvre qu'à partir du Phare niveau 8. */
export const slotOpen = (ring: 3 | 4, phare: number): boolean => ring === 3 || phare >= 8;

/** Coût du prochain radeau, selon le nombre déjà amarré. */
export function raftCost(owned: number): Cost {
  return { bois: Math.round((350 * 1.18 ** owned) / 10) * 10, cord: 1 + Math.floor(owned / 3) };
}
export const RAFT_BUILD_TIME = protoSeconds(12);

export function raftBuildingCost(id: RaftBuildingId, level: number): Cost {
  const raw: Cost = {};
  for (const [k, v] of Object.entries(RAFT_BUILDINGS[id].base) as [keyof Cost, number][]) raw[k] = v * 1.6 ** level;
  return roundCost(raw);
}

export function canAddRaft(ctx: { rafts: Rafts; phare: number; slot: string; stock: Stock; yardBusy: boolean }): Check {
  const slot = RAFT_SLOTS.find((s) => s.key === ctx.slot);
  if (!slot) return refuse("Emplacement inconnu");
  if (ctx.rafts[ctx.slot]) return refuse("Un radeau est déjà amarré ici");
  if (!slotOpen(slot.ring, ctx.phare)) return refuse("La lumière du Phare ne porte pas encore jusqu'ici");
  if (Object.keys(ctx.rafts).length >= raftCap(ctx.phare)) return refuse("Améliore le Phare pour amarrer plus de radeaux");
  if (ctx.yardBusy) return refuse("Le chantier naval est occupé");
  if (!canPay(ctx.stock, raftCost(Object.keys(ctx.rafts).length))) return refuse("Ressources insuffisantes");
  return OK;
}

const efficiency = (r: Raft): number => (r.hp >= RAFT_DAMAGED_BELOW ? 1 : 0.5);

/** Somme des niveaux d'un type de bâtiment de radeau, pondérée par la solidité. */
export function raftEffect(rafts: Rafts, id: RaftBuildingId): number {
  return Object.values(rafts).reduce((sum, r) => sum + (r.building === id ? r.level * efficiency(r) : 0), 0);
}

/** Usure de la Brume : chaque radeau perd BRUME_RAFT_DAMAGE si le Phare n'a pas été poussé. */
export function applyBrumeDamage(rafts: Rafts, held: boolean): Rafts {
  if (held) return rafts;
  const out: Rafts = {};
  for (const [k, r] of Object.entries(rafts)) out[k] = { ...r, hp: Math.max(0, r.hp - BRUME_RAFT_DAMAGE) };
  return out;
}

export const repairCost = (r: Raft): Cost => ({ bois: (100 - r.hp) * 3 });
