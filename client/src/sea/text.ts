import { BEATS, type TroopType, type Troops } from "@brinelight/shared";

export const TROOP_TYPES: readonly TroopType[] = ["boarders", "harpooners", "crossbowmen"];
export const TROOP_NAMES: Record<TroopType, string> = { boarders: "Boarders", harpooners: "Harpooners", crossbowmen: "Crossbowmen" };

/** The troop type that beats the strongest part of an enemy force: the prototype's tip after a defeat. */
export function counterTip(enemy: Troops): string {
  const top = [...TROOP_TYPES].sort((a, b) => enemy[b] - enemy[a])[0]!;
  const counter = TROOP_TYPES.find((k) => BEATS[k] === top)!;
  return `Train ${TROOP_NAMES[counter].toLowerCase()} against their ${TROOP_NAMES[top].toLowerCase()}`;
}

export const ODDS_TEXT = { easy: "Likely victory", close: "Close fight", hard: "Likely defeat. Get stronger first" } as const;
