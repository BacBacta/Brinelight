import { HOUR, OFFLINE_CAP, STARTING_BUILDINGS, STARTING_STOCK, netRates, storeCap, upgradeCost, upgradeTime } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { SAVE_KEY, loadGame, saveGame, type KeyValueStore } from "../src/state/save.js";
import { advance, catchUp, elapse, newPlayerState, tick, upgrade } from "../src/state/state.js";

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe("new city", () => {
  it("starts from the shared starting values", () => {
    const s = newPlayerState();
    expect(s.buildings).toEqual(STARTING_BUILDINGS);
    expect(s.stock).toEqual(STARTING_STOCK);
    expect(s.captains).toEqual({ tom: { level: 1, xp: 0, stars: 1 } });
  });

  it("does not share objects with the shared constants", () => {
    const s = newPlayerState();
    s.stock.oil = 0;
    expect(STARTING_STOCK.oil).toBe(380);
  });
});

describe("production", () => {
  it("1 hour advances the stock exactly as netRates says", () => {
    const s = newPlayerState();
    const r = netRates(s);
    const after = advance(s, HOUR).stock;
    expect(after.oil).toBeCloseTo(s.stock.oil + r.oil);
    expect(after.fish).toBeCloseTo(s.stock.fish + r.fish);
    expect(after.wood).toBeCloseTo(s.stock.wood + r.wood);
    expect(after.rope).toBe(s.stock.rope);
  });

  it("stops at the storage cap", () => {
    const s = advance(newPlayerState(), 1000 * HOUR);
    expect(s.stock.wood).toBe(storeCap(s.buildings.lighthouse, s.techs));
  });

  it("never drops below 0", () => {
    const s = newPlayerState();
    s.buildings.refinery = 0;
    expect(advance(s, 1000 * HOUR).stock.oil).toBe(0);
  });

  it("live time is sped up: 1 real minute at speed 60 is 1 hour", () => {
    const s = newPlayerState();
    expect(tick(s, 60, 60)).toEqual(advance(s, HOUR));
  });
});

describe("save and time away", () => {
  const t0 = Date.UTC(2026, 9, 15, 12);

  it("saves under brinelight-client-v1 and loads the same city", () => {
    const store = memoryStore();
    const s = advance(newPlayerState(), 2 * HOUR);
    saveGame(store, s, t0);
    expect(store.data.has(SAVE_KEY)).toBe(true);
    expect(loadGame(store, t0)).toEqual(s);
  });

  it("time away uses real elapsed time, never sped up", () => {
    const store = memoryStore();
    const s = newPlayerState();
    saveGame(store, s, t0);
    expect(loadGame(store, t0 + HOUR * 1000)).toEqual(advance(s, HOUR));
  });

  it("time away counts at most OFFLINE_CAP", () => {
    const store = memoryStore();
    const s = newPlayerState();
    saveGame(store, s, t0);
    expect(loadGame(store, t0 + 30 * HOUR * 1000)).toEqual(advance(s, OFFLINE_CAP));
    expect(catchUp(s, 30 * HOUR)).toEqual(advance(s, OFFLINE_CAP));
  });

  it("a save from the future counts no time", () => {
    const store = memoryStore();
    const s = newPlayerState();
    saveGame(store, s, t0);
    expect(loadGame(store, t0 - HOUR * 1000)).toEqual(s);
  });

  it("starts a new city when the save is missing, corrupt or from another version", () => {
    const store = memoryStore();
    expect(loadGame(store, t0)).toEqual(newPlayerState());
    store.data.set(SAVE_KEY, "{not json");
    expect(loadGame(store, t0)).toEqual(newPlayerState());
    store.data.set(SAVE_KEY, JSON.stringify({ v: 2, savedAt: t0, state: newPlayerState() }));
    expect(loadGame(store, t0)).toEqual(newPlayerState());
    store.data.set(SAVE_KEY, JSON.stringify({ v: 1, savedAt: t0, state: { ...newPlayerState(), stock: { oil: "lots" } } }));
    expect(loadGame(store, t0)).toEqual(newPlayerState());
  });

  it("works without any storage", () => {
    expect(() => saveGame(null, newPlayerState(), t0)).not.toThrow();
    expect(loadGame(null, t0)).toEqual(newPlayerState());
  });
});

