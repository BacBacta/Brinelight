import { describe, expect, it } from "vitest";
import { night as N } from "@brinelight/shared";
import { CITY_KEY, REJECTED_CITY_KEY, openCity, saveCity } from "../src/portal/save.js";
import type { PortalStore } from "../src/portal/store.js";

const memory = () => {
  const m = new Map<string, string>();
  const store: PortalStore = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  return { m, store };
};
const grown = (): N.PortalCity => ({ ...N.newCity(), buildings: { ...N.newCity().buildings, lighthouse: 3, refinery: 2, infirmary: 1 }, stock: { wood: 140, fish: 30, pearls: 10 }, won: 2, played: 4 });

describe("the portal's city on the device", () => {
  it("nothing saved: a new city", () => {
    expect(openCity(memory().store)).toEqual({ city: N.newCity(), rejected: false });
  });

  it("saved, then opened: the same city", () => {
    const { store } = memory();
    saveCity(store, grown());
    expect(openCity(store)).toEqual({ city: grown(), rejected: false });
  });

  it("a save edited by hand that the rules refuse: set aside untouched, and a new city", () => {
    const { m, store } = memory();
    const edited = JSON.stringify({ v: 1, city: { ...grown(), buildings: { ...N.newCity().buildings, lighthouse: 99, refinery: 1, infirmary: 0 } } });
    m.set(CITY_KEY, edited);
    expect(openCity(store)).toEqual({ city: N.newCity(), rejected: true });
    expect(m.get(REJECTED_CITY_KEY)).toBe(edited);
    expect(m.has(CITY_KEY)).toBe(false);
    for (const raw of ["{", "null", '{"v":9,"city":{}}', '"city"']) {
      m.set(CITY_KEY, raw);
      expect(openCity(store).rejected, raw).toBe(true);
    }
  });

  it("no storage (blocked, private window): a new city, and saving does nothing", () => {
    expect(openCity(null)).toEqual({ city: N.newCity(), rejected: false });
    expect(() => saveCity(null, grown())).not.toThrow();
  });

  it("a full or failing storage never stops the game", () => {
    const failing: PortalStore = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); }, removeItem: () => {} };
    expect(() => saveCity(failing, grown())).not.toThrow();
    expect(openCity(failing)).toEqual({ city: N.newCity(), rejected: false });
  });
});
