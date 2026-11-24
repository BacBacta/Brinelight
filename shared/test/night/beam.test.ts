import { describe, expect, it } from "vitest";
import { newNight, type NightState } from "../../src/rules/night/state.js";
import { inBeam, stepNight } from "../../src/rules/night/step.js";
import { BEAM_DPS, BEAM_WIDTH, FAMILY, STEPS_PER_SECOND } from "../../src/rules/night/values.js";

/** One Raider far out at this bearing, the waves held back. */
const one = (bearing: number): NightState => ({
  ...newNight(1, 1),
  phase: "pause",
  pauseEnd: 1_000_000,
  enemies: [{ id: 1, family: "raider", bearing, distance: 28, health: FAMILY.raider.health }],
  nextId: 2,
});
const run = (n: NightState, steps: number, beam: number): NightState => {
  let s = n;
  for (let i = 0; i < steps; i++) s = stepNight(s, { beam });
  return s;
};

describe("the beam", () => {
  it("an enemy in it dies in the steps its health says", () => {
    const steps = Math.ceil((FAMILY.raider.health / BEAM_DPS) * STEPS_PER_SECOND);
    expect(run(one(0), steps - 1, 0).enemies).toHaveLength(1);
    expect(run(one(0), steps, 0).enemies).toEqual([]);
  });

  it("burns a little each step, as its damage a second says", () => {
    expect(run(one(0), 1, 0).enemies[0]!.health).toBeCloseTo(FAMILY.raider.health - BEAM_DPS / STEPS_PER_SECOND, 9);
  });

  it("on its edge an enemy is lit; just outside, it is not", () => {
    const half = BEAM_WIDTH / 2;
    expect(inBeam(0, half)).toBe(true);
    expect(inBeam(0, -half + 360)).toBe(true);
    expect(inBeam(0, half + 0.01)).toBe(false);
    expect(run(one(half + 0.01), 30, 0).enemies[0]!.health).toBe(FAMILY.raider.health);
  });

  it("across north: 350° and 10° are 20° apart, whatever side", () => {
    expect(inBeam(350, 10)).toBe(true);
    expect(inBeam(10, 350)).toBe(true);
    expect(inBeam(355, 30)).toBe(false);
    expect(run(one(10), 15, 350).enemies).toEqual([]);
  });

  it("burns every enemy it lights at once", () => {
    const two: NightState = { ...one(0), enemies: [one(0).enemies[0]!, { id: 2, family: "raider", bearing: 5, distance: 20, health: FAMILY.raider.health }], nextId: 3 };
    expect(run(two, 15, 0).enemies).toEqual([]);
  });
});
