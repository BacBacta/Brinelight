import { describe, expect, it } from "vitest";
import { night as N } from "@brinelight/shared";
import { DAY_TEXT, dayHtml, effectLine } from "../src/night/day.js";

const city = (over: Partial<N.PortalCity> = {}): N.PortalCity => ({ ...N.newCity(), ...over });

describe("the Day: your city between the Nights", () => {
  it("each building says what it does for the Night, now and at its next level", () => {
    expect(effectLine("lighthouse", city())).toBe("Beam: 60 → 69 a second");
    expect(effectLine("refinery", city())).toBe("Oil to start: 100 → 115");
    expect(effectLine("infirmary", city())).toBe("Build it: once a Night, the Lighthouse lights again with 30% of its oil");
    expect(effectLine("infirmary", city({ buildings: { ...N.newCity().buildings, lighthouse: 3, refinery: 1, infirmary: 1 } }))).toBe("Second chance: 30% → 35% of your oil");
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

describe("the first Days' guide", async () => {
  const { dayGuide, GUIDE_DAYS } = await import("../src/night/day.js");
  it("an upgrade you can pay: the Lighthouse first, else the cheapest", () => {
    const g = dayGuide(city({ stock: { wood: 200, fish: 200, pearls: 0 }, played: 1 }));
    expect(g).toEqual({ target: "lighthouse", text: "Upgrade the Lighthouse: your beam burns harder." });
    const lit = city({ buildings: { ...N.newCity().buildings, lighthouse: 2, refinery: 1, infirmary: 0 }, stock: { wood: 70, fish: 30, pearls: 0 }, played: 2 });
    expect(dayGuide(lit)).toEqual({ target: "refinery", text: "Upgrade the Refinery: more oil for the Night." });
  });

  it("nothing to pay: the next Night", () => {
    expect(dayGuide(city({ played: 1 }))).toEqual({ target: "night", text: "Start the next Night to bring back more." });
  });

  it("only in the first Days", () => {
    expect(dayGuide(city({ played: GUIDE_DAYS + 1, stock: { wood: 999, fish: 999, pearls: 0 } }))).toBe(null);
  });

  it("the panel marks what the guide points at, and says it", () => {
    const html = dayHtml(city({ stock: { wood: 200, fish: 200, pearls: 0 }, played: 1 }));
    expect(html).toContain("Upgrade the Lighthouse: your beam burns harder.");
    expect(html).toMatch(/class="b gold guide" data-act="upgrade" data-b="lighthouse"/);
  });
});

describe("the Barracks, the Harbor and the Observatory in the Day", () => {
  it("each says what it does for the Night", () => {
    expect(effectLine("barracks", city())).toBe("Build it: your rafts' troops hit 20% harder");
    expect(effectLine("harbor", city())).toBe("Rafts for your troops: 2 → 3");
    expect(effectLine("observatory", city())).toBe("Cards to draw from: 8 → 14");
    const grown = city({ buildings: { ...N.newCity().buildings, lighthouse: 5, barracks: 2, observatory: 3 } });
    expect(effectLine("barracks", grown)).toBe("Troops: +40% → +60%");
    expect(effectLine("observatory", grown)).toBe("Cards to draw from: all 26");
  });
});
