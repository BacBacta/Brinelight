import { describe, expect, it } from "vitest";
import { newNight, parseNight, type Enemy, type NightState } from "../../src/rules/night/state.js";
import { familyAt, stepNight } from "../../src/rules/night/step.js";
import { seedRng } from "../../src/rules/night/random.js";
import { BEAM_DPS, FAMILY, NIGHT_MIX, STEPS_PER_SECOND, WRAITH_FADE_AFTER, WRAITH_HIDDEN } from "../../src/rules/night/values.js";

const enemy = (family: Enemy["family"], bearing = 0, distance = 28): Enemy => ({ id: 1, family, bearing, distance, health: FAMILY[family].health, lit: 0, fade: 0 });
const alone = (e: Enemy): NightState => ({ ...newNight(1, 2), phase: "pause", pauseEnd: 1_000_000, enemies: [e], nextId: 2 });
const run = (n: NightState, steps: number, beam: number): NightState => {
  let s = n;
  for (let i = 0; i < steps; i++) s = stepNight(s, { beam });
  return s;
};
const steps = (seconds: number) => Math.round(seconds * STEPS_PER_SECOND);

describe("the three families", () => {
  it("Raiders quick, Beasts slow and tough, Wraiths between", () => {
    expect(FAMILY.beast.speed).toBeLessThan(FAMILY.raider.speed);
    expect(FAMILY.beast.health).toBeGreaterThan(FAMILY.wraith.health);
    expect(FAMILY.wraith.health).toBeGreaterThan(FAMILY.raider.health);
    expect(FAMILY.beast.oil).toBeGreaterThan(FAMILY.wraith.oil);
    expect(FAMILY.wraith.oil).toBeGreaterThan(FAMILY.raider.oil);
  });

  it("a Beast lasts in the beam what its health says, and steals its oil on the coast", () => {
    const kill = Math.ceil((FAMILY.beast.health / BEAM_DPS) * STEPS_PER_SECOND);
    expect(run(alone(enemy("beast")), kill - 1, 0).enemies).toHaveLength(1);
    expect(run(alone(enemy("beast")), kill, 0).enemies).toEqual([]);
    const landed = run(alone(enemy("beast", 0, 7)), 30, 180);
    expect(landed.oil).toBe(landed.power.startOil - FAMILY.beast.oil);
  });

  it("a Wraith fades out of the beam once it has been lit a while; faded, it takes nothing, and still comes", () => {
    const lit = run(alone(enemy("wraith")), steps(WRAITH_FADE_AFTER), 0).enemies[0]!;
    expect(lit.fade).toBe(steps(WRAITH_HIDDEN));
    const hit = FAMILY.wraith.health - lit.health;
    const faded = run({ ...alone(lit) }, steps(WRAITH_HIDDEN) - 1, 0).enemies[0]!;
    expect(FAMILY.wraith.health - faded.health).toBeCloseTo(hit, 9);
    expect(faded.distance).toBeLessThan(lit.distance);
    // Back in sight, the beam burns it again.
    const back = run(alone(faded), 3, 0).enemies[0]!;
    expect(back.health).toBeLessThan(faded.health);
  });

  it("a Wraith held in the beam is never burned in one stroke: it takes several", () => {
    expect(BEAM_DPS * WRAITH_FADE_AFTER).toBeLessThan(FAMILY.wraith.health);
  });

  it("out of the beam, a Wraith's count starts again", () => {
    const half = run(alone(enemy("wraith")), steps(WRAITH_FADE_AFTER) - 2, 0);
    const away = run(half, 1, 180).enemies[0]!;
    expect(away.lit).toBe(0);
    expect(away.fade).toBe(0);
  });
});

describe("which family comes, Night by Night", () => {
  const draw = (night: number, n = 2000) => {
    let r = seedRng(night * 101);
    const count = { raider: 0, beast: 0, wraith: 0 };
    for (let i = 0; i < n; i++) {
      const [f, next] = familyAt(night, r);
      count[f] += 1;
      r = next;
    }
    return count;
  };

  it("Night 1: Raiders only; Beasts from Night 2; Wraiths from Night 4, as the mix says", () => {
    expect(draw(1)).toEqual({ raider: 2000, beast: 0, wraith: 0 });
    expect(draw(2).beast).toBeGreaterThan(300);
    expect(draw(3).wraith).toBe(0);
    expect(draw(4).wraith).toBeGreaterThan(300);
    expect(NIGHT_MIX[0]).toEqual({ raider: 1, beast: 0, wraith: 0 });
  });

  it("a Night's waves bring its families, from its seed", () => {
    let n = newNight(9, 4);
    const seen = new Set<string>();
    for (let i = 0; i < 6000 && n.phase !== "won" && n.phase !== "lost"; i++) {
      n = stepNight(n, { beam: (i * 3) % 360 });
      for (const e of n.enemies) seen.add(e.family);
    }
    expect([...seen].sort()).toEqual(["beast", "raider", "wraith"]);
  });

  it("an enemy read back carries its family, its time lit and its fading", () => {
    const n = { ...alone(enemy("wraith")) };
    expect(parseNight(JSON.parse(JSON.stringify(n)))).toEqual(n);
    expect(parseNight({ ...n, enemies: [{ ...enemy("wraith"), fade: -1 }] })).toBe(null);
    expect(parseNight({ ...n, enemies: [{ ...enemy("wraith"), lit: 0.5 }] })).toBe(null);
  });
});
