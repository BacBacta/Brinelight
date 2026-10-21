import { BUILDINGS, BUILDING_IDS, OBJECTIVES, canUpgrade, upgradeCost, type BuildingId } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";

/** Every building whose upgrade (or building, at level 0) can start now. */
export function possibleUpgrades(state: PlayerState): BuildingId[] {
  const queue = state.queue.map((j) => j.id);
  return BUILDING_IDS.filter((id) => canUpgrade(id, { buildings: state.buildings, stock: state.stock, pearls: state.pearls, queue }).ok);
}

/** The (up to) 2 cheapest upgrades you can start right now, as the green arrows of the prototype. */
export function suggestedUpgrades(state: PlayerState): BuildingId[] {
  const queue = state.queue.map((j) => j.id);
  const total = (id: BuildingId) => Object.values(upgradeCost(id, state.buildings[id])).reduce((a, b) => a + b, 0);
  return BUILDING_IDS.filter((id) => canUpgrade(id, { buildings: state.buildings, stock: state.stock, pearls: state.pearls, queue }).ok)
    .sort((a, b) => total(a) - total(b))
    .slice(0, 2);
}

/** The building the current objective asks to build or upgrade (its name in the objective's text), until it is done. */
export function questBuilding(state: PlayerState): BuildingId | null {
  const o = OBJECTIVES[state.objective];
  if (!o || o.done(state)) return null;
  return BUILDING_IDS.find((id) => o.text.includes(BUILDINGS[id].name)) ?? null;
}

/** The most "upgrade possible" badges shown at once (owner, 21 October: 8 to 10 at a time brought the clutter back). */
export const BADGES_SHOWN = 3;

/**
 * Which of the `possible` upgrades show their badge: at most BADGES_SHOWN, the most useful first (the Lighthouse, then
 * the current objective's building, then the buildings furthest behind, the lowest level first); `more` counts the
 * others, shown as one discreet "+N".
 */
export function badgeUpgrades(state: PlayerState, possible: readonly BuildingId[]): { shown: BuildingId[]; more: number } {
  const quest = questBuilding(state);
  const rank = (id: BuildingId) => (id === "lighthouse" ? -2 : id === quest ? -1 : state.buildings[id]);
  const order = [...possible].sort((a, b) => rank(a) - rank(b) || BUILDING_IDS.indexOf(a) - BUILDING_IDS.indexOf(b));
  return { shown: order.slice(0, BADGES_SHOWN), more: Math.max(0, order.length - BADGES_SHOWN) };
}

/** Progress of an upgrade, from 0 to 1. */
export const progress = (job: { left: number; duration: number }): number => Math.min(1, Math.max(0, 1 - job.left / job.duration));
