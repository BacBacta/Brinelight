import { describe, expect, it } from "vitest";
import { ENDLESS, chartNight, endlessOpen } from "../../src/rules/night/chart.js";
import { CITY_SHAPE, newCity, parseCity } from "../../src/rules/night/city.js";
import { newNight, parseNight } from "../../src/rules/night/state.js";
import { stepNight, wavesOf } from "../../src/rules/night/step.js";
import { dawn } from "../../src/rules/night/upgrade.js";
import { FAMILY, NIGHTS } from "../../src/rules/night/values.js";

describe("the Endless Night", () => {
  it("opens once Night 5 is won; it comes after the chart's 30", () => {
    expect(ENDLESS).toBe(NIGHTS + 1);
    expect(endlessOpen({ ...newCity(), won: 4, played: 4 })).toBe(false);
    expect(endlessOpen({ ...newCity(), won: 5, played: 5 })).toBe(true);
    expect(chartNight(ENDLESS).name).toBe("Endless Night");
  });

  it("its waves never end; each one tougher; a boss every ten", () => {
    expect(wavesOf(ENDLESS)).toBeGreaterThan(1_000_000);
    const at = (wave: number) => stepNight({ ...newNight(2, ENDLESS), wave, spawned: 0, nextSpawn: 0 }, { beam: 180 }).enemies;
    const tough = (wave: number) => at(wave).filter((e) => e.family !== "galleon" && e.family !== "kraken" && e.family !== "leviathan").map((e) => e.health / FAMILY[e.family].health)[0]!;
    expect(tough(12)).toBeGreaterThan(tough(2));
    expect(at(40).map((e) => e.family)).toContain("galleon");
    expect(at(60).map((e) => e.family)).toContain("leviathan");
  });

  it("a Night read back may be the Endless one", () => {
    const n = newNight(1, ENDLESS);
    expect(parseNight(JSON.parse(JSON.stringify(n)))).toEqual(n);
    expect(parseNight({ ...n, night: ENDLESS + 1 })).toBe(null);
  });

  it("dawn after it: its loot, your record if it is one; it opens no Night", () => {
    const c = { ...newCity(), won: 5, played: 5 };
    const r = dawn(c, { ...newNight(1, ENDLESS), phase: "lost", oil: 0, wave: 14 });
    expect(r.ok && r.city.record).toBe(13);
    expect(r.ok && r.city.won).toBe(5);
    const again = dawn(r.ok ? r.city : c, { ...newNight(1, ENDLESS), phase: "lost", oil: 0, wave: 6 });
    expect(again.ok && again.city.record).toBe(13);
  });

  it("the city keeps the record; one saved before has none", () => {
    expect(newCity().record).toBe(0);
    const v3 = { ...newCity(), v: 3 } as Record<string, unknown>;
    delete v3.record;
    delete v3.away;
    delete v3.daily;
    expect(parseCity(v3)).toEqual({ ...newCity(), v: CITY_SHAPE });
  });
});
