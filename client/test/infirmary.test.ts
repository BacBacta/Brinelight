import { applyAction, emptyTroops, healTime, newPlayerState, type PlayerState, type Report } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { INFIRMARY_TEXT, bedsHtml, healingName, infirmaryHtml } from "../src/city/infirmary.js";
import { REPORT_TEXT, reportHtml } from "../src/sea/sheet.js";
import { SAVE_KEY, openSave, saveGame, type KeyValueStore } from "../src/state/save.js";

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const withWounded = (infirmary = 1): PlayerState => {
  const s = newPlayerState();
  return { ...s, buildings: { ...s.buildings, infirmary }, wounded: { boarders: 12, harpooners: 5, crossbowmen: 3 }, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 } };
};
/** As main.ts does without an account: the shared rules, and no id, since nothing is sent. */
const healLocally = (s: PlayerState) => applyAction(s, { id: "", type: "heal" });

describe("the Infirmary sheet", () => {
  it("its beds at every level, and at the next one", () => {
    const s = newPlayerState();
    expect(bedsHtml(s.buildings)).toBe('<div class="kv"><span>Beds</span><span>0</span><span>At level 1</span><span>60</span></div>');
    expect(bedsHtml({ ...s.buildings, infirmary: 2, lighthouse: 4 })).toContain("<span>Beds</span><span>120</span><span>At level 3</span><span>180</span>");
    // At the Lighthouse's level, no next level to show.
    expect(bedsHtml({ ...s.buildings, infirmary: 2, lighthouse: 2 })).toBe('<div class="kv"><span>Beds</span><span>120</span></div>');
  });

  it("the wounded by type, the beds in use, the losses saved, and the button that heals them all", () => {
    const html = infirmaryHtml({ ...withWounded(), techs: { stretchers: 2 } }, 1);
    expect(html).toContain("<h4>Wounded</h4>");
    expect(html).toContain("<span>Boarders</span><span>12</span><span>Harpooners</span><span>5</span><span>Crossbowmen</span><span>3</span>");
    expect(html).toContain("<span>Beds in use</span><span>20 / 60</span>");
    expect(html).toContain("<span>Battle losses saved</span><span>70%</span>");
    expect(html).toContain('data-act="heal" aria-disabled="false"');
    expect(html).toContain("Heal 20 wounded · 40 fish</button>");
    expect(html).toContain(INFIRMARY_TEXT.note);
    expect(html).not.toContain('class="why"');
  });

  it("not enough fish: the button stays, with the rule's reason under it", () => {
    const html = infirmaryHtml({ ...withWounded(), stock: { oil: 0, fish: 10, wood: 0, rope: 0 } }, 1);
    expect(html).toContain('data-act="heal" aria-disabled="true"');
    expect(html).toContain('<p class="why">Not enough resources</p>');
  });

  it("during a healing: how many and how long, and the beds are free; with no wounded: No wounded.", () => {
    const r = healLocally(withWounded());
    if (!r.ok) throw new Error(r.reason);
    const html = infirmaryHtml(r.state, 1);
    expect(html).toContain("Healing: 20 soldiers · ");
    expect(html).toContain("<span>Beds in use</span><span>0 / 60</span>");
    expect(html).not.toContain('data-act="heal"');
    expect(infirmaryHtml({ ...withWounded(), wounded: emptyTroops() }, 1)).toContain(`<p class="p" style="margin-top:6px">${INFIRMARY_TEXT.none}</p>`);
    expect(healingName(20)).toBe("Healing · 20 wounded");
  });
});

describe("the combat report, when no loss was saved", () => {
  const report: Report = {
    id: "r1",
    read: false,
    site: "camp-1",
    level: 1,
    win: true,
    attack: 300,
    defense: 100,
    sent: { boarders: 25, harpooners: 25, crossbowmen: 25 },
    losses: { boarders: 4, harpooners: 4, crossbowmen: 4 },
    wounded: emptyTroops(),
    enemy: { boarders: 8, harpooners: 8, crossbowmen: 8 },
    loot: { oil: 100, wood: 100, pearls: 2, rope: 0 },
  };

  it("with no Infirmary, as in the prototype: no Infirmary: all losses died", () => {
    expect(REPORT_TEXT.none).toBe("no Infirmary: all losses died");
    expect(reportHtml(report, false)).toContain(`<span>Wounded in the Infirmary</span><span>${REPORT_TEXT.none}</span>`);
  });

  it("with an Infirmary whose beds are all taken: no free bed in the Infirmary: all losses died", () => {
    expect(REPORT_TEXT.full).toBe("no free bed in the Infirmary: all losses died");
    expect(reportHtml(report, true)).toContain(`<span>Wounded in the Infirmary</span><span>${REPORT_TEXT.full}</span>`);
  });

  it("with wounded saved: how many of the losses are to heal", () => {
    expect(reportHtml({ ...report, wounded: { boarders: 2, harpooners: 2, crossbowmen: 3 } }, true)).toContain("<span>7 of 12 losses, to heal</span>");
  });
});

describe("healing without an account", () => {
  it("a healing started in the local game is saved on this device and the soldiers are back after time away", () => {
    const t0 = Date.UTC(2026, 9, 16, 12);
    const store = memoryStore();
    const s = withWounded();
    const r = healLocally(s);
    if (!r.ok) throw new Error(r.reason);
    saveGame(store, r.state, t0);
    const back = openSave(store, t0 + Math.ceil(healTime(20) * 1000));
    expect(back.rejected).toBe(false);
    expect(back.state.troops).toEqual({ boarders: s.troops.boarders + 12, harpooners: s.troops.harpooners + 5, crossbowmen: s.troops.crossbowmen + 3 });
    expect(back.state.healing).toBeNull();
  });

  it("a local save from before healing loads with none in progress, never set aside", () => {
    const store = memoryStore();
    const { healing: _h, ...old } = newPlayerState();
    store.data.set(SAVE_KEY, JSON.stringify({ v: 1, savedAt: 0, state: old }));
    const opened = openSave(store, 0);
    expect(opened.rejected).toBe(false);
    expect(opened.state).toEqual(newPlayerState());
  });
});
