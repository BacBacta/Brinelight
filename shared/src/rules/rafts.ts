import { EARLY_INSTALL, EARLY_RAFT, earlyCapped } from "./early.js";
import { OK, canPay, payCost, refuse, roundCost, type Check, type Cost, type Stock } from "./types.js";
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
/** A raft's sturdiness when new or repaired (the prototype's 100). */
export const RAFT_MAX_HP = 100;
export const RAFT_BUILDING_MAX_COPIES = 2;
/** Condition below which a raft runs at half capacity. */
export const RAFT_DAMAGED_BELOW = 60;
/** Condition lost when a Mist ends that the Lighthouse did not hold. */
export const MIST_RAFT_DAMAGE = 35;
/** The Mist never takes a raft below this: a raft is never stopped, below RAFT_DAMAGED_BELOW it runs at half. */
export const RAFT_MIN_HP = 25;

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
  if (ctx.rafts[ctx.slot]) return refuse("This spot is taken");
  if (!slotOpen(slot.ring, ctx.lighthouse)) return refuse("The Lighthouse's light doesn't reach this far yet");
  if (Object.keys(ctx.rafts).length >= raftCap(ctx.lighthouse)) return refuse("Upgrade the Lighthouse to grow your city further");
  if (ctx.yardBusy) return refuse("Your builders on the shore are busy");
  if (!canPay(ctx.stock, raftCost(Object.keys(ctx.rafts).length))) return refuse("Not enough resources");
  return OK;
}

const efficiency = (r: Raft): number => (r.hp >= RAFT_DAMAGED_BELOW ? 1 : 0.5);

/** Sum of the levels of one raft building type, weighted by condition. */
export function raftEffect(rafts: Rafts, id: RaftBuildingId): number {
  return Object.values(rafts).reduce((sum, r) => sum + (r.building === id ? r.level * efficiency(r) : 0), 0);
}

/** Mist wear: each raft loses MIST_RAFT_DAMAGE if the Lighthouse did not hold the Mist, never below RAFT_MIN_HP. */
export function applyMistDamage(rafts: Rafts, held: boolean): Rafts {
  if (held) return rafts;
  const out: Rafts = {};
  for (const [k, r] of Object.entries(rafts)) out[k] = { ...r, hp: Math.min(r.hp, Math.max(RAFT_MIN_HP, r.hp - MIST_RAFT_DAMAGE)) };
  return out;
}

/**
 * What repairing costs per missing sturdiness point: oil (tar for the hulls), and nothing else (owner's decision,
 * 18 October; it was 2 × the Lighthouse's level in oil and 1 wood).
 */
export const REPAIR_OIL = 2;
/** Shipyard time per 35 missing points (one Mist not held) on one raft: 6 real minutes (1 prototype second). */
export const REPAIR_TIME_PER_MIST = protoSeconds(1);

/** The rafts below their full sturdiness, by slot, in the order of the slots. */
export const damagedRafts = (rafts: Rafts): string[] => RAFT_SLOTS.map((s) => s.key).filter((k) => rafts[k] && rafts[k]!.hp < RAFT_MAX_HP);

const missingPoints = (rafts: Rafts): number => damagedRafts(rafts).reduce((n, k) => n + (RAFT_MAX_HP - rafts[k]!.hp), 0);

/** Repairing every damaged raft: 2 oil per missing point, whatever the Lighthouse's level. */
export function repairCost(rafts: Rafts): Cost {
  return { oil: missingPoints(rafts) * REPAIR_OIL };
}

/** How long repairing every damaged raft takes, in real seconds: 6 minutes per 35 missing points. */
export const repairTime = (rafts: Rafts): number => (missingPoints(rafts) / MIST_RAFT_DAMAGE) * REPAIR_TIME_PER_MIST;

