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

describe("the sea chart in the Day", async () => {
  const { chartHtml } = await import("../src/night/day.js");
  it("30 Nights: those won marked, the next lit, the others locked; the one chosen named with its rule", () => {
    const c = city({ won: 3, played: 5 });
    const html = chartHtml(c, 4);
    expect(html.match(/data-night=/g)).toHaveLength(30);
    expect(html).toMatch(/data-night="1"[^>]*class="dot won"/);
    expect(html).toMatch(/data-night="4"[^>]*class="dot next chosen"/);
    expect(html).toMatch(/data-night="5"[^>]*class="dot locked"[^>]*disabled/);
    expect(html).toContain("Night 4");
    expect(chartHtml(city({ won: 7, played: 7 }), 8)).toContain("Night 8 · Night of Wraiths");
  });

  it("a Night won can be chosen again: the button says which", () => {
    const html = dayHtml(city({ won: 3, played: 5 }), 2);
    expect(html).toContain("Start Night 2");
    expect(html).toMatch(/data-night="2"[^>]*class="dot won chosen"/);
  });
});

describe("the captains in the Day", async () => {
  const { captainsHtml } = await import("../src/night/day.js");
  it("those who joined, with their power and Lead; the others with their shards", () => {
    const c = city({ captains: { lead: "tom", unlocked: ["tom", "bran"], shards: { tom: 0, bran: 12, isa: 4, mira: 0, nera: 0, sel: 0 } } });
    const html = captainsHtml(c);
    expect(html).toContain("Old Tom");
    expect(html).toContain("Leading");
    expect(html).toContain("Bran the Boarder");
    expect(html).toMatch(/data-act="lead" data-c="bran"/);
    expect(html).toContain("Boarding");
    expect(html).toContain("Isa the Harpooner");
    expect(html).toContain("4/10 shards");
  });
});

describe("the Endless Night in the Day", async () => {
  const { chartHtml } = await import("../src/night/day.js");
  it("its dot once Night 5 is won, and your record", () => {
    expect(chartHtml(city({ won: 4, played: 4 }), 5)).not.toContain("∞");
    const c = city({ won: 5, played: 6, record: 17 });
    expect(chartHtml(c, 6)).toContain("∞");
    expect(chartHtml(c, N.ENDLESS)).toContain("Endless Night · your record: 17 waves");
    expect(dayHtml(c, N.ENDLESS)).toContain("Start the Endless Night");
  });
});

describe("today, in the Day", async () => {
  const { todayHtml } = await import("../src/night/day.js");
  it("the tasks and their progress, the chests, the free recruitment and its published odds", () => {
    const c = city({ daily: { day: 5, counts: { nights: 2, wins: 1, burned: 140, waves: 6, upgrades: 0 }, chests: [30], recruited: false } });
    const html = todayHtml(c);
    expect(html).toContain("Play 3 Nights");
    expect(html).toContain("2/3");
    expect(html).toContain("100/100");
    expect(html).toMatch(/data-act="chest" data-p="30"[^>]*disabled/);
    expect(html).toMatch(/data-act="chest" data-p="60"[^>]*disabled/);
    expect(html).toMatch(/data-act="recruit"(?![^>]*disabled)/);
    expect(html).toContain("Admiral 5% · Commander 25% · Officer 70%");
    expect(todayHtml(city({ daily: { ...c.daily, recruited: true } }))).toContain("Come back tomorrow");
  });
});

describe("the portal speaks English", () => {
  it("no French name of the Brinelight on Solana's sea in what the Day shows", () => {
    const c = city({ won: 12, played: 20, record: 4, captains: { lead: "tom", unlocked: [...N.CAPTAIN_IDS], shards: N.newCity().captains.shards } });
    for (let k = 1; k <= N.ENDLESS; k++) expect(dayHtml(c, Math.min(k, 13))).not.toMatch(/Murène|Vorace|Barbe-Sel|Lierre|Orme|Perle|Ondine|Topaze|Gaspard|Krake\b/);
  });
});

describe("the sounds' switch in the Day", () => {
  it("says whether the sounds are on, and M turns them", () => {
    expect(dayHtml(city(), 1, true)).toContain("Sounds: On");
    expect(dayHtml(city(), 1, false)).toMatch(/aria-pressed="false"[^>]*>Sounds: Off/);
  });
});
