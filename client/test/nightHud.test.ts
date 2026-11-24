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

  it("Night 1 says what to do until the first boat burns; later Nights say nothing", () => {
    expect(hudParts(base).hint).toBe(NIGHT_TEXT.hint);
    expect(hudParts({ ...base, burned: 1 }).hint).toBe("");
    expect(hudParts({ ...base, wave: 2 }).hint).toBe("");
    expect(hudParts(N.newNight(1, 2)).hint).toBe("");
  });

  it("the oil is named for what it is", () => {
    expect(NIGHT_TEXT.oilLabel).toBe("Oil: the Lighthouse's life");
  });
});

describe("the end of a Night", () => {
  it("lost: the Lighthouse went dark, the waves held, what you bring back, Again", () => {
    const lost = { ...base, phase: "lost" as const, oil: 0, wave: 4, burned: 12 };
    const html = endHtml(lost, N.nightLoot(lost));
    expect(html).toContain(NIGHT_TEXT.lost);
    expect(html).toContain("You held 3 waves of 5.");
    expect(html).toContain(`${N.nightLoot(lost).wood} wood`);
    expect(html).toContain(`data-act="again"`);
    expect(html).toContain(NIGHT_TEXT.again);
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
      expect(t.length).toBeLessThan(60);
      expect(t).not.toMatch(/\b(player|user|HP|spawn|seed)\b/i);
    }
  });
});
