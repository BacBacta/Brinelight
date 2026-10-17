import { applyAction, newPlayerState, trainTime, type GameAction, type PlayerState } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { TRAINING_TEXT, TROOP_COLORS, trainingHtml } from "../src/city/training.js";
import { ICONS } from "../src/ui/icons.js";
import { SAVE_KEY, openSave, saveGame, type KeyValueStore } from "../src/state/save.js";

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const withBarracks = (level = 1): PlayerState => {
  const s = newPlayerState();
  return { ...s, buildings: { ...s.buildings, barracks: level }, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 } };
};
/** As main.ts does without an account: the shared rules, and no id, since nothing is sent. */
const trainLocally = (s: PlayerState, troop: Extract<GameAction, { type: "train" }>["troop"]) => applyAction(s, { id: "", type: "train", troop });

describe("the Barracks sheet", () => {
  it("the three troop types with the soldiers in your city, what each beats, a +N button for the Barracks' batch, and the cost", () => {
    const html = trainingHtml({ ...withBarracks(3), troops: { boarders: 25, harpooners: 7, crossbowmen: 0 } }, 1);
    expect(html).toContain("<h4>Train</h4>");
    expect(html.match(/data-troop-row=/g)).toHaveLength(3);
    // Each type's icon from the art direction's sheet, with the soldiers in your city.
    expect(html).toContain(`<div class="ph troop" style="background:${TROOP_COLORS.harpooners}33;color:${TROOP_COLORS.harpooners}">${ICONS.harpooners}<b>7</b></div>`);
    expect(html).toContain(ICONS.boarders);
    expect(html).toContain(ICONS.crossbowmen);
    expect(html).toContain("<b>Boarders</b><small>Beat harpooners</small>");
    expect(html).toContain("<b>Harpooners</b><small>Beat crossbowmen</small>");
    expect(html).toContain("<b>Crossbowmen</b><small>Beat boarders</small>");
    expect(html).toContain('data-act="train" data-troop="crossbowmen" aria-disabled="false">+60</button>');
    expect(html).toContain(TRAINING_TEXT.cost);
    expect(TRAINING_TEXT.cost).toBe("Cost: 3 fish and 2 wood per soldier.");
    expect(html).not.toContain('class="why"');
  });

  it("while a batch trains: what and how long, and the buttons give the rule's reason when tapped", () => {
    const r = trainLocally(withBarracks(), "boarders");
    if (!r.ok) throw new Error(r.reason);
    const html = trainingHtml(r.state, 1);
    expect(html).toContain("In progress: 20 boarders");
    expect(html).toContain('data-act="train" data-troop="harpooners" aria-disabled="true"');
  });

  it("not enough fish or wood: the reason under the list", () => {
    const html = trainingHtml({ ...withBarracks(), stock: { oil: 0, fish: 10, wood: 10, rope: 0 } }, 1);
    expect(html).toContain('<p class="why">Not enough resources</p>');
    expect(html).toContain('aria-disabled="true">+20</button>');
  });
});

describe("training without an account", () => {
  it("a batch started in the local game is saved on this device and joins your troops during time away", () => {
    const t0 = Date.UTC(2026, 9, 16, 12);
    const store = memoryStore();
    const s = withBarracks(2);
    const r = trainLocally(s, "crossbowmen");
    if (!r.ok) throw new Error(r.reason);
    saveGame(store, r.state, t0);
    const back = openSave(store, t0 + trainTime(40) * 1000);
    expect(back.rejected).toBe(false);
    expect(back.state.troops).toEqual({ ...s.troops, crossbowmen: s.troops.crossbowmen + 40 });
    expect(back.state.training).toBeNull();
  });

  it("a local save from before training loads with none in progress, never set aside", () => {
    const store = memoryStore();
    const { training: _t, ...old } = newPlayerState();
    store.data.set(SAVE_KEY, JSON.stringify({ v: 1, savedAt: 0, state: old }));
    const opened = openSave(store, 0);
    expect(opened.rejected).toBe(false);
    expect(opened.state).toEqual(newPlayerState());
  });
});
