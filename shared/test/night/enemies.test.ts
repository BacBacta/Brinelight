import { describe, expect, it } from "vitest";
import { newNight, type Enemy, type NightState } from "../../src/rules/night/state.js";
import { stepNight } from "../../src/rules/night/step.js";
import { COAST_RADIUS, FAMILY, START_OIL, STEPS_PER_SECOND } from "../../src/rules/night/values.js";

/** A Night with these enemies on the sea, its waves held back (nothing more comes) and the beam turned away. Night 2: no grace. */
const sea = (enemies: Omit<Enemy, "id">[], oil = START_OIL): NightState => ({
  ...newNight(1, 2),
  oil,
  phase: "pause",
  pauseEnd: 1_000_000,
  enemies: enemies.map((e, i) => ({ ...e, id: i + 1 })),
  nextId: enemies.length + 1,
});
const raider = (bearing: number, distance: number): Omit<Enemy, "id"> => ({ family: "raider", bearing, distance, health: FAMILY.raider.health });
/** Steps the Night n times, the beam held where it is told (180°, away from the enemies at 0°). */
const run = (n: NightState, steps: number, beam = 180): NightState => {
  let s = n;
  for (let i = 0; i < steps; i++) s = stepNight(s, { beam });
  return s;
};

describe("an enemy's way to the coast", () => {
  it("comes on its bearing at its speed, and reaches the coast in the steps its speed says", () => {
    const from = 20;
    const steps = Math.ceil(((from - COAST_RADIUS) / FAMILY.raider.speed) * STEPS_PER_SECOND);
    const before = run(sea([raider(0, from)]), steps - 1);
    expect(before.enemies).toHaveLength(1);
    expect(before.enemies[0]!.bearing).toBe(0);
    expect(before.enemies[0]!.distance).toBeCloseTo(from - ((steps - 1) * FAMILY.raider.speed) / STEPS_PER_SECOND, 9);
    expect(before.oil).toBe(START_OIL);
    const landed = stepNight(before, { beam: 180 });
    expect(landed.enemies).toEqual([]);
    expect(landed.oil).toBe(START_OIL - FAMILY.raider.oil);
  });

  it("each one that lands steals its oil", () => {
    const n = run(sea([raider(0, 7), raider(120, 7), raider(240, 7)]), 30);
    expect(n.enemies).toEqual([]);
    expect(n.oil).toBe(START_OIL - 3 * FAMILY.raider.oil);
  });

  it("the oil never goes below 0, and at 0 the Night is lost", () => {
    const n = run(sea([raider(0, 7), raider(90, 7)], 3), 30);
    expect(n.oil).toBe(0);
    expect(n.phase).toBe("lost");
  });

  it("a Night over does not move: no step changes it", () => {
    const lost = run(sea([raider(0, 7)], 1), 30);
    expect(lost.phase).toBe("lost");
    expect(stepNight(lost, { beam: 0 })).toBe(lost);
  });

  it("counts its steps, and never changes the Night it is given", () => {
    const n = sea([raider(0, 20)]);
    const copy = JSON.parse(JSON.stringify(n));
    const next = stepNight(n, { beam: 180 });
    expect(next.step).toBe(n.step + 1);
    expect(n).toEqual(copy);
  });

  it("the beam goes where it is told, any angle brought into [0, 360); a wrong one leaves it where it was", () => {
    const n = sea([]);
    expect(stepNight(n, { beam: 90 }).beam).toBe(90);
    expect(stepNight(n, { beam: 450 }).beam).toBe(90);
    expect(stepNight(n, { beam: -90 }).beam).toBe(270);
    const at = stepNight(n, { beam: 45 });
    expect(stepNight(at, { beam: Number.NaN }).beam).toBe(45);
    expect(stepNight(at, { beam: Infinity }).beam).toBe(45);
  });
});
