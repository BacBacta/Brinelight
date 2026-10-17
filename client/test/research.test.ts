import { TECHS, applyAction, newPlayerState, techTime, type GameAction, type PlayerState } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { RESEARCH_TEXT, researchHtml } from "../src/city/research.js";
import { SAVE_KEY, openSave, saveGame, type KeyValueStore } from "../src/state/save.js";

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const withObservatory = (level = 1): PlayerState => {
  const s = newPlayerState();
  return { ...s, buildings: { ...s.buildings, observatory: level }, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 } };
};
/** As main.ts does without an account: the shared rules, and no id, since nothing is sent. */
const playLocally = (s: PlayerState, a: Omit<Extract<GameAction, { type: "research" }>, "id">) => applyAction(s, { ...a, id: "" });

describe("the Observatory sheet", () => {
  it("lists the 10 research by branch, each with its level, effect, cost and time", () => {
    const html = researchHtml(withObservatory(), 1);
    expect(html).toContain(RESEARCH_TEXT.intro);
    for (const branch of ["Economy", "Sea", "War"]) expect(html).toContain(`<h4 class="brh">${branch}</h4>`);
    expect(html.match(/data-tech-row=/g)).toHaveLength(Object.keys(TECHS).length);
    expect(html).toContain('data-act="research" data-tech="refining" aria-disabled="false"');
    expect(html).toContain("Refining <span");
  });

  it("names the Observatory level a research needs, and shows Max and In progress", () => {
    const s = { ...withObservatory(), techs: { blades: TECHS.blades.max } };
    const r = playLocally(s, { type: "research", tech: "refining" });
    if (!r.ok) throw new Error(r.reason);
    const html = researchHtml(r.state, 1);
    expect(html).toContain("Requires Observatory Lv 2");
    expect(html).toMatch(/data-tech-row="blades".*?<span class="chip ok">Max<\/span>/);
    expect(html).toMatch(/data-tech-row="refining".*?<span class="chip">In progress<\/span>/);
    expect(html).toContain("In progress: Refining");
    // Another research is refused while one runs: still tappable, the tap gives the reason.
    expect(html).toContain('data-act="research" data-tech="nets" aria-disabled="true"');
  });

  it("the Veteran Doctrine has no \"coming soon\" note any more: veterans are promoted at the Barracks", () => {
    const html = researchHtml(withObservatory(3), 1);
    expect(html).toMatch(/data-tech-row="veterans".*?<small>Unlocks veterans at the Barracks<\/small>/);
    expect(html).not.toContain("coming soon");
  });
});

describe("research without an account", () => {
  it("starts in the local game, is saved on this device, and ends during time away", () => {
    const t0 = Date.UTC(2026, 9, 16, 12);
    const store = memoryStore();
    const r = playLocally(withObservatory(), { type: "research", tech: "nets" });
    if (!r.ok) throw new Error(r.reason);
    saveGame(store, r.state, t0);
    const back = openSave(store, t0 + techTime("nets", 0) * 1000);
    expect(back.rejected).toBe(false);
    expect(back.state.techs).toEqual({ nets: 1 });
    expect(back.state.research).toBeNull();
  });

  it("a local save from before research loads with none in progress, never set aside", () => {
    const store = memoryStore();
    const { research: _r, ...old } = newPlayerState();
    store.data.set(SAVE_KEY, JSON.stringify({ v: 1, savedAt: 0, state: old }));
    const opened = openSave(store, 0);
    expect(opened.rejected).toBe(false);
    expect(opened.state).toEqual(newPlayerState());
  });
});
