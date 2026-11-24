/**
 * The cards (Hold the Light): after each wave but the last, three different cards are drawn from the Night's seed (free,
 * never bought); you choose one and keep it until dawn. A card can be taken again, up to its most.
 */
import { COUNTER_BONUS } from "../combat.js";
import { BEAM_WIDTH, FAMILY, POST_ARC, POST_DPS, POST_RANGE, WRAITH_FADE_AFTER, WRAITH_HIDDEN } from "./values.js";

export const CARD_IDS = [
  "wide", "bright", "sharp", "reach", "arc", "barrel", "tar", "tide",
  "focus", "hunter", "ghostlight", "ember", "drill", "foe", "raft", "nets",
  "tanks", "patch", "seawall", "salvage", "fog", "headwind", "shoal", "star",
] as const;
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
  focus: { group: "beam", name: "Focus", text: "Beam 10° narrower, 50% harder.", most: 2 },
  hunter: { group: "beam", name: "Hunter", text: "Your beam burns Beasts 40% harder.", most: 3 },
  ghostlight: { group: "beam", name: "Ghostlight", text: "Wraiths take longer to fade.", most: 2 },
  ember: { group: "beam", name: "Ember", text: "Your beam burns 25% harder near land.", most: 3 },
  drill: { group: "posts", name: "Drill", text: "Posts hit 15% harder, reach 2 farther.", most: 3 },
  foe: { group: "posts", name: "Know your foe", text: "Troops hit what they beat even harder.", most: 1 },
  raft: { group: "posts", name: "Third raft", text: "One more raft for your troops.", most: 2 },
  nets: { group: "posts", name: "Nets", text: "Enemies your posts reach come slower.", most: 2 },
  tanks: { group: "oil", name: "Deep tanks", text: "Hold 20 more oil, filled now.", most: 3 },
  patch: { group: "oil", name: "Patches", text: "Raiders steal 1 less oil.", most: 3 },
  seawall: { group: "oil", name: "Seawall", text: "Beasts steal 5 less oil.", most: 2 },
  salvage: { group: "oil", name: "Salvage", text: "Each boat burned: 2 more wood.", most: 3 },
  fog: { group: "sea", name: "Low fog", text: "Faded Wraiths show again sooner.", most: 2 },
  headwind: { group: "sea", name: "Headwind", text: "Raiders come 20% slower.", most: 2 },
  shoal: { group: "sea", name: "Fish shoal", text: "20 more fish for each wave held.", most: 3 },
  star: { group: "sea", name: "Lucky star", text: "5 more Pearls if you hold till dawn.", most: 2 },
};

/** Oil a barrel gives at once. */
export const BARREL_OIL = 25;

const count = (held: readonly CardId[], id: CardId): number => held.filter((c) => c === id).length;

/** The cards that can still be drawn: those not held at their most. */
export const cardPool = (held: readonly CardId[]): CardId[] => CARD_IDS.filter((id) => count(held, id) < CARDS[id].most);

/** Oil Deep tanks hold more, and pour at once. */
export const TANK_OIL = 20;
/** How near land Ember burns harder, in sea units from the Lighthouse. */
export const EMBER_NEAR = 12;

/** What the cards held change in the Night. */
export function cardMods(held: readonly CardId[]) {
  const n = (id: CardId) => count(held, id);
  return {
    beamWidth: BEAM_WIDTH + 10 * n("wide") - 10 * n("focus"),
    beamMul: 1 + 0.25 * n("bright") + 0.5 * n("focus"),
    beastMul: 1 + 0.4 * n("hunter"),
    nearMul: 1 + 0.25 * n("ember"),
    fadeAfter: WRAITH_FADE_AFTER + 0.3 * n("ghostlight"),
    hidden: Math.max(0.3, WRAITH_HIDDEN - 0.5 * n("fog")),
    postDps: POST_DPS * (1 + 0.3 * n("sharp") + 0.15 * n("drill")),
    postRange: POST_RANGE + 4 * n("reach") + 2 * n("drill"),
    postArc: POST_ARC + 20 * n("arc"),
    counter: COUNTER_BONUS + 0.3 * n("foe"),
    rafts: n("raft"),
    netSlow: 1 - 0.25 * n("nets"),
    extraOil: TANK_OIL * n("tanks"),
    oilPerWave: 3 * n("tar"),
    steal: { raider: Math.max(1, FAMILY.raider.oil - n("patch")), beast: Math.max(5, FAMILY.beast.oil - 5 * n("seawall")), wraith: FAMILY.wraith.oil },
    speed: 0.85 ** n("tide"),
    raiderSpeed: 0.8 ** n("headwind"),
    woodPerBurned: 2 * n("salvage"),
    fishPerWave: 20 * n("shoal"),
    pearls: 5 * n("star"),
  };
}
