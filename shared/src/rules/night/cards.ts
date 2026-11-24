/**
 * The cards (Hold the Light): after each wave but the last, three different cards are drawn from the Night's seed (free,
 * never bought); you choose one and keep it until dawn. A card can be taken again, up to its most.
 */
import { BEAM_WIDTH, POST_ARC, POST_DPS, POST_RANGE } from "./values.js";

export const CARD_IDS = ["wide", "bright", "sharp", "reach", "arc", "barrel", "tar", "tide"] as const;
export type CardId = (typeof CARD_IDS)[number];

export type Card = { group: "beam" | "posts" | "oil" | "sea"; name: string; text: string; most: number };

export const CARDS: Readonly<Record<CardId, Card>> = {
  wide: { group: "beam", name: "Wider beam", text: "Your beam is 10° wider.", most: 3 },
  bright: { group: "beam", name: "Brighter beam", text: "Your beam burns 25% harder.", most: 5 },
  sharp: { group: "posts", name: "Sharp posts", text: "Your posts hit 30% harder.", most: 5 },
  reach: { group: "posts", name: "Long reach", text: "Your posts reach 4 farther.", most: 3 },
  arc: { group: "posts", name: "Wide watch", text: "Your posts cover 20° more.", most: 3 },
  barrel: { group: "oil", name: "Oil barrel", text: "25 oil, now.", most: Number.POSITIVE_INFINITY },
  tar: { group: "oil", name: "Tar pots", text: "3 oil back after each wave.", most: 5 },
  tide: { group: "sea", name: "Slack tide", text: "Enemies come 15% slower.", most: 2 },
};

/** Oil a barrel gives at once. */
export const BARREL_OIL = 25;

const count = (held: readonly CardId[], id: CardId): number => held.filter((c) => c === id).length;

/** The cards that can still be drawn: those not held at their most. */
export const cardPool = (held: readonly CardId[]): CardId[] => CARD_IDS.filter((id) => count(held, id) < CARDS[id].most);

/** What the cards held change in the Night. */
export function cardMods(held: readonly CardId[]) {
  const n = (id: CardId) => count(held, id);
  return {
    beamWidth: BEAM_WIDTH + 10 * n("wide"),
    beamMul: 1 + 0.25 * n("bright"),
    postDps: POST_DPS * (1 + 0.3 * n("sharp")),
    postRange: POST_RANGE + 4 * n("reach"),
    postArc: POST_ARC + 20 * n("arc"),
    oilPerWave: 3 * n("tar"),
    speed: 0.85 ** n("tide"),
  };
}
