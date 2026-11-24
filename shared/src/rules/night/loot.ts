/** What a Night brings back at dawn (Hold the Light), won or lost: a lost Night still pays a little. */
import type { NightState } from "./state.js";
import { wavesOf } from "./step.js";
import { LOOT_DAWN_PEARLS, LOOT_FLOOR, LOOT_PER_BURNED, LOOT_PER_WAVE } from "./values.js";

export type Loot = { wood: number; fish: number; pearls: number };

/** The waves this Night has cleared so far. */
export const wavesCleared = (n: NightState): number => (n.phase === "won" ? wavesOf(n.night) : n.phase === "pause" ? n.wave : n.wave - 1);

/** The loot of a Night as it stands: the waves cleared, the enemies burned, and Pearls if it was won. */
export function nightLoot(n: NightState): Loot {
  const waves = wavesCleared(n);
  return {
    wood: Math.max(LOOT_FLOOR.wood, waves * LOOT_PER_WAVE.wood + n.burned * LOOT_PER_BURNED.wood),
    fish: waves * LOOT_PER_WAVE.fish,
    pearls: n.phase === "won" ? LOOT_DAWN_PEARLS : 0,
  };
}
