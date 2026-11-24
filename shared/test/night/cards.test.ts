import { describe, expect, it } from "vitest";
import { CARDS, CARD_IDS, cardMods, cardPool } from "../../src/rules/night/cards.js";
import { newNight, parseNight, type NightState } from "../../src/rules/night/state.js";
import { inBeam, stepNight, type NightInput } from "../../src/rules/night/step.js";
import { BEAM_WIDTH, FAMILY, POST_DPS, STEP } from "../../src/rules/night/values.js";

/** Plays until the first pause, the beam always on the nearest enemy. */
const aim = (n: NightState): NightInput => ({ beam: n.enemies.reduce<NightState["enemies"][number] | null>((a, e) => (!a || e.distance < a.distance ? e : a), null)?.bearing ?? n.beam });
const toPause = (seed = 5, night = 1): NightState => {
  let n = newNight(seed, night);
  while (n.phase === "wave") n = stepNight(n, aim(n));
  return n;
};

describe("the cards: one of three after each wave", () => {
  it("after a wave, three different cards are offered, drawn from the seed", () => {
    const n = toPause();
    expect(n.phase).toBe("pause");
    expect(n.offer).toHaveLength(3);
    expect(new Set(n.offer).size).toBe(3);
    expect(n.offer.every((c) => CARD_IDS.includes(c))).toBe(true);
    expect(toPause().offer).toEqual(n.offer);
    expect(toPause(6).offer).not.toEqual(n.offer);
  });

  it("the next wave waits until you choose; your card is held, the offer gone", () => {
    let n = toPause();
    for (let i = 0; i < 400; i++) n = stepNight(n, { beam: 0 });
    expect(n.phase).toBe("pause");
    const pick = n.offer[1]!;
    n = stepNight(n, { beam: 0, card: pick });
    expect(n.cards).toEqual([pick]);
    expect(n.offer).toEqual([]);
    n = stepNight(n, { beam: 0 });
    expect(n.phase).toBe("wave");
    expect(n.wave).toBe(2);
  });

  it("a card not offered, or none, changes nothing", () => {
    const n = toPause();
    const other = CARD_IDS.find((c) => !n.offer.includes(c))!;
    const after = stepNight(n, { beam: 0, card: other });
    expect(after.cards).toEqual([]);
    expect(after.offer).toEqual(n.offer);
  });

  it("a card at its most is no longer drawn", () => {
    expect(cardPool(["wide", "wide", "wide"])).not.toContain("wide");
    expect(cardPool(["wide", "wide"])).toContain("wide");
    expect(cardPool([])).toEqual([...CARD_IDS]);
  });

  it("each card's text is short and plain", () => {
    for (const id of CARD_IDS) {
      expect(CARDS[id].name.length, id).toBeLessThan(20);
      expect(CARDS[id].text.length, id).toBeLessThan(50);
    }
  });
});

describe("what each card does, stacking as it says", () => {
  const far = (n: NightState) => ({ ...n, phase: "pause" as const, pauseEnd: 1_000_000, offer: [] });

  it("Wider beam: 10° more, each time", () => {
    expect(cardMods(["wide", "wide"]).beamWidth).toBe(BEAM_WIDTH + 20);
    expect(inBeam(0, BEAM_WIDTH / 2 + 8, BEAM_WIDTH + 20)).toBe(true);
    expect(inBeam(0, BEAM_WIDTH / 2 + 8)).toBe(false);
  });

  it("Brighter beam: 25 % more damage, each time", () => {
    const n = far({ ...newNight(1, 2), cards: ["bright", "bright"], enemies: [{ id: 1, family: "raider", bearing: 0, distance: 28, health: FAMILY.raider.health, lit: 0, fade: 0, stage: 0 }], nextId: 2 });
    const hit = FAMILY.raider.health - stepNight(n, { beam: 0 }).enemies[0]!.health;
    expect(hit).toBeCloseTo(n.power.beamDps * 1.5 * STEP, 9);
  });

  it("Sharp posts: 30 % more damage from each post", () => {
    expect(cardMods(["sharp"]).postDps).toBeCloseTo(POST_DPS * 1.3, 9);
  });

  it("Long reach and Wide watch: the posts reach farther and wider", () => {
    const m = cardMods(["reach", "arc", "arc"]);
    expect(m.postRange).toBe(cardMods([]).postRange + 4);
    expect(m.postArc).toBe(cardMods([]).postArc + 40);
  });

  it("Oil barrel: 25 oil at once, never above the Night's own", () => {
    let n = toPause();
    n = { ...n, oil: 50, offer: (["barrel", ...n.offer.filter((c) => c !== "barrel")] as NightState["offer"]).slice(0, 3) };
    expect(stepNight(n, { beam: 0, card: "barrel" }).oil).toBe(75);
    expect(stepNight({ ...n, oil: 90 }, { beam: 0, card: "barrel" }).oil).toBe(n.power.startOil);
  });

  it("Tar pots: 3 oil back each wave held, each time", () => {
    expect(cardMods(["tar", "tar"]).oilPerWave).toBe(6);
  });

  it("Slack tide: the enemies come 15 % slower", () => {
    expect(cardMods(["tide"]).speed).toBeCloseTo(0.85, 9);
    const n = far({ ...newNight(1, 2), cards: ["tide"], enemies: [{ id: 1, family: "raider", bearing: 0, distance: 28, health: FAMILY.raider.health, lit: 0, fade: 0, stage: 0 }], nextId: 2 });
    expect(28 - stepNight(n, { beam: 180 }).enemies[0]!.distance).toBeCloseTo(FAMILY.raider.speed * 0.85 * STEP, 9);
  });

  it("the cards are part of the Night: read back with it, and refused when wrong", () => {
    const n = { ...toPause(), cards: ["wide", "tar"] as NightState["cards"] };
    expect(parseNight(JSON.parse(JSON.stringify(n)))).toEqual(n);
    expect(parseNight({ ...n, cards: ["crown"] })).toBe(null);
    expect(parseNight({ ...n, offer: ["wide", "wide", "tar"] })).toBe(null);
  });
});
