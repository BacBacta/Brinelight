import { describe, expect, it } from "vitest";
import { PORTAL_KEY, portalStore, type PortalStore } from "../src/portal/store.js";
import { SAVE_KEY, SEEN_KEY } from "../src/state/index.js";
import { settingsHtml } from "../src/ui/settings.js";

const memory = () => {
  const m = new Map<string, string>();
  const store: PortalStore = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  return { m, store };
};

describe("the portal's store: everything it keeps on the device, apart", () => {
  it("is its own key, never one of the Brinelight on Solana", () => {
    expect(PORTAL_KEY).toBe("brinelight-portal-v1");
    expect([SAVE_KEY, SEEN_KEY]).not.toContain(PORTAL_KEY);
  });

  it("writes and reads under brinelight-portal-v1/, never the game's own keys", () => {
    const { m, store } = memory();
    m.set(SAVE_KEY, "the city on Solana");
    const portal = portalStore(store)!;
    expect(portal.getItem(SAVE_KEY)).toBe(null);
    portal.setItem(SAVE_KEY, "the portal's city");
    expect(m.get(`${PORTAL_KEY}/${SAVE_KEY}`)).toBe("the portal's city");
    expect(m.get(SAVE_KEY)).toBe("the city on Solana");
    expect(portal.getItem(SAVE_KEY)).toBe("the portal's city");
    portal.removeItem(SAVE_KEY);
    expect(m.has(`${PORTAL_KEY}/${SAVE_KEY}`)).toBe(false);
    expect(m.get(SAVE_KEY)).toBe("the city on Solana");
  });

  it("no storage (blocked, private window): none", () => {
    expect(portalStore(null)).toBe(null);
  });
});

describe("the Settings sheet", () => {
  it("the sounds' switch, and not a word of accounts", () => {
    for (const on of [true, false]) {
      const html = settingsHtml(on);
      expect(html).toContain("Sounds");
      expect(html).toContain(`aria-pressed="${on}"`);
      expect(html).not.toMatch(/account|wallet|sign|solana|phantom/i);
    }
  });
});
