export type { PlayerState, Report } from "./types.js";
export { AWAY_AFTER, MAX_REPORTS, advance, catchUp, elapse, newPlayerState, readReport, sail, tick, upgrade, type ActionResult, type UpgradeResult } from "./state.js";
export { SAVE_KEY, browserStore, cleanFleets, cleanQueue, loadGame, saveGame, type KeyValueStore } from "./save.js";
export { DEV_SPEED, SAVE_EVERY_MS } from "./config.js";
