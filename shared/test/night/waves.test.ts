import { describe, expect, it } from "vitest";
import { feedTime, type NightClock } from "../../src/rules/night/clock.js";
import { nightLoot } from "../../src/rules/night/loot.js";
import { newNight, type NightState } from "../../src/rules/night/state.js";
import { stepNight, waveSize, wavesOf, type NightInput } from "../../src/rules/night/step.js";
import { LOOT_DAWN_PEARLS, LOOT_FLOOR, LOOT_PER_WAVE, NIGHT1_GRACE_WAVES, SPAWN_SPACING, STEPS_PER_SECOND, WAVE_PAUSE } from "../../src/rules/night/values.js";

/** Where a player who always aims at the nearest enemy points the beam. */
const aim = (n: NightState): NightInput => {
  const near = n.enemies.reduce<NightState["enemies"][number] | null>((a, e) => (!a || e.distance < a.distance ? e : a), null);
  return { beam: near ? near.bearing : n.beam, card: n.offer[0] };
};
const play = (n: NightState, input: (n: NightState) => NightInput, maxSteps = 200_000): NightState => {
  let s = n;
  for (let i = 0; i < maxSteps && s.phase !== "won" && s.phase !== "lost"; i++) s = stepNight(s, input(s));
  return s;
};

describe("the waves", () => {
  it("each Night has its waves; each wave its Raiders, growing", () => {
    expect([1, 2, 3, 4, 5].map(wavesOf)).toEqual([5, 8, 9, 10, 12]);
    expect([1, 2, 3].map((w) => waveSize(1, w))).toEqual([4, 6, 8]);
    expect(waveSize(2, 1)).toBe(6);
  });

  it("a wave sends its Raiders from the edge of the sea, one every 1.5 s, at bearings drawn from the seed", () => {
    let n = newNight(77, 1);
    const seen: number[] = [];
    for (let i = 0; i < SPAWN_SPACING * STEPS_PER_SECOND * 3 + 1; i++) {
      n = stepNight(n, { beam: 0, card: n.offer[0] });
      for (const e of n.enemies) if (!seen.includes(e.id)) seen.push(e.id);
    }
    expect(n.spawned).toBe(4);
    expect(seen).toEqual([1, 2, 3, 4]);
    const bearings = newNight(77, 1);
    expect(play(bearings, aim).seed).toBe(77);
    // Another seed, other bearings.
    const at = (seed: number) => stepNight(newNight(seed, 1), { beam: 180 }).enemies.map((e) => e.bearing);
    expect(at(77)).not.toEqual(at(78));
  });

  it("a wave ends when it has sent all its Raiders and none is left; a pause, then the next", () => {
    let n = newNight(5, 1);
    while (n.phase === "wave") n = stepNight(n, aim(n));
    expect(n.phase).toBe("pause");
    expect(n.wave).toBe(1);
    expect(n.pauseEnd - n.step).toBe(WAVE_PAUSE * STEPS_PER_SECOND);
    while (n.phase === "pause") n = stepNight(n, aim(n));
    expect(n.phase).toBe("wave");
    expect(n.wave).toBe(2);
    expect(n.spawned).toBe(1);
  });

  it("aiming at the nearest enemy wins Night 1 after its last wave, with its oil", () => {
    const won = play(newNight(5, 1), aim);
    expect(won.phase).toBe("won");
    expect(won.wave).toBe(wavesOf(1));
    expect(won.enemies).toEqual([]);
    expect(won.burned).toBeGreaterThan(30);
  });

  it("left alone, Night 1 is lost, never before its third wave, at a known step", () => {
    const lost = play(newNight(5, 1), (n) => ({ beam: 0, card: n.offer[0] }));
    expect(lost.phase).toBe("lost");
    expect(lost.wave).toBeGreaterThan(NIGHT1_GRACE_WAVES);
    // The same Night, the same end: replays rest on this.
    expect(lost.step).toBe(play(newNight(5, 1), (n) => ({ beam: 0, card: n.offer[0] })).step);
    expect(lost.step).toMatchInlineSnapshot(`2205`);
  });

  it("Night 1's first waves leave at least a drop of oil, even with nothing left", () => {
    let n: NightState = { ...newNight(5, 1), oil: 1 };
    while (n.phase !== "lost" && n.wave <= NIGHT1_GRACE_WAVES) n = stepNight(n, { beam: 180, card: n.offer[0] });
    expect(n.wave).toBe(NIGHT1_GRACE_WAVES + 1);
    expect(n.oil).toBe(1);
    // Night 2 has no such grace.
    expect(play({ ...newNight(5, 2), oil: 1 }, (n) => ({ beam: 180, card: n.offer[0] }), 2000).phase).toBe("lost");
  });
});

