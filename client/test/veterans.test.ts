import { DAY, PROMOTE_TIME, advance, applyAction, emptyTroops, newPlayerState, type PlayerState, type Report } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { TRAINING_TEXT, trainingHtml, veteransHtml } from "../src/city/training.js";
import { REPORT_TEXT, reportHtml } from "../src/sea/sheet.js";
import { attackInput } from "../src/sea/odds.js";
import { ICONS } from "../src/ui/icons.js";
import { cityPower } from "../src/ui/values.js";
import { SAVE_KEY, openSave, saveGame, type KeyValueStore } from "../src/state/save.js";

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
/** The Veteran Doctrine, the Barracks at level 3, soldiers, fish and oil. */
const ready = (): PlayerState => {
  const s = newPlayerState();
  return {
    ...s,
    buildings: { ...s.buildings, barracks: 3 },
    techs: { veterans: 1 },
    troops: { boarders: 25, harpooners: 7, crossbowmen: 12 },
    stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 },
  };
};
/** As main.ts does without an account: the shared rules, and no id, since nothing is sent. */
const promoteLocally = (s: PlayerState, troop: "boarders" | "harpooners" | "crossbowmen") => {
  const r = applyAction(s, { id: "", type: "promote", troop });
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};

describe("the veterans box of the Barracks", () => {
  it("without the Doctrine or below level 3: what it needs, in the prototype's words", () => {
    expect(TRAINING_TEXT.locked).toBe("You need the Veteran Doctrine research at the Observatory and Barracks at level 3.");
    for (const s of [{ ...ready(), techs: {} }, { ...ready(), buildings: { ...ready().buildings, barracks: 2 } }]) {
      const html = veteransHtml(s);
      expect(html).toContain(`<h4 class="with-icon">${ICONS.veteran}Veterans</h4>`);
      expect(html).toContain(TRAINING_TEXT.locked);
      expect(html).not.toContain('data-act="promote"');
    }
  });

  it("open: soldiers and veterans by type, a Promote 10 button each, refused ones still tappable", () => {
    const s = { ...ready(), veterans: { ...emptyTroops(), crossbowmen: 10 } };
    const html = veteransHtml(s);
    expect(TRAINING_TEXT.veterans).toBe("One veteran is worth 1.8 soldiers. Promoting 10 soldiers costs 60 fish and 40 oil.");
    expect(html).toContain(TRAINING_TEXT.veterans);
    expect(html).toContain("<b>Boarders</b><small>25 soldiers · 0 veterans</small>");
    expect(html).toContain("<b>Harpooners</b><small>7 soldiers · 0 veterans</small>");
    expect(html).toContain("<b>Crossbowmen</b><small>12 soldiers · 10 veterans</small>");
    expect(html).toContain('data-act="promote" data-troop="boarders" aria-disabled="false">Promote 10</button>');
    // Only 7 harpooners: refused, the tap gives the reason.
    expect(html).toContain('data-act="promote" data-troop="harpooners" aria-disabled="true">Promote 10</button>');
  });

  it("follows the training box in the Barracks sheet; while a promotion runs, what and how long", () => {
    const html = trainingHtml(promoteLocally(ready(), "boarders"), 1);
    expect(html.indexOf("<h4>Train</h4>")).toBeLessThan(html.indexOf("Veterans</h4>"));
    expect(html).toContain("In progress: 10 veteran boarders · 36:00");
    expect(html).toContain("<b>Boarders</b><small>15 soldiers · 0 veterans</small>");
    expect(html).toContain('data-act="promote" data-troop="crossbowmen" aria-disabled="true"');
  });
});

describe("veterans in the city", () => {
  it("count in your Power, 8 each, at home and at sea", () => {
    const s = ready();
    const vets = { ...s, veterans: { ...emptyTroops(), boarders: 10 } };
    expect(cityPower(vets) - cityPower(s)).toBe(80);
  });

  it("count in the odds shown before you sail", () => {
    const s = { ...ready(), veterans: { ...emptyTroops(), harpooners: 10 } };
    expect(attackInput(s, emptyTroops()).veterans).toEqual(s.veterans);
  });

  it("a promotion started in the local game is saved on this device and ends during time away", () => {
    const t0 = Date.UTC(2026, 9, 17, 12);
    const store = memoryStore();
    saveGame(store, promoteLocally(ready(), "crossbowmen"), t0);
    const back = openSave(store, t0 + PROMOTE_TIME * 1000);
    expect(back.rejected).toBe(false);
    expect(back.state.veterans).toEqual({ ...emptyTroops(), crossbowmen: 10 });
    expect(back.state.training).toBeNull();
  });

  it("a local save from before the veterans loads with none, never set aside", () => {
    const store = memoryStore();
    const { veterans: _v, ...old } = newPlayerState();
    store.data.set(SAVE_KEY, JSON.stringify({ v: 1, savedAt: 0, state: old }));
    const opened = openSave(store, 0);
    expect(opened.rejected).toBe(false);
    expect(opened.state).toEqual(newPlayerState());
  });
});

describe("the combat report with veterans", () => {
  const sailed = (() => {
    const s = advance(promoteLocally(ready(), "boarders"), PROMOTE_TIME);
    const away = applyAction(s, { id: "", type: "sail", site: "camp-1" });
    if (!away.ok) throw new Error(away.reason);
    return advance(away.state, DAY).reports[0]!;
  })();

  it("shows the veterans sent with their icon, and counts the lost ones in the losses", () => {
    const html = reportHtml(sailed);
    expect(html).toContain(`<span class="adv vet">${ICONS.veteran}+10 vet.</span>`);
    const lost = sailed.losses.boarders + sailed.veteranLosses!.boarders;
    expect(html).toMatch(new RegExp(`<td>Boarders.*?<td class="l">−${lost}</td>`));
    expect(html).toContain(REPORT_TEXT.rules);
    expect(REPORT_TEXT.rules).toContain("One veteran is worth 1.8 soldiers.");
  });

  it("a report without veterans shows none", () => {
    const { veteranSent: _s, veteranLosses: _l, ...old } = sailed;
    const r: Report = { ...old, losses: { ...old.losses } };
    expect(reportHtml(r)).not.toContain("vet.</span>");
    expect(reportHtml({ ...sailed, veteranSent: emptyTroops(), veteranLosses: emptyTroops() })).not.toContain("vet.</span>");
  });
});
