import { describe, expect, it } from "vitest";
import { CHART, RULES, chartNight } from "../../src/rules/night/chart.js";
import { newNight, type Enemy, type NightState } from "../../src/rules/night/state.js";
import { burstOf, familyAt, stepNight, wavesOf } from "../../src/rules/night/step.js";
import { seedRng } from "../../src/rules/night/random.js";
import { BEAM_WIDTH, FAMILY, NIGHTS, STEP, STEPS_PER_SECOND, WAVE_PAUSE } from "../../src/rules/night/values.js";

describe("the sea chart: 30 Nights", () => {
  it("30 Nights; the first five as they were", () => {
    expect(NIGHTS).toBe(30);
    expect(CHART).toHaveLength(30);
    expect([1, 2, 3, 4, 5].map(wavesOf)).toEqual([5, 8, 9, 10, 12]);
    expect([1, 2, 3, 4, 5].map(burstOf)).toEqual([1, 1, 2, 2, 3]);
    for (let k = 1; k <= 5; k++) expect(chartNight(k).rule, `Night ${k}`).toBe("none");
  });

  it("further out, longer Nights, more at once, tougher enemies, up to 30 waves", () => {
    for (let k = 6; k <= 30; k++) {
      expect(wavesOf(k), `Night ${k}`).toBeGreaterThanOrEqual(wavesOf(k - 1));
      expect(burstOf(k)).toBeGreaterThanOrEqual(burstOf(k - 1));
      expect(chartNight(k).health).toBeGreaterThan(chartNight(k - 1).health - 1e-9);
    }
    expect(wavesOf(30)).toBe(30);
    expect(wavesOf(20)).toBeGreaterThanOrEqual(20);
    expect(chartNight(5).health).toBe(1);
  });

  it("every rule is met on the chart, each Night's name says it", () => {
    for (const r of RULES) expect(CHART.some((c) => c.rule === r), r).toBe(true);
    expect(chartNight(1).name).toBe("Night 1");
    const ruled = CHART.find((c) => c.rule === "wraiths")!;
    expect(ruled.name).toContain("Night of Wraiths");
  });
});

/** A Night of this number, with one enemy, the waves held back. */
const one = (night: number, family: Enemy["family"] = "raider"): NightState => ({
  ...newNight(1, night),
  phase: "pause",
  pauseEnd: 1e6,
  enemies: [{ id: 1, family, bearing: 0, distance: 28, health: FAMILY[family].health, lit: 0, fade: 0, stage: 0 }],
  nextId: 2,
});
const night = (rule: (typeof RULES)[number]) => CHART.findIndex((c) => c.rule === rule) + 1;

describe("each Night's rule does what it says", () => {
  it("swift: enemies 25% faster", () => {
    const k = night("swift");
    const moved = 28 - stepNight(one(k), { beam: 180 }).enemies[0]!.distance;
    expect(moved).toBeCloseTo(FAMILY.raider.speed * 1.25 * STEP, 9);
  });

  it("wraiths and beasts: their family most", () => {
    const share = (k: number, fam: Enemy["family"]) => {
      let r = seedRng(k);
      let c = 0;
      for (let i = 0; i < 2000; i++) {
        const [f, next] = familyAt(k, r);
        if (f === fam) c++;
        r = next;
      }
      return c / 2000;
    };
    expect(share(night("wraiths"), "wraith")).toBeGreaterThan(0.6);
    expect(share(night("beasts"), "beast")).toBeGreaterThan(0.5);
  });

  it("no pause: a second between waves, not six", () => {
    let n: NightState = { ...newNight(5, night("nopause")), spawned: 99, enemies: [] };
    n = stepNight(n, { beam: 0 });
    expect(n.phase).toBe("pause");
    expect(n.pauseEnd - n.step).toBe(STEPS_PER_SECOND * 1);
    expect(WAVE_PAUSE).toBeGreaterThan(1);
  });

  it("dark: the beam 10° narrower", () => {
    const k = night("dark");
    const lit = (n: NightState) => FAMILY.raider.health * chartNight(k).health - stepNight(n, { beam: 0 }).enemies[0]!.health;
    const edge = { ...one(k), enemies: [{ ...one(k).enemies[0]!, bearing: BEAM_WIDTH / 2 - 2, health: FAMILY.raider.health * chartNight(k).health }] };
    expect(lit(edge)).toBe(0);
  });

  it("tougher enemies further out: they come with the health their Night says", () => {
    let n = newNight(3, 12);
    for (let i = 0; i < 3 && n.enemies.length === 0; i++) n = stepNight(n, { beam: 180 });
    const e = n.enemies[0]!;
    expect(e.health).toBeCloseTo(FAMILY[e.family].health * chartNight(12).health, 6);
  });
});
