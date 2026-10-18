import { STARTING_BUILDINGS, emptyTroops, oilAutonomy, power, storeCap } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { newPlayerState, sail } from "@brinelight/shared";
import { NAV_ITEMS } from "../src/ui/nav.js";
import { MAX_TOASTS, keepToasts } from "../src/ui/toast.js";
import { FULL_AT, cityPower, fillRatio, longAmount, mistPreview, mistText, rateText, seaMood, shortAmount, survivorsText } from "../src/ui/values.js";

describe("amounts", () => {
  it("short amounts for the pills, as in the prototype", () => {
    expect(shortAmount(520.9)).toBe("520");
    expect(shortAmount(1250)).toBe("1.2 k");
    expect(shortAmount(6500)).toBe("6.5 k");
    expect(shortAmount(12_345)).toBe("12 k");
  });

  it("longer amounts for the Power", () => {
    expect(longAmount(2312)).toBe("2,312");
    expect(longAmount(12_345)).toBe("12.3 k");
    expect(longAmount(123_456)).toBe("123 k");
  });

  it("net rates per hour, with their sign", () => {
    expect(rateText(14)).toBe("+14.0/h");
    expect(rateText(0)).toBe("+0.0/h");
    expect(rateText(-0.44)).toBe("−0.4/h");
  });
});

describe("top bar values from the shared rules", () => {
  it("the gauge is the stock over storeCap", () => {
    const s = newPlayerState();
    const cap = storeCap(STARTING_BUILDINGS.lighthouse);
    expect(fillRatio(s, cap / 2)).toBe(0.5);
    expect(fillRatio(s, cap * 2)).toBe(1);
    expect(fillRatio(s, cap * FULL_AT)).toBeCloseTo(0.95);
  });

  it("the Power is power() for the starting city", () => {
    const s = newPlayerState();
    const expected = power({
      buildings: s.buildings,
      troops: s.troops,
      veterans: emptyTroops(),
      captains: [{ rarity: "officer", stars: 1, level: 1 }],
      techs: {},
      rafts: {},
    });
    expect(cityPower(s)).toBe(expected);
  });

  it("troops at sea still count in the Power", () => {
    const s = newPlayerState();
    const r = sail(s, "camp-1");
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.troops.boarders).toBe(0);
    expect(cityPower(r.state)).toBe(cityPower(s));
  });

  it("survivors over the shelters' capacity", () => {
    expect(survivorsText(newPlayerState())).toBe("8/10");
  });

  it("the Mist banner, before a Mist: when it comes, and whether your oil lasts through it stoked", () => {
    // Clock 0 is midnight UTC: the next Mist is at 04:00.
    const s = newPlayerState();
    expect(mistText({ ...s, buildings: { ...s.buildings, refinery: 5 } })).toBe("Mist in 4 h 00 · enough oil");
    // No Refinery: the stoked Lighthouse level 2 burns 11 oil per hour (oilAutonomy), so 110 oil last 10 h; 5 oil, 27 min.
    const noRefinery = { ...s, buildings: { ...s.buildings, refinery: 0 } };
    expect(oilAutonomy(noRefinery, 110)).toBeCloseTo(10 * 3600);
    expect(mistText({ ...noRefinery, stock: { ...s.stock, oil: 110 } })).toBe("Mist in 4 h 00 · enough oil");
    expect(mistText({ ...noRefinery, stock: { ...s.stock, oil: 5 } })).toBe("Mist in 4 h 00 · not enough oil");
    expect(mistText({ ...s, clock: 3 * 3600 + 8 * 60 + 30 })).toBe("Mist in 52 min · enough oil");
    expect(mistText({ ...s, mist: { ...s.mist, stoke: false } })).toBe("Mist in 4 h 00 · stoking off");
  });

  it("the Mist banner, during a Mist: how long it has left, the Lighthouse stoked or dark", () => {
    const s = { ...newPlayerState(), clock: 4 * 3600 + 50 * 60 };
    expect(mistText(s)).toBe("Mist · 1 h 10 left · Lighthouse stoked");
    expect(mistText({ ...s, mist: { ...s.mist, dark: true } })).toBe("Mist · 1 h 10 left · Lighthouse dark");
  });

  it("the sea's mood: the Mist when the rules say so, or with ?mist to see its look", () => {
    const s = newPlayerState();
    expect(mistPreview("")).toBe(false);
    expect(mistPreview("?quality=2&fps")).toBe(false);
    expect(mistPreview("?mist")).toBe(true);
    expect(mistPreview("?fps&mist")).toBe(true);
    expect(seaMood(s)).toBe("calm");
    expect(seaMood(s, true)).toBe("mist");
    expect(seaMood({ ...s, clock: 4 * 3600 })).toBe("mist");
    expect(seaMood({ ...s, clock: 6 * 3600 })).toBe("calm");
    // ?mist outside a Mist: how long your oil lasts stoked, as in week 6.
    const noRefinery = { ...s, buildings: { ...s.buildings, refinery: 0 }, stock: { ...s.stock, oil: 110 } };
    expect(mistText(noRefinery, true)).toBe("Mist · oil for 10 h 00");
    expect(mistText({ ...s, buildings: { ...s.buildings, refinery: 5 } }, true)).toBe("Mist · your oil holds");
  });
});

describe("menus and toasts", () => {
  it("the bottom menu keeps all 5 buttons; the city, the sea and the captains are ready", () => {
    expect(NAV_ITEMS.map((n) => n.label)).toEqual(["City", "Sea", "Captains", "Alliance", "Shop"]);
    expect(NAV_ITEMS.filter((n) => n.ready).map((n) => n.id)).toEqual(["city", "sea", "captains"]);
  });

  it("at most 2 toasts at a time, the oldest goes first", () => {
    expect(MAX_TOASTS).toBe(2);
    expect(keepToasts(["a"], "b")).toEqual(["a", "b"]);
    expect(keepToasts(["a", "b"], "c")).toEqual(["b", "c"]);
  });
});

describe("a number that rolls", () => {
  it("from its old value to its new one in ROLL_MS, fast at first, then easing into place", async () => {
    const { ROLL_MS, rolled } = await import("../src/ui/values.js");
    expect(ROLL_MS).toBe(400);
    expect(rolled(1000, 400, 0)).toBe(1000);
    expect(rolled(1000, 400, ROLL_MS)).toBe(400);
    expect(rolled(1000, 400, 10 * ROLL_MS)).toBe(400);
    // Halfway in time, more than halfway in value.
    expect(rolled(1000, 400, ROLL_MS / 2)).toBeLessThan(700);
    expect(rolled(0, 100, -5)).toBe(0);
  });
});
