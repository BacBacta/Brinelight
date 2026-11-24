import { describe, expect, it } from "vitest";
import { NIGHT_SHAPE, newNight, parseNight, type NightState } from "../../src/rules/night/state.js";
import { START_OIL, STEPS_PER_SECOND } from "../../src/rules/night/values.js";

const night = (): NightState => newNight(1234, 1);
/** A copy of a fresh Night with one field changed (or removed with undefined). */
const withField = (key: string, value: unknown): unknown => {
  const o: Record<string, unknown> = JSON.parse(JSON.stringify(night()));
  if (value === undefined) delete o[key];
  else o[key] = value;
  return o;
};
const enemy = { id: 1, family: "raider", bearing: 90, distance: 20, health: 30, lit: 0, fade: 0 };

describe("a new Night", () => {
  it("starts at step 0, its oil full, its first wave coming, the beam to the north, nothing on the sea", () => {
    const n = night();
    expect(n).toMatchObject({ v: NIGHT_SHAPE, night: 1, seed: 1234, step: 0, oil: START_OIL, wave: 1, phase: "wave", enemies: [], beam: 0, posts: [null, null] });
    expect(STEPS_PER_SECOND).toBe(30);
  });

  it("the same seed, the same Night; its generator starts from its seed", () => {
    expect(newNight(9, 2)).toEqual(newNight(9, 2));
    expect(newNight(9, 2).rng).not.toBe(newNight(10, 2).rng);
  });

  it("only a known Night number and a whole seed", () => {
    expect(() => newNight(1, 0)).toThrow();
    expect(() => newNight(1, 1.5)).toThrow();
    expect(() => newNight(-1, 1)).toThrow();
    expect(() => newNight(2 ** 32, 1)).toThrow();
  });
});

describe("parseNight: a Night read back (a save, a replay) is strict", () => {
  it("a fresh Night, and one with an enemy on the sea, pass unchanged", () => {
    expect(parseNight(JSON.parse(JSON.stringify(night())))).toEqual(night());
    const busy = { ...night(), enemies: [enemy], nextId: 2 };
    expect(parseNight(JSON.parse(JSON.stringify(busy)))).toEqual(busy);
  });

  it("refuses what is not a Night", () => {
    for (const raw of [null, undefined, 3, "night", [], {}]) expect(parseNight(raw), String(raw)).toBe(null);
  });

  it("refuses each field missing, unknown or out of its range", () => {
    const bad: [string, unknown][] = [
      ["v", 2],
      ["night", 0],
      ["seed", -1],
      ["seed", 1.5],
      ["rng", 2 ** 32],
      ["step", -1],
      ["step", 0.5],
      ["oil", -1],
      ["oil", Number.NaN],
      ["wave", 0],
      ["phase", "dawn"],
      ["pauseEnd", -2],
      ["spawned", -1],
      ["nextSpawn", "soon"],
      ["beam", 360],
      ["beam", -1],
      ["nextId", 0],
      ["burned", -1],
      ["enemies", {}],
      ["extra", 1],
    ];
    for (const [k, v] of bad) expect(parseNight(withField(k, v)), `${k}: ${String(v)}`).toBe(null);
    for (const k of Object.keys(night())) expect(parseNight(withField(k, undefined)), `without ${k}`).toBe(null);
  });

  it("refuses an enemy that is not one", () => {
    const bad = [
      { ...enemy, family: "dragon" },
      { ...enemy, bearing: 400 },
      { ...enemy, distance: -1 },
      { ...enemy, health: 0 },
      { ...enemy, id: 0 },
      { ...enemy, extra: true },
      { id: 1, family: "raider", bearing: 90, distance: 20 },
    ];
    for (const e of bad) expect(parseNight({ ...night(), enemies: [e], nextId: 2 }), JSON.stringify(e)).toBe(null);
    // Two enemies with one id, or an id not below the next one: a Night that was edited.
    expect(parseNight({ ...night(), enemies: [enemy, enemy], nextId: 2 })).toBe(null);
    expect(parseNight({ ...night(), enemies: [enemy], nextId: 1 })).toBe(null);
  });
});
