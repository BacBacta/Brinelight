import { describe, expect, it } from "vitest";
import { COUNTER_BONUS } from "../../src/rules/combat.js";
import { newCity } from "../../src/rules/night/city.js";
import { BASE_POWERS, cityPowers } from "../../src/rules/night/powers.js";
import { newNight, parseNight, type Enemy, type NightState } from "../../src/rules/night/state.js";
import { COUNTERED_BY, postBearing, stepNight } from "../../src/rules/night/step.js";
import { FAMILY, POST_ARC, POST_DPS, POST_RANGE, STEP } from "../../src/rules/night/values.js";

const enemy = (family: Enemy["family"], bearing: number, distance = 12, id = 1): Enemy => ({ id, family, bearing, distance, health: FAMILY[family].health, lit: 0, fade: 0, stage: 0 });
/** A Night with these enemies, the waves held back, the beam turned far away (it burns nothing here). */
const sea = (enemies: Enemy[], posts: NightState["posts"]): NightState => ({ ...newNight(1, 2), phase: "pause", pauseEnd: 1_000_000, enemies, nextId: 99, posts, beam: 0 });
const away = (n: NightState) => ({ beam: (postBearing(0, n.posts.length) + 180) % 360 });

describe("the posts on the rafts", () => {
  it("a city gives two posts, empty, around the island", () => {
    expect(cityPowers(newCity()).posts).toBe(2);
    expect(BASE_POWERS.posts).toBe(2);
    expect(newNight(1, 2).posts).toEqual([null, null]);
    expect([postBearing(0, 2), postBearing(1, 2)]).toEqual([45, 225]);
  });

  it("you put a troop on a post, and change it; a post or troop that is not one changes nothing", () => {
    const n = newNight(1, 2);
    const one = stepNight(n, { beam: 0, post: { slot: 1, troop: "harpooners" } });
    expect(one.posts).toEqual([null, "harpooners"]);
    expect(stepNight(one, { beam: 0, post: { slot: 1, troop: "boarders" } }).posts).toEqual([null, "boarders"]);
    expect(stepNight(one, { beam: 0, post: { slot: 5, troop: "boarders" } }).posts).toEqual([null, "harpooners"]);
    expect(stepNight(one, { beam: 0, post: { slot: 0, troop: "dragons" as never } }).posts).toEqual([null, "harpooners"]);
  });

  it("a post fires at an enemy in its reach, on its own; its counter troop hits harder", () => {
    const b = postBearing(0, 2);
    const plain = stepNight(sea([enemy("raider", b)], ["harpooners", null]), { beam: (b + 180) % 360 }).enemies[0]!;
    expect(FAMILY.raider.health - plain.health).toBeCloseTo(POST_DPS * STEP, 9);
    const counter = stepNight(sea([enemy("raider", b)], [COUNTERED_BY.raider, null]), { beam: (b + 180) % 360 }).enemies[0]!;
    expect(FAMILY.raider.health - counter.health).toBeCloseTo(POST_DPS * STEP * COUNTER_BONUS, 9);
    expect(COUNTERED_BY).toEqual({ raider: "crossbowmen", beast: "harpooners", wraith: "boarders", galleon: "harpooners", kraken: "boarders", leviathan: "harpooners" });
  });

  it("out of its reach (too far, or round the island), a post does nothing; an empty post never fires", () => {
    const b = postBearing(0, 2);
    const far = sea([enemy("raider", b, POST_RANGE + 1)], ["crossbowmen", null]);
    expect(stepNight(far, away(far)).enemies[0]!.health).toBe(FAMILY.raider.health);
    const aside = sea([enemy("raider", (b + POST_ARC / 2 + 5) % 360)], ["crossbowmen", null]);
    expect(stepNight(aside, away(aside)).enemies[0]!.health).toBe(FAMILY.raider.health);
    const empty = sea([enemy("raider", b)], [null, null]);
    expect(stepNight(empty, away(empty)).enemies[0]!.health).toBe(FAMILY.raider.health);
  });

  it("one target at a time: the nearest to the coast", () => {
    const b = postBearing(0, 2);
    const n = stepNight(sea([enemy("raider", b, 14, 1), enemy("raider", b, 9, 2)], ["crossbowmen", null]), { beam: (b + 180) % 360 });
    expect(n.enemies.find((e) => e.id === 1)!.health).toBe(FAMILY.raider.health);
    expect(n.enemies.find((e) => e.id === 2)!.health).toBeLessThan(FAMILY.raider.health);
  });

  it("a faded Wraith the beam goes through, the posts still hit: boarders are its answer", () => {
    const b = postBearing(0, 2);
    const faded = { ...enemy("wraith", b), fade: 20 };
    const n = stepNight(sea([faded], ["boarders", null]), { beam: (b + 180) % 360 });
    expect(n.enemies[0]!.health).toBeLessThan(FAMILY.wraith.health);
  });

  it("the posts are part of the Night: read back with it, and refused when wrong", () => {
    const n = { ...newNight(3, 2), posts: ["boarders", null] as NightState["posts"] };
    expect(parseNight(JSON.parse(JSON.stringify(n)))).toEqual(n);
    expect(parseNight({ ...n, posts: ["dragons", null] })).toBe(null);
    expect(parseNight({ ...n, posts: [null] })).toBe(null);
  });
});
