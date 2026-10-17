import { HOUR, STARTING_PEARLS, advance, catchUp, leadOf, newPlayerState, sail, seaSite, startingSeaWorld, travelTime, upgrade } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { REJECTED_KEY, SAVE_KEY, loadGame, migrateSave, openSave, saveGame, type KeyValueStore } from "../src/state/save.js";
import { elapse, tick } from "../src/state/time.js";

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe("production", () => {
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

  it("30 h away count in full", () => {
    const store = memoryStore();
    const s = newPlayerState();
    saveGame(store, s, t0);
    expect(loadGame(store, t0 + 30 * HOUR * 1000)).toEqual(advance(s, 30 * HOUR));
    expect(catchUp(s, 30 * HOUR)).toEqual(advance(s, 30 * HOUR));
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

  it("3 days with the tab hidden count in full, never sped up", () => {
    expect(elapse(s, 3 * 24 * HOUR, speed)).toEqual(advance(s, 3 * 24 * HOUR));
  });
});

describe("buildings", () => {
  const t0 = Date.UTC(2026, 9, 15, 12);

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

describe("queue read from a save", () => {
  it("the cleaned queue is what loadGame gives back", () => {
    const store = memoryStore();
    const s = newPlayerState();
    const raw = [
      { id: "refinery", left: 99_999, duration: 3240 },
      { id: "refinery", left: 10, duration: 3240 },
      { id: "fishery", left: 200, duration: 3240 },
      { id: "lumberyard", left: 300, duration: 3240 },
    ];
    const t0 = Date.UTC(2026, 9, 15, 12);
    store.data.set(SAVE_KEY, JSON.stringify({ v: 1, savedAt: t0, state: { ...s, queue: raw } }));
    expect(loadGame(store, t0).queue).toEqual([
      { id: "refinery", left: 3240, duration: 3240 },
      { id: "fishery", left: 200, duration: 3240 },
    ]);
  });
});

describe("Pearls", () => {
  const t0 = Date.UTC(2026, 9, 15, 12);

  it("are saved and come back on load", () => {
    const store = memoryStore();
    const s = { ...newPlayerState(), pearls: 345 };
    saveGame(store, s, t0);
    expect(loadGame(store, t0).pearls).toBe(345);
  });

  it("a save from before the Pearls loads with 200", () => {
    const store = memoryStore();
    const { pearls: _none, ...old } = newPlayerState();
    store.data.set(SAVE_KEY, JSON.stringify({ v: 1, savedAt: t0, state: { ...old, stock: { ...old.stock, wood: 700 } } }));
    const loaded = loadGame(store, t0);
    expect(loaded.pearls).toBe(200);
    expect(loaded.stock.wood).toBe(700);
  });
});

describe("fleets", () => {
  const t0 = Date.UTC(2026, 9, 15, 12);
  const trip = travelTime(seaSite("camp-1")!, {}, leadOf("tom", { tom: { level: 1 } }));
  const sent = () => {
    const r = sail(newPlayerState(), "camp-1");
    if (!r.ok) throw new Error(r.reason);
    return r.state;
  };

  it("a fleet at sea survives a save", () => {
    const store = memoryStore();
    const s = advance(sent(), 600);
    saveGame(store, s, t0);
    expect(loadGame(store, t0)).toEqual(s);
  });

  it("a bad fleet in the save is dropped, the rest of the city is kept", () => {
    const store = memoryStore();
    const s = advance(sent(), 600);
    const bad = { ...s.fleets[0], site: "fish-1" };
    store.data.set(SAVE_KEY, JSON.stringify({ v: 1, savedAt: t0, state: { ...s, fleets: [bad, s.fleets[0]] } }));
    expect(loadGame(store, t0)).toEqual(s);
  });

  it("a save from before the sea loads with the starting sea", () => {
    const store = memoryStore();
    const { fleets: _f, world: _w, wounded: _wd, reports: _r, lead: _l, ...old } = newPlayerState();
    store.data.set(SAVE_KEY, JSON.stringify({ v: 1, savedAt: t0, state: old }));
    expect(loadGame(store, t0)).toEqual(newPlayerState());
  });
});

describe("migrateSave: old local saves", () => {
  it("fills in what older saves did not have: Pearls, build queue, sea", () => {
    const { pearls: _p, queue: _q, fleets: _f, world: _w, wounded: _wd, reports: _r, lead: _l, ...week2task2 } = newPlayerState();
    expect(migrateSave(JSON.parse(JSON.stringify(week2task2)))).toEqual(newPlayerState());
  });

  it("uses the shared starting values", () => {
    const { pearls: _p, world: _w, ...old } = newPlayerState();
    const s = migrateSave(old)!;
    expect(s.pearls).toBe(STARTING_PEARLS);
    expect(s.world).toEqual(startingSeaWorld());
  });

  it("numbers the reports of a save from before report ids: r1, r2… in their order", () => {
    let city = newPlayerState();
    for (let i = 0; i < 3; i++) {
      const r = sail({ ...city, troops: { boarders: 25, harpooners: 25, crossbowmen: 25 } }, "camp-1");
      if (!r.ok) throw new Error(r.reason);
      city = advance(r.state, 8 * HOUR);
    }
    const { reportSeq: _seq, ...rest } = JSON.parse(JSON.stringify(city));
    const old = { ...rest, reports: rest.reports.map(({ id: _id, ...r }: { id: string }) => r) };
    const s = migrateSave(old)!;
    expect(s.reports.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
    expect(s.reportSeq).toBe(3);
    expect(s).toEqual(city);
  });

  it("keeps a save that already has report ids as it is", () => {
    const r = sail(newPlayerState(), "camp-1");
    if (!r.ok) throw new Error(r.reason);
    const city = advance(r.state, 8 * HOUR);
    expect(migrateSave(JSON.parse(JSON.stringify(city)))).toEqual(city);
  });

  it("gives a save from before the veterans none, in the city and in each fleet at sea", () => {
    const r = sail(newPlayerState(), "camp-1");
    if (!r.ok) throw new Error(r.reason);
    const city = advance(r.state, 600);
    const { veterans: _v, ...rest } = JSON.parse(JSON.stringify(city));
    const old = { ...rest, fleets: rest.fleets.map(({ veterans: _fv, ...f }: { veterans: unknown }) => f) };
    expect(migrateSave(old)).toEqual(city);
  });

  it("does not repair a field that exists but is invalid: parseState refuses it", () => {
    expect(migrateSave({ ...newPlayerState(), pearls: "lots" })).toBeNull();
    expect(migrateSave({ ...newPlayerState(), world: { camps: {}, wrecks: {} } })).toBeNull();
  });

  it("an invalid field in a save starts a new city", () => {
    const store = memoryStore();
    const t0 = Date.UTC(2026, 9, 15, 12);
    const s = { ...advance(newPlayerState(), HOUR), pearls: -5 };
    store.data.set(SAVE_KEY, JSON.stringify({ v: 1, savedAt: t0, state: s }));
    expect(loadGame(store, t0)).toEqual(newPlayerState());
  });
});

describe("a save that cannot be read", () => {
  const t0 = Date.UTC(2026, 9, 15, 12);

  it("is kept as it is under the rejected key, and a new city starts", () => {
    const store = memoryStore();
    const broken = JSON.stringify({ v: 1, savedAt: t0, state: { ...newPlayerState(), pearls: "lots" } });
    store.data.set(SAVE_KEY, broken);
    const r = openSave(store, t0);
    expect(r.rejected).toBe(true);
    expect(r.state).toEqual(newPlayerState());
    expect(store.data.get(REJECTED_KEY)).toBe(broken);
  });

  it("covers broken JSON and saves from another version too", () => {
    for (const raw of ["{not json", JSON.stringify({ v: 2, savedAt: t0, state: newPlayerState() })]) {
      const store = memoryStore();
      store.data.set(SAVE_KEY, raw);
      expect(openSave(store, t0).rejected).toBe(true);
      expect(store.data.get(REJECTED_KEY)).toBe(raw);
    }
  });

  it("never overwrites a copy that is already there", () => {
    const store = memoryStore();
    store.data.set(REJECTED_KEY, "the first one");
    store.data.set(SAVE_KEY, "{not json");
    openSave(store, t0);
    expect(store.data.get(REJECTED_KEY)).toBe("the first one");
  });

  it("no save, or a good save, is not a rejection", () => {
    const store = memoryStore();
    expect(openSave(store, t0).rejected).toBe(false);
    saveGame(store, newPlayerState(), t0);
    expect(openSave(store, t0).rejected).toBe(false);
    expect(store.data.has(REJECTED_KEY)).toBe(false);
  });

  it("works without any storage", () => {
    expect(openSave(null, t0)).toEqual({ state: newPlayerState(), rejected: false });
  });
});
