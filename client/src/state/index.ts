export type { PlayerState } from "./types.js";
export { AWAY_AFTER, advance, catchUp, elapse, newPlayerState, tick, upgrade, type UpgradeResult } from "./state.js";
export { SAVE_KEY, browserStore, cleanQueue, loadGame, saveGame, type KeyValueStore } from "./save.js";
export { DEV_SPEED, SAVE_EVERY_MS } from "./config.js";
