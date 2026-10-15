import { HOUR, OFFLINE_CAP, STARTING_BUILDINGS, STARTING_STOCK, netRates, storeCap } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { SAVE_KEY, loadGame, saveGame, type KeyValueStore } from "../src/state/save.js";
import { advance, catchUp, newPlayerState, tick } from "../src/state/state.js";

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
