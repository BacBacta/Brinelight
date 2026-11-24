import { describe, expect, it } from "vitest";
import { newNight, parseNight, type Enemy, type NightState } from "../../src/rules/night/state.js";
import { COUNTERED_BY, stepNight, wavesOf } from "../../src/rules/night/step.js";
import { BOSS_RAGE, BOSS_SUMMON, BOSS_WAVE, FAMILY, STEP } from "../../src/rules/night/values.js";

const galleon = (health = FAMILY.galleon.health, stage = 0, distance = 28): Enemy => ({ id: 1, family: "galleon", bearing: 0, distance, health, lit: 0, fade: 0, stage });
const alone = (e: Enemy, night = 4): NightState => ({ ...newNight(1, night), phase: "pause", pauseEnd: 1_000_000, enemies: [e], nextId: 2 });

describe("the boss of wave 10: the Mist Galleon", () => {
  it("slow, very tough, a great thief; harpooners beat it", () => {
    expect(FAMILY.galleon.speed).toBeLessThan(FAMILY.beast.speed);
    expect(FAMILY.galleon.health).toBeGreaterThan(5 * FAMILY.beast.health);
    expect(FAMILY.galleon.oil).toBeGreaterThanOrEqual(50);
    expect(COUNTERED_BY.galleon).toBe("harpooners");
  });

  it("comes at the start of wave 10, in the Nights that have one, and only there", () => {
    expect(BOSS_WAVE).toBe(10);
    expect(wavesOf(4)).toBeGreaterThanOrEqual(BOSS_WAVE);
    const at = (night: number, wave: number) => stepNight({ ...newNight(3, night), wave, spawned: 0, nextSpawn: 0 }, { beam: 180 }).enemies.map((e) => e.family);
    expect(at(4, 10)).toContain("galleon");
    expect(at(4, 9)).not.toContain("galleon");
    expect(at(3, 9)).not.toContain("galleon");
  });

  it("at two thirds of its health it sends three Raiders around it, once", () => {
    const hurt = alone(galleon((FAMILY.galleon.health * 2) / 3 + 0.5));
    const n = stepNight(hurt, { beam: 0 });
    expect(n.enemies.filter((e) => e.family === "raider")).toHaveLength(BOSS_SUMMON);
    expect(n.enemies.find((e) => e.family === "galleon")!.stage).toBe(1);
    expect(stepNight(n, { beam: 0 }).enemies.filter((e) => e.family === "raider")).toHaveLength(BOSS_SUMMON);
  });

  it("at a third it rages: faster", () => {
    const n = alone(galleon(FAMILY.galleon.health / 3 - 1, 1));
    const raged = stepNight(n, { beam: 180 });
    const g = raged.enemies.find((e) => e.family === "galleon")!;
    expect(g.stage).toBe(2);
    expect(n.enemies[0]!.distance - g.distance).toBeCloseTo(FAMILY.galleon.speed * BOSS_RAGE * STEP, 9);
  });

  it("on the coast, it steals its oil", () => {
    const n = stepNight(alone(galleon(FAMILY.galleon.health, 0, 6.01)), { beam: 180 });
    expect(n.oil).toBe(Math.max(0, n.power.startOil - FAMILY.galleon.oil));
  });

  it("its stage is part of the Night, read back with it", () => {
    const n = alone(galleon(900, 1));
    expect(parseNight(JSON.parse(JSON.stringify(n)))).toEqual(n);
    expect(parseNight({ ...n, enemies: [{ ...galleon(), stage: 3 }] })).toBe(null);
  });
});
