import { describe, expect, it } from "vitest";
import { night as N } from "@brinelight/shared";
import { NIGHT_SOUNDS, nightSoundUrl, soundsBetween } from "../src/night/audio.js";

const base = N.newNight(1, 2);
const raider = (id: number, distance: number): N.Enemy => ({ id, family: "raider", bearing: 0, distance, health: 10, lit: 0, fade: 0, stage: 0 });

describe("the Night's sounds", () => {
  it("each from its own file in client/public/night/sounds/", () => {
    expect(NIGHT_SOUNDS).toEqual(["burn", "land", "wave", "card", "boss", "power", "lost", "dawn"]);
    expect(nightSoundUrl("burn")).toBe(`${import.meta.env.BASE_URL}night/sounds/burn.mp3`);
  });

  it("what changed between two steps: a boat burned, one landed, a wave began, cards offered, a boss came, the power fired, the end", () => {
    expect(soundsBetween(base, base)).toEqual([]);
    expect(soundsBetween({ ...base, enemies: [raider(1, 20)], burned: 0 }, { ...base, enemies: [], burned: 1 })).toEqual(["burn"]);
    expect(soundsBetween({ ...base, oil: 100 }, { ...base, oil: 95 })).toEqual(["land"]);
    expect(soundsBetween({ ...base, wave: 1, phase: "pause" }, { ...base, wave: 2, phase: "wave" })).toEqual(["wave"]);
    expect(soundsBetween(base, { ...base, offer: ["wide", "tar", "tide"] })).toEqual(["card"]);
    expect(soundsBetween(base, { ...base, enemies: [{ ...raider(9, 30), family: "galleon" }] })).toEqual(["boss"]);
    expect(soundsBetween({ ...base, cooldown: 0 }, { ...base, cooldown: 500 })).toEqual(["power"]);
    expect(soundsBetween(base, { ...base, phase: "lost", oil: 0 })).toContain("lost");
    expect(soundsBetween(base, { ...base, phase: "won" })).toEqual(["dawn"]);
  });
});
