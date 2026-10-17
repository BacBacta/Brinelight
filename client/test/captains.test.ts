import { DAY, advance, applyAction, newPlayerState, type PlayerState } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { CAPTAINS_TEXT, captainLevelText, captainsHtml } from "../src/ui/captains.js";
import { NAV_ITEMS } from "../src/ui/nav.js";
import { reportHtml, shardsForText } from "../src/sea/sheet.js";
import { SAVE_KEY, openSave, saveGame, type KeyValueStore } from "../src/state/save.js";

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
/** As main.ts does without an account: the shared rules, and no id, since nothing is sent. */
const locally = (s: PlayerState, a: Parameters<typeof applyAction>[1] extends infer T ? (T extends { id: string } ? Omit<T, "id"> : never) : never) => {
  const r = applyAction(s, { id: "", ...a } as Parameters<typeof applyAction>[1]);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};

describe("the Captains sheet", () => {
  it("opens from the bottom menu, over the view you are in", () => {
    expect(NAV_ITEMS.find((n) => n.id === "captains")).toEqual({ id: "captains", label: "Captains", ready: true, sheet: true });
  });

  it("the Logbook for the lead captain, and the six captains with portrait, stars, rarity, skill, level, experience and shards", () => {
    const s: PlayerState = { ...newPlayerState(), captains: { tom: { level: 3, xp: 40, stars: 2 } }, shards: { sel: 4, tom: 10 } };
    const html = captainsHtml(s);
    expect(html).toContain(CAPTAINS_TEXT.logbook);
    expect(html).toContain('data-act="logbook" aria-disabled="false" style="margin-top:8px">Logbook for Old Tom · 50 Pearls</button>');
    expect(html.match(/data-captain-row=/g)).toHaveLength(6);
    expect(html).toContain('<img src="/captains/tom-96.webp" alt="" draggable="false"><span class="st">★★</span>');
    expect(html).toContain("<b>Old Tom</b><small>Officer · +30% gathering</small><small>Lv 3 · 40/240 XP · shards 10/10</small>");
    expect(html).toContain('<span class="chip ok">Leading</span>');
    expect(html).toContain('data-act="star" data-captain="tom" aria-disabled="false"');
    // A captain not recruited yet: dimmed, its shards, Unlock refused until 10.
    expect(html).toContain('class="it captain r-officer locked" data-captain-row="sel"');
    expect(html).toContain("<b>Sel the Navigator</b><small>Officer · +40% fleet speed</small><small>Not recruited · shards 4/10</small>");
    expect(html).toContain('data-act="unlock" data-captain="sel" aria-disabled="true">Unlock</button>');
    expect(html).toContain('<span class="st">?</span>');
    // No recruitment this week.
    expect(html).not.toMatch(/Recruit a captain|Next in/);
  });

  it("an owned captain who does not lead: a Lead button; 5 stars: no star button, Max stars; level 20: Max level", () => {
    const s: PlayerState = { ...newPlayerState(), captains: { tom: { level: 1, xp: 0, stars: 1 }, mira: { level: 20, xp: 900, stars: 5 } } };
    const html = captainsHtml(s);
    expect(html).toContain('data-act="lead" data-captain="mira">Lead</button>');
    expect(html).not.toContain('data-act="star" data-captain="mira"');
    expect(html).toContain("<small>Lv 20 · Max level · Max stars</small>");
    expect(captainLevelText({ level: 2, xp: 10 })).toBe("Lv 2 · 10/160 XP");
  });

  it("the Logbook refused: the reason under it, the button still tappable", () => {
    const html = captainsHtml({ ...newPlayerState(), pearls: 10 });
    expect(html).toContain('data-act="logbook" aria-disabled="true"');
    expect(html).toContain('<p class="why">Not enough Pearls</p>');
  });
});

describe("the camp's captain and the report", () => {
  it("a camp's sheet names its captain and your shards; with 5 stars it says so", () => {
    expect(shardsForText({ captains: {}, shards: { sel: 3 } }, "sel")).toBe("Shards for Sel the Navigator · 3/10");
    expect(shardsForText({ captains: {}, shards: {} }, "nera")).toBe("Shards for Nera of the Mist · 0/10");
    expect(shardsForText({ captains: { sel: { level: 2, xp: 0, stars: 5 } }, shards: { sel: 14 } }, "sel")).toBe("Sel the Navigator has max stars.");
  });

  it("a victory's report: the captain's experience and the shards", () => {
    const won = advance(locally({ ...newPlayerState(), troops: { boarders: 200, harpooners: 200, crossbowmen: 200 } }, { type: "sail", site: "camp-1" }), DAY);
    const html = reportHtml(won.reports[0]!);
    expect(html).toContain("<div><span>Captain</span><span>Old Tom · +30 XP</span></div>");
    expect(html).toContain("<div><span>Shards</span><span>+1 for Sel the Navigator</span></div>");
  });

  it("a level-up is said in the report; an older report without them shows neither", () => {
    const s: PlayerState = { ...newPlayerState(), captains: { tom: { level: 1, xp: 70, stars: 1 } }, troops: { boarders: 200, harpooners: 200, crossbowmen: 200 } };
    const won = advance(locally(s, { type: "sail", site: "camp-1" }), DAY);
    expect(reportHtml(won.reports[0]!)).toContain("Old Tom · +30 XP · +1 level");
    const { captainXp: _x, shards: _s, ...old } = won.reports[0]!;
    expect(reportHtml(old)).not.toContain("<span>Captain</span>");
    expect(reportHtml(old)).not.toContain("<span>Shards</span>");
  });
});

describe("captains without an account", () => {
  it("shards spent in the local game are saved on this device", () => {
    const store = memoryStore();
    const s = locally({ ...newPlayerState(), shards: { sel: 12 } }, { type: "unlockCaptain", captain: "sel" });
    saveGame(store, locally(s, { type: "setLead", captain: "sel" }), 0);
    const back = openSave(store, 0);
    expect(back.rejected).toBe(false);
    expect(back.state.captains.sel).toEqual({ level: 1, xp: 0, stars: 1 });
    expect(back.state.lead).toBe("sel");
    expect(back.state.shards).toEqual({ sel: 2 });
  });

  it("a local save from before the shards loads with none, never set aside", () => {
    const store = memoryStore();
    const { shards: _s, ...old } = newPlayerState();
    store.data.set(SAVE_KEY, JSON.stringify({ v: 1, savedAt: 0, state: old }));
    const opened = openSave(store, 0);
    expect(opened.rejected).toBe(false);
    expect(opened.state).toEqual(newPlayerState());
  });
});