/** Real duration (seconds) of putting a building on a raft (prototype: 8 seconds). */
export const RAFT_INSTALL_TIME = protoSeconds(8);
/** The time a new raft takes: the city's first one at most 5 minutes while its Lighthouse is below level 6 (the early start). */
export const raftBuildTime = (rafts: Rafts, lighthouse: number): number => (Object.keys(rafts).length === 0 ? earlyCapped(RAFT_BUILD_TIME, EARLY_RAFT, lighthouse) : RAFT_BUILD_TIME);
/** The time a raft building's first level takes: at most 5 minutes while the Lighthouse is below level 6 (the early start). */
export const installTime = (lighthouse: number): number => earlyCapped(RAFT_INSTALL_TIME, EARLY_INSTALL, lighthouse);
/** Real duration (seconds) of taking a raft building from `level` to the next one (prototype: 8 × 1.5^level seconds). */
export const raftUpgradeTime = (level: number): number => protoSeconds(8 * 1.5 ** level);

/**
 * The work at the shipyard: one at a time, as in the prototype. A new raft on a slot (`raft`), a building put on a
 * free raft (`install`, at level 1 when done), a raft building taken one level up (`upgrade`), or every damaged raft
 * repaired at once (`repair`, its rafts by slot).
 */
export type YardJob =
  | { slot: string; kind: "raft"; left: number; duration: number }
  | { slot: string; kind: "install"; building: RaftBuildingId; left: number; duration: number }
  | { slot: string; kind: "upgrade"; left: number; duration: number }
  | { slots: string[]; kind: "repair"; left: number; duration: number };

/** The slot the shipyard works on, for a work on one raft; null while it repairs. */
export const yardSlot = (job: YardJob | null): string | null => (job && job.kind !== "repair" ? job.slot : null);

export type StartYard = { ok: true; stock: Stock; yard: YardJob } | { ok: false; reason: string };

/** Starts a new raft on a slot: checked with canAddRaft, paid at once, moored after RAFT_BUILD_TIME. */
export function startRaft(slot: string, ctx: { rafts: Rafts; lighthouse: number; stock: Stock; yard: YardJob | null }): StartYard {
  const check = canAddRaft({ rafts: ctx.rafts, lighthouse: ctx.lighthouse, slot, stock: ctx.stock, yardBusy: ctx.yard !== null });
  if (!check.ok) return check;
  return {
    ok: true,
    stock: payCost(ctx.stock, raftCost(Object.keys(ctx.rafts).length)),
    yard: { slot, kind: "raft", left: raftBuildTime(ctx.rafts, ctx.lighthouse), duration: raftBuildTime(ctx.rafts, ctx.lighthouse) },
  };
}

/** Rafts that carry this building type, plus the one the shipyard is putting it on: a type has at most RAFT_BUILDING_MAX_COPIES. */
export function raftBuildingCopies(id: RaftBuildingId, rafts: Rafts, yard: YardJob | null): number {
  const on = Object.values(rafts).filter((r) => r.building === id).length;
  return on + (yard?.kind === "install" && yard.building === id ? 1 : 0);
}

/** Can you put this building on the raft of this slot now? The refusals keep the prototype's words where it had some. */
export function canInstall(id: RaftBuildingId, ctx: { rafts: Rafts; slot: string; stock: Stock; yard: YardJob | null }): Check {
  const raft = ctx.rafts[ctx.slot];
  if (!raft) return refuse("There is nothing here yet");
  if (raft.building) return refuse("There is already a building here");
  if (raftBuildingCopies(id, ctx.rafts, ctx.yard) >= RAFT_BUILDING_MAX_COPIES) return refuse(`You can build each type ${RAFT_BUILDING_MAX_COPIES === 2 ? "twice" : `${RAFT_BUILDING_MAX_COPIES} times`}`);
  if (ctx.yard) return refuse("Your builders on the shore are busy");
  if (!canPay(ctx.stock, raftBuildingCost(id, 0))) return refuse("Not enough resources");
  return OK;
}

/** Puts a building on a free raft: checked with canInstall, paid at once, at level 1 after installTime. */
export function startInstall(id: RaftBuildingId, ctx: { rafts: Rafts; slot: string; lighthouse: number; stock: Stock; yard: YardJob | null }): StartYard {
  const check = canInstall(id, ctx);
  if (!check.ok) return check;
  return {
    ok: true,
    stock: payCost(ctx.stock, raftBuildingCost(id, 0)),
    yard: { slot: ctx.slot, kind: "install", building: id, left: installTime(ctx.lighthouse), duration: installTime(ctx.lighthouse) },
  };
}

