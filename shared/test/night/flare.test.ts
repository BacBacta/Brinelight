import { describe, expect, it } from "vitest";
import { cardMods } from "../../src/rules/night/cards.js";
import { newNight, parseNight, type Enemy, type NightState } from "../../src/rules/night/state.js";
import { stepNight } from "../../src/rules/night/step.js";
import { FAMILY, FLARE_COOLDOWN, FLARE_SECONDS, FLARE_SHARE, STEP, STEPS_PER_SECOND } from "../../src/rules/night/values.js";

const foe = (family: Enemy["family"], bearing: number, fade = 0, id = 1): Enemy => ({ id, family, bearing, distance: 25, health: FAMILY[family].health, lit: 0, fade, stage: 0 });
const sea = (enemies: Enemy[], cards: NightState["cards"] = []): NightState => ({ ...newNight(1, 2), enemies, nextId: 9, cards, spawned: 99 });
const steps = (s: number) => Math.round(s * STEPS_PER_SECOND);

describe("the lead captain's power: the flare", () => {
  it("ready from the start; fired, it lights the whole sea for 2 s, then must wait 20 s", () => {
    const n = sea([foe("raider", 90)]);
    expect(n.flare).toBe(0);
    expect(n.cooldown).toBe(0);
    const fired = stepNight(n, { beam: 270, power: true });
    expect(fired.flare).toBe(steps(FLARE_SECONDS) - 1);
    expect(fired.cooldown).toBe(steps(FLARE_COOLDOWN) - 1);
  });

  it("while it burns, every enemy on the sea takes half the beam's strength, wherever the beam points; a faded Wraith too", () => {
    const n = stepNight(sea([foe("raider", 90), foe("wraith", 200, 30, 2)]), { beam: 0, power: true });
    const hit = n.power.beamDps * FLARE_SHARE * STEP;
    expect(FAMILY.raider.health - n.enemies.find((e) => e.id === 1)!.health).toBeCloseTo(hit, 9);
    expect(FAMILY.wraith.health - n.enemies.find((e) => e.id === 2)!.health).toBeCloseTo(hit, 9);
  });

  it("not ready, it does nothing", () => {
    const busy = { ...sea([foe("raider", 90)]), cooldown: 100 };
    const n = stepNight(busy, { beam: 0, power: true });
    expect(n.flare).toBe(0);
    expect(n.enemies[0]!.health).toBe(FAMILY.raider.health);
    expect(n.cooldown).toBe(99);
  });

  it("the captains' cards: Quick hands waits 25% less, Long flare burns a second longer", () => {
    expect(cardMods(["quick"]).cooldown).toBeCloseTo(FLARE_COOLDOWN * 0.75, 9);
    expect(cardMods(["long"]).flare).toBe(FLARE_SECONDS + 1);
    const n = stepNight(sea([], ["long"]), { beam: 0, power: true });
    expect(n.flare).toBe(steps(FLARE_SECONDS + 1) - 1);
  });

  it("the flare is part of the Night, read back with it", () => {
    const n = stepNight(sea([foe("raider", 90)]), { beam: 0, power: true });
    expect(parseNight(JSON.parse(JSON.stringify(n)))).toEqual(n);
    expect(parseNight({ ...n, cooldown: -1 })).toBe(null);
  });
});
