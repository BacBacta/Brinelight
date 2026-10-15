import { STARTING_BUILDINGS, emptyTroops, oilAutonomy, power, storeCap } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { newPlayerState, sail } from "../src/state/state.js";
import { NAV_ITEMS } from "../src/ui/nav.js";
import { MAX_TOASTS, keepToasts } from "../src/ui/toast.js";
import { FULL_AT, cityPower, fillRatio, longAmount, mistText, rateText, shortAmount, survivorsText } from "../src/ui/values.js";

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

  it("the Mist banner has no countdown and says how long the oil lasts", () => {
    const s = newPlayerState();
    expect(mistText({ ...s, buildings: { ...s.buildings, refinery: 5 } })).toBe("Calm sea · your oil holds in the Mist");
    // No Refinery: the stoked Lighthouse level 2 burns 11 oil per hour (oilAutonomy), so 110 oil last 10 h.
    const noRefinery = { ...s, buildings: { ...s.buildings, refinery: 0 } };
    expect(oilAutonomy(noRefinery, 110)).toBeCloseTo(10 * 3600);
    expect(mistText({ ...noRefinery, stock: { ...s.stock, oil: 110 } })).toBe("Calm sea · oil for 10 h 00 in the Mist");
    expect(mistText({ ...noRefinery, stock: { ...s.stock, oil: 5 } })).toBe("Calm sea · oil for 27 min in the Mist");
  });
});

describe("menus and toasts", () => {
  it("the bottom menu keeps all 5 buttons; the city and the sea are ready", () => {
    expect(NAV_ITEMS.map((n) => n.label)).toEqual(["City", "Sea", "Captains", "Alliance", "Shop"]);
    expect(NAV_ITEMS.filter((n) => n.ready).map((n) => n.id)).toEqual(["city", "sea"]);
  });

  it("at most 2 toasts at a time, the oldest goes first", () => {
    expect(MAX_TOASTS).toBe(2);
    expect(keepToasts(["a"], "b")).toEqual(["a", "b"]);
    expect(keepToasts(["a", "b"], "c")).toEqual(["b", "c"]);
  });
});