describe("a Night is its seed and its inputs", () => {
  it("the same seed and inputs give the same Night after 10,000 steps", () => {
    const run = () => {
      let n = newNight(424242, 3);
      for (let i = 0; i < 10_000; i++) n = stepNight(n, { beam: (i * 7) % 360, card: n.offer[0] });
      return JSON.stringify(n);
    };
    expect(run()).toBe(run());
  });

  it("time fed as 1/15 s or as two 1/30 s gives the same Night; so do 60 Hz and 165 Hz over 10 s", () => {
    const feed = (dt: number, frames: number): NightState => {
      let c: NightClock = { night: newNight(31, 1), spare: 0 };
      for (let i = 0; i < frames; i++) c = feedTime(c, dt, aim(c.night));
      return c.night;
    };
    expect(feed(1 / 15, 30)).toEqual(feed(1 / 30, 60));
    expect(feed(1 / 60, 600).step).toBe(300);
    expect(feed(1 / 165, 1650).step).toBe(300);
    expect(feed(1 / 60, 600).enemies.map((e) => e.id)).toEqual(feed(1 / 165, 1650).enemies.map((e) => e.id));
  });

  it("a slow frame runs 8 steps at most: the Night slows rather than jumps", () => {
    const c = feedTime({ night: newNight(31, 1), spare: 0 }, 5, { beam: 0 });
    expect(c.night.step).toBe(8);
    expect(c.spare).toBe(0);
    expect(feedTime({ night: newNight(31, 1), spare: 0 }, -1, { beam: 0 }).night.step).toBe(0);
    expect(feedTime({ night: newNight(31, 1), spare: 0 }, Number.NaN, { beam: 0 }).night.step).toBe(0);
  });
});

describe("the loot at dawn", () => {
  it("won: every wave's loot, a wood a Raider burned twice over, and Pearls", () => {
    const won = play(newNight(5, 1), aim);
    expect(nightLoot(won)).toEqual({ wood: 5 * LOOT_PER_WAVE.wood + 2 * won.burned, fish: 5 * LOOT_PER_WAVE.fish, pearls: LOOT_DAWN_PEARLS });
  });

  it("lost: the waves cleared, no Pearls, and never less than the floor", () => {
    const lost = play(newNight(5, 1), (n) => ({ beam: 0, card: n.offer[0] }));
    const loot = nightLoot(lost);
    expect(loot.pearls).toBe(0);
    expect(loot.fish).toBe((lost.wave - 1) * LOOT_PER_WAVE.fish);
    expect(loot.wood).toBe(Math.max(LOOT_FLOOR.wood, (lost.wave - 1) * LOOT_PER_WAVE.wood + 2 * lost.burned));
    expect(nightLoot({ ...newNight(1, 1), phase: "lost", oil: 0 })).toEqual({ wood: LOOT_FLOOR.wood, fish: 0, pearls: 0 });
  });
});

describe("the loot as it grows, during the Night", () => {
  it("the waves cleared and the Raiders burned so far, without the floor of a lost Night, no Pearls until dawn", async () => {
    const { lootSoFar } = await import("../../src/rules/night/loot.js");
    const n = newNight(5, 1);
    expect(lootSoFar(n)).toEqual({ wood: 0, fish: 0, pearls: 0 });
    const mid = { ...n, phase: "pause" as const, wave: 2, burned: 9 };
    expect(lootSoFar(mid)).toEqual({ wood: 2 * LOOT_PER_WAVE.wood + 2 * 9, fish: 2 * LOOT_PER_WAVE.fish, pearls: 0 });
    // At dawn, what was earned is what you bring back.
    const won = play(newNight(5, 1), aim);
    expect({ ...lootSoFar(won), pearls: LOOT_DAWN_PEARLS }).toEqual(nightLoot(won));
  });
});
