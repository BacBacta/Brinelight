import { describe, expect, it } from "vitest";
import { night as N } from "@brinelight/shared";
import { NIGHT_TEXT, endHtml, hudParts } from "../src/night/hud.js";

const base = N.newNight(1, 1);

describe("the Night's panel", () => {
  it("the oil as a share of a full Lighthouse, and the wave of all", () => {
    expect(hudParts({ ...base, oil: 75 })).toMatchObject({ oil: 0.75, oilText: "75", wave: "Wave 1 of 5", next: "" });
    expect(hudParts({ ...base, oil: 0, phase: "lost" }).oil).toBe(0);
    // Against the oil this Night started with (the Refinery's).
    expect(hudParts({ ...base, oil: 65, power: { ...base.power, startOil: 130 } }).oil).toBe(0.5);
  });

  it("in the pause, when the next wave comes", () => {
    const pause = { ...base, phase: "pause" as const, wave: 2, step: 100, pauseEnd: 100 + 4 * N.STEPS_PER_SECOND };
    expect(hudParts(pause)).toMatchObject({ wave: "Wave 2 of 5", next: "Next wave in 4 s" });
    expect(hudParts({ ...pause, step: pause.pauseEnd - 1 }).next).toBe("Next wave in 1 s");
  });
});

describe("what you earn, and what to do, during the Night", () => {
  it("the wood and fish earned so far, from the first Raider burned", () => {
    expect(hudParts(base)).toMatchObject({ wood: 0, fish: 0 });
    const mid = { ...base, phase: "pause" as const, wave: 1, burned: 4, pauseEnd: 200 };
    expect(hudParts(mid)).toMatchObject({ wood: N.LOOT_PER_WAVE.wood + 4 * N.LOOT_PER_BURNED.wood, fish: N.LOOT_PER_WAVE.fish });
  });

  it("Night 1 says what to do until the first boat burns; later Nights with troops on their rafts say nothing", () => {
    expect(hudParts(base).hint).toBe(NIGHT_TEXT.hint);
    expect(hudParts({ ...base, burned: 1 }).hint).toBe("");
    expect(hudParts({ ...base, wave: 2 }).hint).toBe("");
    // Later Nights say nothing of the beam; their rafts' hint is tested with the choices.
    expect(hudParts({ ...N.newNight(1, 2), posts: ["boarders", "harpooners"] }).hint).toBe("");
  });

  it("the oil is named for what it is", () => {
    expect(NIGHT_TEXT.oilLabel).toBe("Oil: the Lighthouse's life");
  });
});

describe("the end of a Night", () => {
  it("lost: the Lighthouse went dark, the waves held, what you bring back, the way to your city", () => {
    const lost = { ...base, phase: "lost" as const, oil: 0, wave: 4, burned: 12 };
    const html = endHtml(lost, N.nightLoot(lost));
    expect(html).toContain(NIGHT_TEXT.lost);
    expect(html).toContain("You held 3 waves of 5.");
    expect(html).toContain(`${N.nightLoot(lost).wood} wood`);
    expect(html).toContain(`data-act="done"`);
    expect(html).toContain(NIGHT_TEXT.toCity);
    expect(html).not.toContain("Pearls");
  });

  it("won: dawn, every wave held, Pearls", () => {
    const won = { ...base, phase: "won" as const, wave: 5, burned: 40 };
    const html = endHtml(won, N.nightLoot(won));
    expect(html).toContain(NIGHT_TEXT.won);
    expect(html).toContain("You held all 5 waves.");
    expect(html).toContain(`${N.LOOT_DAWN_PEARLS} Pearls`);
  });

  it("plain English, short, in the second person", () => {
    for (const t of Object.values(NIGHT_TEXT)) {
      // The first Night's line names the controls too (CrazyGames: show them): a little longer.
      expect(t.length).toBeLessThan(t === NIGHT_TEXT.hint ? 90 : 60);
      expect(t).not.toMatch(/\b(player|user|HP|spawn|seed)\b/i);
    }
  });
});

describe("the boss's health", () => {
  it("shown while the Mist Galleon is on the sea, as a share of its health", () => {
    expect(hudParts(base).boss).toBe(null);
    const g = { id: 1, family: "galleon" as const, bearing: 0, distance: 20, health: N.FAMILY.galleon.health / 2, lit: 0, fade: 0, stage: 1 };
    expect(hudParts({ ...base, enemies: [g] }).boss).toBe(0.5);
    expect(NIGHT_TEXT.boss).toBe("The Mist Galleon");
    expect(hudParts({ ...base, enemies: [g] }).bossName).toBe("The Mist Galleon");
    expect(hudParts({ ...base, enemies: [{ ...g, family: "leviathan", health: N.FAMILY.leviathan.health }] })).toMatchObject({ bossName: "The Leviathan", boss: 1 });
  });
});

describe("the flare's button", () => {
  it("ready: Flare; fired: the seconds it waits", () => {
    expect(hudParts(base)).toMatchObject({ flare: "Flare", flareReady: true });
    expect(hudParts({ ...base, cooldown: 12 * N.STEPS_PER_SECOND - 5 })).toMatchObject({ flare: "Flare 12 s", flareReady: false });
  });
});

describe("the power's button bears the lead captain's power", () => {
  it("Bright lens when Sel leads", () => {
    expect(hudParts({ ...base, power: { ...base.power, captain: "sel" } }).flare).toBe("Bright lens");
  });
});

describe("the Endless Night's panel and end", () => {
  it("the wave with no end to it, and the waves held", () => {
    const e = { ...N.newNight(1, N.ENDLESS), wave: 12 };
    expect(hudParts(e).wave).toBe("Wave 12");
    expect(endHtml({ ...e, phase: "lost", oil: 0 }, N.nightLoot({ ...e, phase: "lost", oil: 0 }))).toContain("You held 11 waves of the Endless Night.");
  });
});
