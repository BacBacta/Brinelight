import { OK, canPay, refuse, roundCost, type Check, type Cost, type Stock } from "./types.js";
import { protoSeconds } from "./time.js";

export type RaftBuildingId = "greenhouse" | "smokehouse" | "watchtower";
export type Raft = { hp: number; building: RaftBuildingId | null; level: number };
/** Key "q,r" in axial hex coordinates. */
export type Rafts = Record<string, Raft>;

export const RAFT_BUILDINGS: Record<RaftBuildingId, { name: string; effect: string; base: Cost }> = {
  greenhouse: { name: "Kelp Greenhouse", effect: "+0.45 fish per prototype second per level", base: { wood: 200, oil: 80 } },
  smokehouse: { name: "Smokehouse", effect: "−10% fish eaten per level", base: { wood: 220, fish: 100 } },
  watchtower: { name: "Watchtower", effect: "+5% fleet attack per level", base: { wood: 260, oil: 120 } },
};

export const RAFT_BUILDING_MAX_LEVEL = 3;
export const RAFT_BUILDING_MAX_COPIES = 2;
/** Condition below which a raft runs at half capacity. */
export const RAFT_DAMAGED_BELOW = 60;
/** Condition lost when the Mist strikes and the Lighthouse was not stoked. */
export const MIST_RAFT_DAMAGE = 35;

/** Rafts allowed by Lighthouse level. Prototype table up to level 10, capped after that. */
const RAFT_CAP_TABLE = [0, 0, 0, 0, 6, 10, 14, 17, 25, 33, 39];
export const RAFT_MAX = 39;
export function raftCap(lighthouse: number): number {
  if (lighthouse >= RAFT_CAP_TABLE.length) return RAFT_MAX;
  return RAFT_CAP_TABLE[Math.max(0, lighthouse)] ?? 0;
}

/** Slots: rings 3 and 4 around the island, except those taken by the pier. */
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

/** The outer ring only opens from Lighthouse level 8. */
export const slotOpen = (ring: 3 | 4, lighthouse: number): boolean => ring === 3 || lighthouse >= 8;

/** Cost of the next raft, based on how many are already moored. */
export function raftCost(owned: number): Cost {
  return { wood: Math.round((350 * 1.18 ** owned) / 10) * 10, rope: 1 + Math.floor(owned / 3) };
}
export const RAFT_BUILD_TIME = protoSeconds(12);

export function raftBuildingCost(id: RaftBuildingId, level: number): Cost {
  const raw: Cost = {};
  for (const [k, v] of Object.entries(RAFT_BUILDINGS[id].base) as [keyof Cost, number][]) raw[k] = v * 1.6 ** level;
  return roundCost(raw);
}

export function canAddRaft(ctx: { rafts: Rafts; lighthouse: number; slot: string; stock: Stock; yardBusy: boolean }): Check {
  const slot = RAFT_SLOTS.find((s) => s.key === ctx.slot);
  if (!slot) return refuse("Unknown slot");
  if (ctx.rafts[ctx.slot]) return refuse("A raft is already moored here");
  if (!slotOpen(slot.ring, ctx.lighthouse)) return refuse("The Lighthouse's light doesn't reach this far yet");
  if (Object.keys(ctx.rafts).length >= raftCap(ctx.lighthouse)) return refuse("Upgrade the Lighthouse to moor more rafts");
  if (ctx.yardBusy) return refuse("The shipyard is busy");
  if (!canPay(ctx.stock, raftCost(Object.keys(ctx.rafts).length))) return refuse("Not enough resources");
  return OK;
}

const efficiency = (r: Raft): number => (r.hp >= RAFT_DAMAGED_BELOW ? 1 : 0.5);

/** Sum of the levels of one raft building type, weighted by condition. */
export function raftEffect(rafts: Rafts, id: RaftBuildingId): number {
  return Object.values(rafts).reduce((sum, r) => sum + (r.building === id ? r.level * efficiency(r) : 0), 0);
}

/** Mist wear: each raft loses MIST_RAFT_DAMAGE if the Lighthouse was not stoked. */
export function applyMistDamage(rafts: Rafts, held: boolean): Rafts {
  if (held) return rafts;
  const out: Rafts = {};
  for (const [k, r] of Object.entries(rafts)) out[k] = { ...r, hp: Math.max(0, r.hp - MIST_RAFT_DAMAGE) };
  return out;
}

export const repairCost = (r: Raft): Cost => ({ wood: (100 - r.hp) * 3 });
