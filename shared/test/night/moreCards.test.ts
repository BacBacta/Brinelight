import { describe, expect, it } from "vitest";
import { CARDS, CARD_IDS, EMBER_NEAR, TANK_OIL, cardMods } from "../../src/rules/night/cards.js";
import { lootSoFar, nightLoot } from "../../src/rules/night/loot.js";
import { newNight, parseNight, type Enemy, type NightState } from "../../src/rules/night/state.js";
import { postBearing, stepNight } from "../../src/rules/night/step.js";
import { FAMILY, LOOT_DAWN_PEARLS, LOOT_PER_BURNED, LOOT_PER_WAVE, POST_DPS, POST_RANGE, STEP, STEPS_PER_SECOND, WRAITH_FADE_AFTER, WRAITH_HIDDEN } from "../../src/rules/night/values.js";
import { COUNTER_BONUS } from "../../src/rules/combat.js";

const foe = (family: Enemy["family"], bearing = 0, distance = 28): Enemy => ({ id: 1, family, bearing, distance, health: FAMILY[family].health, lit: 0, fade: 0, stage: 0 });
/** A Night 2 holding these cards, these enemies, the waves held back. */
const held = (cards: NightState["cards"], enemies: Enemy[] = [], posts?: NightState["posts"]): NightState => {
  const n = newNight(1, 2);
  return { ...n, cards, enemies, nextId: 9, phase: "pause", pauseEnd: 1_000_000, posts: posts ?? [...n.posts, ...cards.filter((c) => c === "raft").map(() => null)] };
};
const burn = (n: NightState, beam = 0) => n.enemies[0]!.health - stepNight(n, { beam }).enemies[0]!.health;
const moved = (n: NightState, beam = 180) => n.enemies[0]!.distance - stepNight(n, { beam }).enemies[0]!.distance;
/** A Night paused with this card offered, to choose it. */
const offered = (card: NightState["cards"][number], over: Partial<NightState> = {}): NightState => ({ ...newNight(1, 2), phase: "pause", pauseEnd: 0, offer: [card], ...over });

describe("the 24 cards", () => {
  it("24 cards, each short and plain", () => {
    expect(CARD_IDS).toHaveLength(24);
    for (const id of CARD_IDS) expect(CARDS[id].text.length, id).toBeLessThan(50);
  });
});

describe("the other 16 cards, one each", () => {
  it("Focus: a narrower beam that burns 50% harder", () => {
    expect(cardMods(["focus"]).beamWidth).toBe(cardMods([]).beamWidth - 10);
    expect(burn(held(["focus"], [foe("raider")]))).toBeCloseTo(burn(held([], [foe("raider")])) * 1.5, 9);
  });

  it("Hunter: Beasts burn 40% harder; Raiders as before", () => {
    expect(burn(held(["hunter"], [foe("beast")]))).toBeCloseTo(burn(held([], [foe("beast")])) * 1.4, 9);
    expect(burn(held(["hunter"], [foe("raider")]))).toBeCloseTo(burn(held([], [foe("raider")])), 9);
  });

  it("Ghostlight: a Wraith is lit 0.3 s longer before it fades", () => {
    expect(cardMods(["ghostlight"]).fadeAfter).toBeCloseTo(WRAITH_FADE_AFTER + 0.3, 9);
    let n = held(["ghostlight"], [foe("wraith")]);
    for (let i = 0; i < Math.round(WRAITH_FADE_AFTER * STEPS_PER_SECOND); i++) n = stepNight(n, { beam: 0 });
    expect(n.enemies[0]!.fade).toBe(0);
  });

  it("Ember: 25% harder near land, as before farther out", () => {
    expect(burn(held(["ember"], [foe("beast", 0, EMBER_NEAR - 1)]))).toBeCloseTo(burn(held([], [foe("beast", 0, EMBER_NEAR - 1)])) * 1.25, 9);
    expect(burn(held(["ember"], [foe("beast", 0, 25)]))).toBeCloseTo(burn(held([], [foe("beast", 0, 25)])), 9);
  });

  it("Drill: posts 15% harder and 2 farther", () => {
    expect(cardMods(["drill"]).postDps).toBeCloseTo(POST_DPS * 1.15, 9);
    expect(cardMods(["drill"]).postRange).toBe(POST_RANGE + 2);
  });

  it("Know your foe: a troop on what it beats hits 1.5 times, not 1.2", () => {
    const b = postBearing(0, 2);
    const n = held(["foe"], [foe("raider", b, 12)], ["crossbowmen", null]);
    expect(burn(n, (b + 180) % 360)).toBeCloseTo(POST_DPS * (COUNTER_BONUS + 0.3) * STEP, 9);
  });

  it("Third raft: one more post, empty, at once", () => {
    const n = stepNight(offered("raft"), { beam: 0, card: "raft" });
    expect(n.posts).toEqual([null, null, null]);
    expect(parseNight(JSON.parse(JSON.stringify(n)))).toEqual(n);
    expect(parseNight({ ...n, posts: [null, null] })).toBe(null);
  });

  it("Nets: an enemy a post reaches comes 25% slower", () => {
    const b = postBearing(0, 2);
    const netted = held(["nets"], [foe("beast", b, 14)], ["boarders", null]);
    const free = held([], [foe("beast", b, 14)], ["boarders", null]);
    expect(moved(netted, (b + 180) % 360)).toBeCloseTo(moved(free, (b + 180) % 360) * 0.75, 9);
  });

  it("Deep tanks: 20 more oil held, poured at once", () => {
    const n = stepNight(offered("tanks", { oil: 100 }), { beam: 0, card: "tanks" });
    expect(n.oil).toBe(100 + TANK_OIL);
    expect(cardMods(["tanks", "tanks"]).extraOil).toBe(2 * TANK_OIL);
  });

  it("Patches and Seawall: Raiders steal 1 less, Beasts 5 less", () => {
    expect(cardMods(["patch"]).steal.raider).toBe(FAMILY.raider.oil - 1);
    expect(cardMods(["seawall"]).steal.beast).toBe(FAMILY.beast.oil - 5);
    const landed = stepNight(held(["patch"], [foe("raider", 0, 6.05)]), { beam: 180 });
    expect(landed.oil).toBe(landed.power.startOil - (FAMILY.raider.oil - 1));
  });

  it("Salvage and Fish shoal: more wood a boat burned, more fish a wave held", () => {
    const n = { ...held(["salvage", "shoal"]), burned: 10, wave: 2 };
    expect(lootSoFar(n)).toMatchObject({ wood: 2 * LOOT_PER_WAVE.wood + 10 * (LOOT_PER_BURNED.wood + 2), fish: 2 * (LOOT_PER_WAVE.fish + 20) });
  });

  it("Low fog: a faded Wraith shows again half a second sooner", () => {
    expect(cardMods(["fog"]).hidden).toBeCloseTo(WRAITH_HIDDEN - 0.5, 9);
  });

  it("Headwind: Raiders 20% slower, Beasts as before", () => {
    expect(moved(held(["headwind"], [foe("raider")]))).toBeCloseTo(moved(held([], [foe("raider")])) * 0.8, 9);
    expect(moved(held(["headwind"], [foe("beast")]))).toBeCloseTo(moved(held([], [foe("beast")])), 9);
  });

  it("Lucky star: 5 more Pearls at dawn, if the Night is won", () => {
    expect(nightLoot({ ...held(["star"]), phase: "won", wave: 8 }).pearls).toBe(LOOT_DAWN_PEARLS + 5);
    expect(nightLoot({ ...held(["star"]), phase: "lost", oil: 0 }).pearls).toBe(0);
  });
});
