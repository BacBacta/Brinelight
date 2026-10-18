/**
 * What happened between two cities: the works that ended, the captains who rose a level and the Mists that lifted. Pure: the client compares
 * the city it showed with the one it shows now (or, at launch, with the last city seen on the device) to celebrate
 * them. It works the same for a city advanced on the device and for the city the server sends. No rule here.
 */
import { BUILDING_IDS } from "../rules/buildings.js";
import type { CaptainId } from "../rules/captains.js";
import { MIST_HELD_PEARLS } from "../rules/mist.js";
import type { RaftBuildingId } from "../rules/rafts.js";
import type { TechId } from "../rules/research.js";
import type { BuildingId, TroopType } from "../rules/types.js";
import type { PlayerState } from "./types.js";

export type GameEvent =
  | { kind: "building"; building: BuildingId; level: number }
  | { kind: "research"; tech: TechId; level: number }
  | { kind: "raft"; slot: string }
  | { kind: "raftBuilding"; slot: string; building: RaftBuildingId; level: number }
  | { kind: "repaired"; count: number }
  | { kind: "troops"; troop: TroopType; count: number }
  | { kind: "veterans"; troop: TroopType; count: number }
  | { kind: "healed"; count: number }
  | { kind: "captain"; captain: CaptainId; level: number }
  | { kind: "mistHeld"; count: number; pearls: number }
  | { kind: "mistMissed"; count: number; rafts: number };

type Job = { left: number } | null;
/** Is the work of `before` still going on in `after`? The same work only goes down in time; anything else means it ended. */
const goesOn = <J extends Job>(before: J, after: J, same: (a: NonNullable<J>, b: NonNullable<J>) => boolean): boolean =>
  !!before && !!after && same(before as NonNullable<J>, after as NonNullable<J>) && after.left <= before.left;

/**
 * The events between `before` and `after`, in a fixed order: buildings, research, rafts, troops, healing, captains,
 * Mists. Several Mists in between give one event for those held (with their Pearls) and one for those not held (with
 * the rafts the last one damaged).
 * A building or a research that rose several levels gives one event, with its new level. A captain recruited in
 * between is not a level up.
 */
export function eventsBetween(before: PlayerState, after: PlayerState): GameEvent[] {
  const out: GameEvent[] = [];
  for (const id of BUILDING_IDS) if (after.buildings[id] > before.buildings[id]) out.push({ kind: "building", building: id, level: after.buildings[id] });
  for (const [tech, level] of Object.entries(after.techs) as [TechId, number][]) if (level > (before.techs[tech] ?? 0)) out.push({ kind: "research", tech, level });
  for (const [slot, raft] of Object.entries(after.rafts)) {
    const was = before.rafts[slot];
    if (!was) out.push({ kind: "raft", slot });
    if (raft.building && (!was || was.building !== raft.building || raft.level > was.level)) out.push({ kind: "raftBuilding", slot, building: raft.building, level: raft.level });
  }
  const repaired = Object.entries(after.rafts).filter(([slot, r]) => before.rafts[slot] && r.hp > before.rafts[slot]!.hp).length;
  if (repaired > 0) out.push({ kind: "repaired", count: repaired });
  const t = before.training;
  if (t && !goesOn(t, after.training, (a, b) => a.kind === b.kind && a.troop === b.troop && a.count === b.count)) {
    out.push({ kind: t.kind === "train" ? "troops" : "veterans", troop: t.troop, count: t.count });
  }
  const h = before.healing;
  if (h && !goesOn(h, after.healing, (a, b) => JSON.stringify(a.wounded) === JSON.stringify(b.wounded))) {
    out.push({ kind: "healed", count: Object.values(h.wounded).reduce((n, v) => n + v, 0) });
  }
  for (const [id, c] of Object.entries(after.captains) as [CaptainId, { level: number }][]) {
    const was = before.captains[id];
    if (was && c.level > was.level) out.push({ kind: "captain", captain: id, level: c.level });
  }
  const held = after.mist.held - before.mist.held;
  if (held > 0) out.push({ kind: "mistHeld", count: held, pearls: held * MIST_HELD_PEARLS });
  const missed = after.mist.missed - before.mist.missed;
  if (missed > 0) out.push({ kind: "mistMissed", count: missed, rafts: after.mist.damaged });
  return out;
}