describe("time between two frames", () => {
  const s = newPlayerState();
  const speed = 60;

  it("16 ms is live time, sped up", () => {
    expect(elapse(s, 0.016, speed)).toEqual(tick(s, 0.016, speed));
    expect(elapse(s, 0.016, speed)).toEqual(advance(s, 0.016 * speed));
  });

  it("exactly 1 s is still live time", () => {
    expect(elapse(s, 1, speed)).toEqual(advance(s, speed));
  });

  it("2 h with the tab hidden is time away: real time, not sped up", () => {
    expect(elapse(s, 2 * HOUR, speed)).toEqual(advance(s, 2 * HOUR));
  });

  it("3 days with the tab hidden counts at most OFFLINE_CAP", () => {
    expect(elapse(s, 3 * 24 * HOUR, speed)).toEqual(advance(s, OFFLINE_CAP));
  });
});

describe("buildings", () => {
  const t0 = Date.UTC(2026, 9, 15, 12);

  it("upgrading pays the shared cost and queues the shared duration", () => {
    const s = newPlayerState();
    const r = upgrade(s, "refinery");
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.stock.wood).toBe(s.stock.wood - (upgradeCost("refinery", 1).wood ?? 0));
    expect(r.state.queue).toEqual([{ id: "refinery", left: upgradeTime("refinery", 1), duration: upgradeTime("refinery", 1) }]);
  });

  it("a refusal keeps the reason from the shared rules", () => {
    const s = newPlayerState();
    expect(upgrade({ ...s, stock: { oil: 0, fish: 0, wood: 0, rope: 0 } }, "refinery")).toEqual({ ok: false, reason: "Not enough resources" });
    expect(upgrade({ ...s, buildings: { ...s.buildings, refinery: 2 } }, "refinery")).toEqual({ ok: false, reason: "Upgrade the Lighthouse first" });
    const one = upgrade(s, "refinery");
    if (!one.ok) throw new Error(one.reason);
    expect(upgrade(one.state, "refinery")).toEqual({ ok: false, reason: "This building is already being upgraded" });
  });

  it("the level rises when the upgrade ends", () => {
    const r = upgrade(newPlayerState(), "refinery");
    if (!r.ok) throw new Error(r.reason);
    const d = upgradeTime("refinery", 1);
    expect(advance(r.state, d - 1).buildings.refinery).toBe(1);
    const done = advance(r.state, d);
    expect(done.buildings.refinery).toBe(2);
    expect(done.queue).toEqual([]);
  });

  it("time away finishes upgrades and produces at the new rate after them", () => {
    const r = upgrade(newPlayerState(), "refinery");
    if (!r.ok) throw new Error(r.reason);
    const d = upgradeTime("refinery", 1);
    const before = { ...r.state, queue: [] }; // same city, level 1 all along
    const after = catchUp(r.state, OFFLINE_CAP);
    expect(after.buildings.refinery).toBe(2);
    // Up to the end of the job, level 1; then level 2 for the rest of the 8 h.
    const expected = advance({ ...advance(before, d), buildings: { ...before.buildings, refinery: 2 } }, OFFLINE_CAP - d);
    expect(after.stock.oil).toBeCloseTo(expected.stock.oil);
    expect(after.stock.oil).toBeGreaterThan(catchUp(before, OFFLINE_CAP).stock.oil);
  });

  it("the queue is saved and comes back on load", () => {
    const store = memoryStore();
    const r = upgrade(newPlayerState(), "refinery");
    if (!r.ok) throw new Error(r.reason);
    saveGame(store, r.state, t0);
    expect(loadGame(store, t0)).toEqual(r.state);
  });

  it("a bad job in the save is dropped, the rest of the city is kept", () => {
    const store = memoryStore();
    const s = advance(newPlayerState(), HOUR);
    const good = { id: "fishery", left: 100, duration: 3240 };
    const file = {
      v: 1,
      savedAt: t0,
      state: { ...s, queue: [good, { id: "castle", left: 10, duration: 10 }, { id: "refinery", left: "soon", duration: 10 }, null] },
    };
    store.data.set(SAVE_KEY, JSON.stringify(file));
    expect(loadGame(store, t0)).toEqual({ ...s, queue: [good] });
  });

  it("a save from before the queue loads with an empty queue", () => {
    const store = memoryStore();
    const { queue: _none, ...old } = newPlayerState();
    store.data.set(SAVE_KEY, JSON.stringify({ v: 1, savedAt: t0, state: old }));
    expect(loadGame(store, t0)).toEqual(newPlayerState());
  });
});
