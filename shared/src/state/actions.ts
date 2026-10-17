/**
 * What a player does to the city, as a message: the client sends an action, the server applies it with these rules.
 * Pure: no clock and no randomness. The server advances the city to now before applying an action.
 */
import { BUILDING_IDS } from "../rules/buildings.js";
import { CAPTAINS, type CaptainId } from "../rules/captains.js";
import { BEATS } from "../rules/combat.js";
import { RAFT_BUILDINGS, RAFT_SLOTS, type RaftBuildingId } from "../rules/rafts.js";
import { TECHS, type TechId } from "../rules/research.js";
import { seaSite } from "../rules/sea.js";
import type { BuildingId, TroopType } from "../rules/types.js";
import { REPORT_ID } from "./parse.js";
import { addStar, dockRaft, heal, installOnRaft, logbook, promote, readReport, research, sail, setLead, train, unlockCaptain, upgrade, upgradeRaft, type ActionResult } from "./state.js";
import type { PlayerState } from "./types.js";

/** Every action carries an id made by the client (a UUID), so the server never applies it twice. */
export type GameAction =
  | { id: string; type: "upgrade"; building: BuildingId }
  | { id: string; type: "sail"; site: string }
  | { id: string; type: "readReport"; reportId: string }
  | { id: string; type: "research"; tech: TechId }
  | { id: string; type: "dockRaft"; slot: string }
  | { id: string; type: "train"; troop: TroopType }
  | { id: string; type: "heal" }
  | { id: string; type: "promote"; troop: TroopType }
  | { id: string; type: "installOnRaft"; slot: string; building: RaftBuildingId }
  | { id: string; type: "upgradeRaft"; slot: string }
  | { id: string; type: "setLead"; captain: CaptainId }
  | { id: string; type: "logbook" }
  | { id: string; type: "unlockCaptain"; captain: CaptainId }
  | { id: string; type: "addStar"; captain: CaptainId };

export type GameActionType = GameAction["type"];

/** A version 4 UUID in lowercase, as crypto.randomUUID() makes it. */
export const ACTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The exact fields of each action, beyond `id` and `type`. */
const FIELDS: Record<GameActionType, readonly string[]> = {
  upgrade: ["building"],
  sail: ["site"],
  readReport: ["reportId"],
  research: ["tech"],
  dockRaft: ["slot"],
  train: ["troop"],
  heal: [],
  promote: ["troop"],
  installOnRaft: ["slot", "building"],
  upgradeRaft: ["slot"],
  setLead: ["captain"],
  logbook: [],
  unlockCaptain: ["captain"],
  addStar: ["captain"],
};

const SLOTS = new Set(RAFT_SLOTS.map((s) => s.key));

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
    case "dockRaft":
      return dockRaft(state, action.slot);
    case "train":
      return train(state, action.troop);
    case "heal":
      return heal(state);
    case "promote":
      return promote(state, action.troop);
    case "installOnRaft":
      return installOnRaft(state, action.slot, action.building);
    case "upgradeRaft":
      return upgradeRaft(state, action.slot);
    case "setLead":
      return setLead(state, action.captain);
    case "logbook":
      return logbook(state);
    case "unlockCaptain":
      return unlockCaptain(state, action.captain);
    case "addStar":
      return addStar(state, action.captain);
  }
}

/**
 * Reads an action sent by a client. Strict: an object with exactly the fields of its type, a UUID id,
 * a known building, site, report id, research, slot, troop type, raft building or captain. Anything else gives null. Never throws.
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
      case "dockRaft":
      case "upgradeRaft": {
        // The slot only: the level is the city's, never the client's.
        const slot = o.slot;
        return shortText(slot, 8) && SLOTS.has(slot) ? { id, type: t, slot } : null;
      }
      case "installOnRaft": {
        const { slot, building } = o;
        return shortText(slot, 8) && SLOTS.has(slot) && shortText(building) && Object.prototype.hasOwnProperty.call(RAFT_BUILDINGS, building)
          ? { id, type: t, slot, building: building as RaftBuildingId }
          : null;
      }
      case "train":
      case "promote": {
        // The troop type only: the number of soldiers is the rule's, never the client's.
        const troop = o.troop;
        return shortText(troop) && Object.prototype.hasOwnProperty.call(BEATS, troop) ? { id, type: t, troop: troop as TroopType } : null;
      }
      case "heal":
        // No field: every wounded of the city is healed, never a number a client chose.
        return { id, type: t };
      case "logbook":
        // No field: the lead captain and the Pearls are the city's; the experience is the rule's.
        return { id, type: t };
      case "setLead":
      case "unlockCaptain":
      case "addStar": {
        // The captain only: never a number of shards, stars or experience.
        const captain = o.captain;
        return shortText(captain) && Object.prototype.hasOwnProperty.call(CAPTAINS, captain) ? { id, type: t, captain: captain as CaptainId } : null;
      }
    }
  } catch {
    return null;
  }
}
