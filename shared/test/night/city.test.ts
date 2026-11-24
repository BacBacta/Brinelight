import { describe, expect, it } from "vitest";
import { CITY_BUILDINGS, CITY_MAX_LEVEL, CITY_SHAPE, newCity, nextNight, parseCity, type PortalCity } from "../../src/rules/night/city.js";
import { NIGHTS } from "../../src/rules/night/values.js";

const city = (): PortalCity => newCity();
const withField = (key: string, value: unknown): unknown => {
  const o: Record<string, unknown> = JSON.parse(JSON.stringify(city()));
  if (value === undefined) delete o[key];
  else o[key] = value;
  return o;
};

describe("the portal's city", () => {
  it("starts with its Lighthouse and its Refinery at level 1, no Infirmary, nothing in store, no Night won", () => {
    expect(city()).toEqual({ v: CITY_SHAPE, buildings: { lighthouse: 1, refinery: 1, infirmary: 0, barracks: 0, harbor: 0, observatory: 0 }, stock: { wood: 0, fish: 0, pearls: 0 }, won: 0, played: 0, captains: newCity().captains, record: 0 });
    expect(CITY_BUILDINGS).toHaveLength(6);
  });

  it("plays the Night after the last one won, never past the last Night", () => {
    expect(nextNight(city())).toBe(1);
    expect(nextNight({ ...city(), won: 2 })).toBe(3);
    expect(nextNight({ ...city(), won: NIGHTS })).toBe(NIGHTS);
  });
});

describe("parseCity: a save read back is strict", () => {
  it("a city passes unchanged", () => {
    const c = { ...city(), buildings: { ...city().buildings, lighthouse: 4, refinery: 2, infirmary: 1 }, stock: { wood: 320, fish: 90, pearls: 10 }, won: 2, played: 5 };
    expect(parseCity(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });

  it("refuses what is not a city", () => {
    for (const raw of [null, 1, "city", [], {}]) expect(parseCity(raw), String(raw)).toBe(null);
  });

  it("refuses each field missing, unknown or out of its range", () => {
    const bad: [string, unknown][] = [
      ["v", 0],
      ["v", 5],
      ["record", -1],
      ["buildings", { lighthouse: 1, refinery: 1 }],
      ["buildings", { lighthouse: 0, refinery: 1, infirmary: 0, barracks: 0, harbor: 0, observatory: 0 }],
      ["buildings", { lighthouse: 1, refinery: 0, infirmary: 0, barracks: 0, harbor: 0, observatory: 0 }],
      ["buildings", { lighthouse: CITY_MAX_LEVEL + 1, refinery: 1, infirmary: 0, barracks: 0, harbor: 0, observatory: 0 }],
      ["buildings", { lighthouse: 1.5, refinery: 1, infirmary: 0, barracks: 0, harbor: 0, observatory: 0 }],
      ["buildings", { lighthouse: 1, refinery: 1, infirmary: 0, barracks: 1 }],
      ["stock", { wood: -1, fish: 0, pearls: 0 }],
      ["stock", { wood: 0.5, fish: 0, pearls: 0 }],
      ["stock", { wood: 0, fish: 0 }],
      ["won", -1],
      ["won", NIGHTS + 1],
      ["played", -1],
      ["extra", true],
    ];
    for (const [k, v] of bad) expect(parseCity(withField(k, v)), `${k}: ${JSON.stringify(v)}`).toBe(null);
    for (const k of Object.keys(city())) expect(parseCity(withField(k, undefined)), `without ${k}`).toBe(null);
    // Won more Nights than it played: edited.
    expect(parseCity({ ...city(), won: 2, played: 1 })).toBe(null);
  });
});
