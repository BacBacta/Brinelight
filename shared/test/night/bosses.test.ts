import { describe, expect, it } from "vitest";
import { BOSSES, BOSS_AT } from "../../src/rules/night/values.js";
import { newNight, type Enemy, type NightState } from "../../src/rules/night/state.js";
import { COUNTERED_BY, stepNight, wavesOf } from "../../src/rules/night/step.js";
import { FAMILY } from "../../src/rules/night/values.js";

const boss = (family: Enemy["family"], health: number): Enemy => ({ id: 1, family, bearing: 0, distance: 28, health, lit: 0, fade: 0, stage: 0 });
const alone = (e: Enemy, night = 30): NightState => ({ ...newNight(1, night), phase: "pause", pauseEnd: 1e6, enemies: [e], nextId: 2 });

describe("the bosses of waves 20 and 30", () => {
  it("wave 10 the Galleon, wave 20 the Kraken, wave 30 the Leviathan, each tougher", () => {
    expect(BOSS_AT).toEqual({ 10: "galleon", 20: "kraken", 30: "leviathan" });
    expect(FAMILY.kraken.health).toBeGreaterThan(FAMILY.galleon.health);
    expect(FAMILY.leviathan.health).toBeGreaterThan(FAMILY.kraken.health);
    expect(COUNTERED_BY.kraken).toBe("boarders");
    expect(COUNTERED_BY.leviathan).toBe("harpooners");
  });

  it("each comes first in its wave, in the Nights long enough", () => {
    const at = (night: number, wave: number) => stepNight({ ...newNight(3, night), wave, spawned: 0, nextSpawn: 0 }, { beam: 180 }).enemies.map((e) => e.family);
    expect(wavesOf(30)).toBe(30);
    expect(at(30, 20)).toContain("kraken");
    expect(at(30, 30)).toContain("leviathan");
    expect(at(30, 19)).not.toContain("kraken");
  });

  it("at two thirds each sends its own: the Kraken two Beasts, the Leviathan four Wraiths", () => {
    for (const fam of ["kraken", "leviathan"] as const) {
      const n = stepNight(alone(boss(fam, (FAMILY[fam].health * 2) / 3 + 0.1)), { beam: 0 });
      const sent = n.enemies.filter((e) => e.family === BOSSES[fam].summon);
      expect(sent, fam).toHaveLength(BOSSES[fam].count);
      expect(n.enemies.find((e) => e.family === fam)!.stage).toBe(1);
    }
  });

  it("at a third, each rages", () => {
    const n = stepNight(alone({ ...boss("leviathan", FAMILY.leviathan.health / 3 - 1), stage: 1 }), { beam: 180 });
    expect(n.enemies.find((e) => e.family === "leviathan")!.stage).toBe(2);
  });
});
