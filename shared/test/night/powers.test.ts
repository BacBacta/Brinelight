import { describe, expect, it } from "vitest";
import { newCity, type PortalCity } from "../../src/rules/night/city.js";
import { BASE_POWERS, cityPowers } from "../../src/rules/night/powers.js";
import { newNight, parseNight, type NightState } from "../../src/rules/night/state.js";
import { stepNight } from "../../src/rules/night/step.js";
import { BEAM_DPS, BEAM_PER_LEVEL, FAMILY, OIL_PER_REFINERY, RESCUE_BASE, RESCUE_PER_LEVEL, START_OIL, STEPS_PER_SECOND } from "../../src/rules/night/values.js";

const city = (lighthouse: number, refinery: number, infirmary: number): PortalCity => ({ ...newCity(), buildings: { lighthouse, refinery, infirmary } });

describe("what the city gives its Night", () => {
  it("a new city gives the base: the beam's damage, the oil, no second chance", () => {
    expect(cityPowers(newCity())).toEqual(BASE_POWERS);
    expect(BASE_POWERS).toEqual({ beamDps: BEAM_DPS, startOil: START_OIL, rescue: 0, posts: 2 });
  });

  it("the Lighthouse: the beam burns harder, level by level", () => {
    expect(cityPowers(city(3, 1, 0)).beamDps).toBeCloseTo(BEAM_DPS * (1 + 2 * BEAM_PER_LEVEL), 9);
  });

  it("the Refinery: more oil to start with", () => {
    expect(cityPowers(city(3, 3, 0)).startOil).toBe(START_OIL + 2 * OIL_PER_REFINERY);
  });

  it("the Infirmary: a second chance, larger level by level", () => {
    expect(cityPowers(city(3, 1, 1)).rescue).toBeCloseTo(RESCUE_BASE, 9);
    expect(cityPowers(city(3, 1, 3)).rescue).toBeCloseTo(RESCUE_BASE + 2 * RESCUE_PER_LEVEL, 9);
  });
});

/** One Raider at this bearing far out, the waves held back. Night 2: no grace. */
const one = (powers = BASE_POWERS, oil?: number): NightState => {
  const n = newNight(1, 2, powers);
  return { ...n, oil: oil ?? n.oil, phase: "pause", pauseEnd: 1_000_000, enemies: [{ id: 1, family: "raider", bearing: 0, distance: 28, health: FAMILY.raider.health, lit: 0, fade: 0, stage: 0 }], nextId: 2 };
};
const run = (n: NightState, steps: number, beam: number): NightState => {
  let s = n;
  for (let i = 0; i < steps; i++) s = stepNight(s, { beam });
  return s;
};

describe("the Night with its powers", () => {
  it("starts with the oil its Refinery gives", () => {
    expect(newNight(1, 1, cityPowers(city(2, 2, 0))).oil).toBe(START_OIL + OIL_PER_REFINERY);
  });

  it("a stronger beam burns a Raider sooner", () => {
    const strong = cityPowers(city(5, 1, 0));
    const steps = Math.ceil((FAMILY.raider.health / strong.beamDps) * STEPS_PER_SECOND);
    expect(steps).toBeLessThan(Math.ceil((FAMILY.raider.health / BEAM_DPS) * STEPS_PER_SECOND));
    expect(run(one(strong), steps, 0).enemies).toEqual([]);
    expect(run(one(), steps, 0).enemies).toHaveLength(1);
  });

  it("the second chance: once, when the oil runs out, the Lighthouse lights again", () => {
    const powers = cityPowers(city(2, 1, 1));
    const n = run(one(powers, 3), 400, 180);
    expect(n.phase).not.toBe("lost");
    expect(n.oil).toBe(Math.round(powers.startOil * powers.rescue));
    expect(n.rescued).toBe(true);
    // Spent: the next time the oil runs out, the Night is lost.
    const again = run({ ...n, oil: 3, enemies: one(powers).enemies, nextId: n.nextId + 1 }, 400, 180);
    expect(again.phase).toBe("lost");
  });

  it("without an Infirmary, no second chance", () => {
    expect(run(one(BASE_POWERS, 3), 400, 180).phase).toBe("lost");
  });

  it("its powers are part of the Night: read back with it, and refused out of range", () => {
    const n = newNight(5, 1, cityPowers(city(4, 3, 2)));
    expect(parseNight(JSON.parse(JSON.stringify(n)))).toEqual(n);
    for (const power of [{ ...n.power, beamDps: 0 }, { ...n.power, startOil: -1 }, { ...n.power, rescue: 2 }, { ...n.power, extra: 1 }])
      expect(parseNight({ ...n, power }), JSON.stringify(power)).toBe(null);
    expect(parseNight({ ...n, rescued: "no" })).toBe(null);
  });
});
