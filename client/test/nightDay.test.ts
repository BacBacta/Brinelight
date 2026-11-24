import { describe, expect, it } from "vitest";
import { night as N } from "@brinelight/shared";
import { DAY_TEXT, dayHtml, effectLine } from "../src/night/day.js";

const city = (over: Partial<N.PortalCity> = {}): N.PortalCity => ({ ...N.newCity(), ...over });

describe("the Day: your city between the Nights", () => {
  it("each building says what it does for the Night, now and at its next level", () => {
    expect(effectLine("lighthouse", city())).toBe("Beam: 60 → 69 a second");
    expect(effectLine("refinery", city())).toBe("Oil to start: 100 → 115");
    expect(effectLine("infirmary", city())).toBe("Build it: once a Night, the Lighthouse lights again with 30% of its oil");
    expect(effectLine("infirmary", city({ buildings: { lighthouse: 3, refinery: 1, infirmary: 1 } }))).toBe("Second chance: 30% → 35% of your oil");
  });

  it("an upgrade you can pay has its button; one you cannot says why, in the rules' words", () => {
    const poor = dayHtml(city());
    expect(poor).toContain("You need 80 more wood and 60 more fish.");
    expect(poor).toContain("Upgrade the Lighthouse first.");
    expect(poor).not.toMatch(/data-act="upgrade" data-b="lighthouse"(?![^>]*disabled)/);
    const rich = dayHtml(city({ stock: { wood: 500, fish: 500, pearls: 0 } }));
    expect(rich).toMatch(/data-act="upgrade" data-b="lighthouse"(?![^>]*disabled)/);
    expect(rich).toContain("80 wood · 60 fish");
    expect(rich).toContain(">Build<");
  });

  it("the next Night, always there", () => {
    expect(dayHtml(city())).toContain(`data-act="night"`);
    expect(dayHtml(city())).toContain("Start Night 1");
    expect(dayHtml(city({ won: 2, played: 3 }))).toContain("Start Night 3");
  });

  it("plain words, short", () => {
    for (const t of Object.values(DAY_TEXT)) expect(t.length).toBeLessThan(60);
  });
});
