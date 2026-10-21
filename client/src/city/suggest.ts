import { BUILDING_IDS, canUpgrade, upgradeCost, type BuildingId } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";

/** The (up to) 2 cheapest upgrades you can start right now, as the green arrows of the prototype. */
/** Every building whose upgrade (or building, at level 0) can start now. */
export function possibleUpgrades(state: PlayerState): BuildingId[] {
  const queue = state.queue.map((j) => j.id);
  return BUILDING_IDS.filter((id) => canUpgrade(id, { buildings: state.buildings, stock: state.stock, pearls: state.pearls, queue }).ok);
}

export function suggestedUpgrades(state: PlayerState): BuildingId[] {
  const queue = state.queue.map((j) => j.id);
  const total = (id: BuildingId) => Object.values(upgradeCost(id, state.buildings[id])).reduce((a, b) => a + b, 0);
  return BUILDING_IDS.filter((id) => canUpgrade(id, { buildings: state.buildings, stock: state.stock, pearls: state.pearls, queue }).ok)
    .sort((a, b) => total(a) - total(b))
    .slice(0, 2);
}

/** Progress of an upgrade, from 0 to 1. */
export const progress = (job: { left: number; duration: number }): number => Math.min(1, Math.max(0, 1 - job.left / job.duration));
