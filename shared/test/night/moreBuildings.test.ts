import { describe, expect, it } from "vitest";
import { CARD_TIERS, cardPool } from "../../src/rules/night/cards.js";
import { CITY_BUILDINGS, CITY_SHAPE, newCity, parseCity, type PortalCity } from "../../src/rules/night/city.js";
import { cityPowers } from "../../src/rules/night/powers.js";
import { newNight } from "../../src/rules/night/state.js";
import { postBearing, stepNight } from "../../src/rules/night/step.js";
import { upgradeCity } from "../../src/rules/night/upgrade.js";
import { BARRACKS_PER_LEVEL, FAMILY, POST_DPS, POSTS_BASE, STEP } from "../../src/rules/night/values.js";

const city = (levels: Partial<PortalCity["buildings"]>): PortalCity => ({ ...newCity(), buildings: { ...newCity().buildings, lighthouse: 10, ...levels } });

describe("the Barracks, the Harbor and the Observatory", () => {
  it("six buildings now; the three new ones are built from nothing", () => {
    expect(CITY_BUILDINGS).toEqual(["lighthouse", "refinery", "infirmary", "barracks", "harbor", "observatory"]);
    expect(newCity().buildings).toMatchObject({ barracks: 0, harbor: 0, observatory: 0 });
    const rich = { ...city({}), stock: { wood: 9999, fish: 9999, pearls: 0 } };
    for (const b of ["barracks", "harbor", "observatory"] as const) expect(upgradeCity(rich, b).ok, b).toBe(true);
  });

  it("the Barracks: the posts' troops hit 20% harder a level", () => {
    expect(cityPowers(city({ barracks: 2 })).postMul).toBeCloseTo(1 + 2 * BARRACKS_PER_LEVEL, 9);
    const n = newNight(1, 2, cityPowers(city({ barracks: 2 })));
    const b = postBearing(0, n.posts.length);
    const s = { ...n, phase: "pause" as const, pauseEnd: 1e6, posts: n.posts.map((_, i) => (i === 0 ? "harpooners" : null)) as typeof n.posts, enemies: [{ id: 1, family: "raider" as const, bearing: b, distance: 12, health: FAMILY.raider.health, lit: 0, fade: 0, stage: 0 }], nextId: 2 };
    expect(FAMILY.raider.health - stepNight(s, { beam: (b + 180) % 360 }).enemies[0]!.health).toBeCloseTo(POST_DPS * (1 + 2 * BARRACKS_PER_LEVEL) * STEP, 9);
  });

  it("the Harbor: a raft more at levels 1, 3, 5…", () => {
    expect([0, 1, 2, 3, 5].map((h) => cityPowers(city({ harbor: h })).posts)).toEqual([POSTS_BASE, POSTS_BASE + 1, POSTS_BASE + 1, POSTS_BASE + 2, POSTS_BASE + 3]);
    expect(newNight(1, 2, cityPowers(city({ harbor: 3 }))).posts).toHaveLength(POSTS_BASE + 2);
  });

  it("the Observatory: more cards in the draw, tier by tier, all of them at level 3", () => {
    expect(cityPowers(city({ observatory: 0 })).cardTier).toBe(0);
    expect(cardPool([], 0)).toEqual([...CARD_TIERS[0]!]);
    expect(cardPool([], 1)).toHaveLength(CARD_TIERS[0]!.length + CARD_TIERS[1]!.length);
    expect(cardPool([], 3)).toHaveLength(26);
  });

  it("a Night draws only the cards its Observatory opens", () => {
    let n = newNight(7, 2, cityPowers(newCity()));
    while (n.phase === "wave") n = stepNight(n, { beam: n.enemies[0]?.bearing ?? 0 });
    expect(n.offer.every((c) => (CARD_TIERS[0] as readonly string[]).includes(c))).toBe(true);
  });

  it("a city saved before them is read with the three at 0", () => {
    const old = { v: 1, buildings: { lighthouse: 3, refinery: 2, infirmary: 1 }, stock: { wood: 5, fish: 6, pearls: 7 }, won: 2, played: 3 };
    expect(parseCity(old)).toEqual({ ...old, v: CITY_SHAPE, buildings: { ...old.buildings, barracks: 0, harbor: 0, observatory: 0 }, captains: newCity().captains, record: 0, away: 0, daily: newCity().daily });
  });
});
