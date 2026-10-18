/** The player's city: the same document for the client and the server. */
export type { PlayerState, Report } from "./types.js";
export { MAX_REPORTS, addStar, advance, catchUp, dockRaft, fleetCheck, fleetSight, heal, installOnRaft, logbook, newPlayerState, promote, readReport, repairRafts, research, sail, setLead, stoke, train, unlockCaptain, upgrade, upgradeRaft, type ActionResult, type UpgradeResult } from "./state.js";
export { MAX_REPORT_SEQ, REPORT_ID, cleanFleets, cleanQueue, parseState } from "./parse.js";
export { CITY_SHAPE, MIN_CITY_SHAPE, migrateCity, upgradeShape, type MigrationContext } from "./migrate.js";
export { ACTION_ID, applyAction, parseAction, type GameAction, type GameActionType } from "./actions.js";
export { eventsBetween, type GameEvent } from "./events.js";
