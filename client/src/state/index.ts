/**
 * The client side of the city: the browser clock (tick, elapse, DEV_SPEED) and the local save.
 * The city itself and what changes it come from @brinelight/shared, re-exported here for the client's modules.
 */
export { MAX_REPORTS, advance, catchUp, newPlayerState, parseState, readReport, sail, upgrade, type ActionResult, type PlayerState, type Report, type UpgradeResult } from "@brinelight/shared";
export { AWAY_AFTER, elapse, tick } from "./time.js";
export { REJECTED_KEY, SAVE_KEY, browserStore, loadGame, migrateSave, openSave, saveGame, type KeyValueStore, type OpenedSave } from "./save.js";
export { DEV_SPEED, SAVE_EVERY_MS } from "./config.js";