/** Can you take the building on this raft one level up now? */
export function canUpgradeRaft(ctx: { rafts: Rafts; slot: string; stock: Stock; yard: YardJob | null }): Check {
  const raft = ctx.rafts[ctx.slot];
  if (!raft) return refuse("There is nothing here yet");
  if (!raft.building) return refuse("Put a building here first");
  if (raft.level >= RAFT_BUILDING_MAX_LEVEL) return refuse("Max level");
  if (raft.hp < RAFT_DAMAGED_BELOW) return refuse("Mend this first");
  if (ctx.yard) return refuse("Your builders on the shore are busy");
  if (!canPay(ctx.stock, raftBuildingCost(raft.building, raft.level))) return refuse("Not enough resources");
  return OK;
}

/** Takes the building on a raft one level up: checked with canUpgradeRaft, paid at once, done after raftUpgradeTime. */
export function startRaftUpgrade(ctx: { rafts: Rafts; slot: string; stock: Stock; yard: YardJob | null }): StartYard {
  const check = canUpgradeRaft(ctx);
  if (!check.ok) return check;
  const raft = ctx.rafts[ctx.slot]!;
  const duration = raftUpgradeTime(raft.level);
  return { ok: true, stock: payCost(ctx.stock, raftBuildingCost(raft.building!, raft.level)), yard: { slot: ctx.slot, kind: "upgrade", left: duration, duration } };
}

/** Can you repair your rafts now? */
export function canRepair(ctx: { rafts: Rafts; stock: Stock; yard: YardJob | null }): Check {
  if (damagedRafts(ctx.rafts).length === 0) return refuse("Nothing needs mending");
  if (ctx.yard) return refuse("Your builders on the shore are busy");
  if (!canPay(ctx.stock, repairCost(ctx.rafts))) return refuse("Not enough resources");
  return OK;
}

/** Repairs every damaged raft: checked with canRepair, paid at once, all back to full sturdiness after repairTime. */
export function startRepair(ctx: { rafts: Rafts; stock: Stock; yard: YardJob | null }): StartYard {
  const check = canRepair(ctx);
  if (!check.ok) return check;
  const duration = repairTime(ctx.rafts);
  return { ok: true, stock: payCost(ctx.stock, repairCost(ctx.rafts)), yard: { slots: damagedRafts(ctx.rafts), kind: "repair", left: duration, duration } };
}

/**
 * Advances the work at the shipyard by `seconds` real seconds. Once done: the new raft is moored on its slot, the
 * building stands on its raft at level 1, the raft's building is one level up, or the repaired rafts are back to full
 * sturdiness (a Mist not held while they were repaired is mended with them). Its effect starts at that moment.
 */
export function advanceYard(rafts: Rafts, job: YardJob | null, seconds: number): { rafts: Rafts; yard: YardJob | null } {
  if (!job) return { rafts, yard: null };
  if (job.left > Math.max(0, seconds)) return { rafts, yard: { ...job, left: job.left - Math.max(0, seconds) } };
  if (job.kind === "repair") {
    const out = { ...rafts };
    for (const k of job.slots) if (out[k]) out[k] = { ...out[k]!, hp: RAFT_MAX_HP };
    return { rafts: out, yard: null };
  }
  const raft = rafts[job.slot];
  if (job.kind === "raft") return { rafts: { ...rafts, [job.slot]: { hp: RAFT_MAX_HP, building: null, level: 0 } }, yard: null };
  // The raft is always there: nothing removes one while the shipyard works on it.
  if (!raft) return { rafts, yard: null };
  if (job.kind === "install") return { rafts: { ...rafts, [job.slot]: { ...raft, building: job.building, level: 1 } }, yard: null };
  return { rafts: { ...rafts, [job.slot]: { ...raft, level: Math.min(RAFT_BUILDING_MAX_LEVEL, raft.level + 1) } }, yard: null };
}
