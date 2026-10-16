import { BUILDING_IDS, fleetsMax, maxLevel, parseState, type PlayerState } from "@brinelight/shared";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Reads a city sent by the client (PUT /city, temporary, removed in week 4). Stricter than parseState:
 * nothing may be dropped or repaired on the way, and the city must hold together. Null when refused:
 * - parseState refuses it, or it would drop a job or a fleet;
 * - a building is above its highest level (`maxLevel`), or its level is not a whole number;
 * - a job upgrades a building already at its highest level;
 * - more fleets are at sea than the Harbor allows (`fleetsMax`).
 */
export function readSentCity(raw: unknown): PlayerState | null {
  const state = parseState(raw);
  if (!state || !isObj(raw) || !Array.isArray(raw.queue) || !Array.isArray(raw.fleets)) return null;
  if (raw.fleets.length > fleetsMax(state.buildings.harbor)) return null;
  if (state.queue.length !== raw.queue.length || state.fleets.length !== raw.fleets.length) return null;
  for (const id of BUILDING_IDS) {
    const level = state.buildings[id];
    if (!Number.isInteger(level) || level < 0 || level > maxLevel(id, state.buildings)) return null;
  }
  if (state.queue.some((job) => state.buildings[job.id] >= maxLevel(job.id, state.buildings))) return null;
  return state;
}
