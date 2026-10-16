/**
 * What a player does to the city, as a message: the client sends an action, the server applies it with these rules.
 * Pure: no clock and no randomness. The server advances the city to now before applying an action.
 */
import { BUILDING_IDS } from "../rules/buildings.js";
import { TECHS, type TechId } from "../rules/research.js";
import { seaSite } from "../rules/sea.js";
import type { BuildingId } from "../rules/types.js";
import { REPORT_ID } from "./parse.js";
import { readReport, research, sail, upgrade, type ActionResult } from "./state.js";
import type { PlayerState } from "./types.js";

/** Every action carries an id made by the client (a UUID), so the server never applies it twice. */
export type GameAction =
  | { id: string; type: "upgrade"; building: BuildingId }
  | { id: string; type: "sail"; site: string }
  | { id: string; type: "readReport"; reportId: string }
  | { id: string; type: "research"; tech: TechId };

export type GameActionType = GameAction["type"];

/** A version 4 UUID in lowercase, as crypto.randomUUID() makes it. */
export const ACTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The exact fields of each action, beyond `id` and `type`. */
const FIELDS: Record<GameActionType, readonly string[]> = {
  upgrade: ["building"],
  sail: ["site"],
  readReport: ["reportId"],
  research: ["tech"],
};

/** Longest string read from an action, checked before anything else. */
const MAX_TEXT = 64;

const shortText = (v: unknown, max = MAX_TEXT): v is string => typeof v === "string" && v.length <= max;

/**
 * Applies an action with the shared rules. The city it receives is never changed: a new city comes back,
 * or the rule's refusal with its reason, word for word.
 */
export function applyAction(state: PlayerState, action: GameAction): ActionResult {
  switch (action.type) {
    case "upgrade":
      return upgrade(state, action.building);
    case "sail":
      return sail(state, action.site);
    case "readReport":
      return { ok: true, state: readReport(state, action.reportId) };
    case "research":
      return research(state, action.tech);
  }
}

/**
 * Reads an action sent by a client. Strict: an object with exactly the fields of its type, a UUID id,
 * a known building, site or report id. Anything else gives null. Never throws.
 */
export function parseAction(raw: unknown): GameAction | null {
  try {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const o = raw as Record<string, unknown>;
    const { id, type } = o;
    if (!shortText(id, 36) || !ACTION_ID.test(id)) return null;
    if (!shortText(type) || !Object.prototype.hasOwnProperty.call(FIELDS, type)) return null;
    const t = type as GameActionType;
    const expected = ["id", "type", ...FIELDS[t]].sort();
    const keys = Object.keys(o).sort();
    if (keys.length !== expected.length || keys.some((k, i) => k !== expected[i])) return null;
    switch (t) {
      case "upgrade": {
        const b = o.building;
        return shortText(b) && (BUILDING_IDS as readonly string[]).includes(b) ? { id, type: t, building: b as BuildingId } : null;
      }
      case "sail": {
        const site = o.site;
        return shortText(site) && seaSite(site) ? { id, type: t, site } : null;
      }
      case "readReport": {
        const r = o.reportId;
        return shortText(r, 10) && REPORT_ID.test(r) ? { id, type: t, reportId: r } : null;
      }
      case "research": {
        const tech = o.tech;
        return shortText(tech) && Object.prototype.hasOwnProperty.call(TECHS, tech) ? { id, type: t, tech: tech as TechId } : null;
      }
    }
  } catch {
    return null;
  }
}
