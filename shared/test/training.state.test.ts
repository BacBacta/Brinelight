import { describe, expect, it } from "vitest";
import {
  DAY,
  MIN_ATTACK_TROOPS,
  TIME_SCALE,
  TRAIN_COST,
  TRAIN_PER_LEVEL,
  advance,
  applyAction,
  emptyTroops,
  newPlayerState,
  parseAction,
  parseState,
  sail,
  totalTroops,
  train,
  trainBatch,
  trainCost,
  trainTime,
  type PlayerState,
} from "../src/index.js";

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const ID = "3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e4f";

/** A city with its Barracks built, and enough fish and wood for a few batches. */
const withBarracks = (level = 1): PlayerState => {
  const s = newPlayerState();
  return { ...s, buildings: { ...s.buildings, barracks: level }, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 } };
};
const started = (s: PlayerState, troop: "boarders" | "harpooners" | "crossbowmen" = "boarders"): PlayerState => {
  const r = train(s, troop);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};

describe("the balance values, from the prototype", () => {
  it("a batch of Barracks level × 20 soldiers, 3 fish and 2 wood each, in (n × 0.25 + 3) prototype seconds", () => {
    expect(TRAIN_PER_LEVEL).toBe(20);
    expect(TRAIN_COST).toEqual({ fish: 3, wood: 2 });
    expect([1, 5, 10].map(trainBatch)).toEqual([20, 100, 200]);
    expect(trainCost(20)).toEqual({ fish: 60, wood: 40 });
    expect(trainTime(20)).toBe(8 * TIME_SCALE);
    expect([20, 100, 200].map(trainTime)).toEqual([2880, 10080, 19080]);
  });
});

describe("training at the Barracks", () => {
  it("starts a batch set by the Barracks' level, paid at once", () => {
    const s = withBarracks(3);
    const r = train(s, "harpooners");
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.training).toEqual({ kind: "train", troop: "harpooners", count: 60, left: trainTime(60), duration: trainTime(60) });
    expect(r.state.stock.fish).toBe(s.stock.fish - 180);
    expect(r.state.stock.wood).toBe(s.stock.wood - 120);
    expect(r.state.stock.oil).toBe(s.stock.oil);
    expect(r.state.troops).toEqual(s.troops);
  });

  it("is refused with the prototype's words: no Barracks, one training at a time, the resources", () => {
    expect(train(newPlayerState(), "boarders")).toEqual({ ok: false, reason: "Build the Barracks first" });
    expect(train(started(withBarracks()), "crossbowmen")).toEqual({ ok: false, reason: "Training is already underway" });
    // Just enough for one soldier less than the batch.
    const short = { ...withBarracks(), stock: { oil: 0, fish: 3 * 19, wood: 2 * 20, rope: 0 } };
    expect(train(short, "boarders")).toEqual({ ok: false, reason: "Not enough resources" });
    expect(train({ ...short, stock: { ...short.stock, fish: 60 } }, "boarders").ok).toBe(true);
  });

  it("ends as an event of advance: the soldiers join the troops in the city, and the Barracks is free again", () => {
    const s = started(withBarracks(2));
    const d = trainTime(40);
    expect(advance(s, d - 1).training?.left).toBeCloseTo(1, 9);
    expect(advance(s, d - 1).troops).toEqual(s.troops);
    const done = advance(s, d);
    expect(done.troops).toEqual({ ...s.troops, boarders: s.troops.boarders + 40 });
    expect(done.training).toBeNull();
    expect(train(done, "harpooners").ok).toBe(true);
  });

  it("the batch stays the one started, even if the Barracks goes up a level meanwhile", () => {
    const s = started(withBarracks(1));
    const done = advance({ ...s, buildings: { ...s.buildings, barracks: 4 } }, trainTime(20));
    expect(done.troops.boarders).toBe(s.troops.boarders + 20);
  });

  it("the soldiers arrive at the exact moment, in one step or in a thousand, during a long time away", () => {
    const s = started(withBarracks(5), "crossbowmen");
    const away = 2 * DAY;
    const once = advance(s, away);
    let many = s;
    for (let i = 0; i < 1000; i++) many = advance(many, away / 1000);
    expect(many.troops).toEqual(once.troops);
    expect(many.stock.fish).toBeCloseTo(once.stock.fish, 6);
    expect(once.troops.crossbowmen).toBe(s.troops.crossbowmen + 100);
  });

  it("a fleet at sea never gets the new soldiers: they wait in the city", () => {
    const s = withBarracks();
    const away = sail(s, "camp-1");
    if (!away.ok) throw new Error(away.reason);
    const t = started(away.state);
    // The same time at sea without the training: the fleets are the same, the city has 20 boarders more.
    const without = advance({ ...t, training: null }, trainTime(20));
    const done = advance(t, trainTime(20));
    expect(done.fleets).toEqual(without.fleets);
    expect(done.troops).toEqual({ ...without.troops, boarders: without.troops.boarders + 20 });
    expect(started(away.state).troops).toEqual(emptyTroops());
  });

  it("done when: a player who lost all their troops at sea trains new ones, and can attack again", () => {
    const away = sail(withBarracks(), "camp-1");
    if (!away.ok) throw new Error(away.reason);
    // The whole army is at sea, and lost there: no soldier left in the city.
    const lost: PlayerState = { ...away.state, fleets: [] };
    expect(totalTroops(lost.troops)).toBe(0);
    expect(sail(lost, "camp-1")).toEqual({ ok: false, reason: "You do not have enough troops" });
    const back = advance(started(lost), trainTime(20));
    expect(totalTroops(back.troops)).toBeGreaterThanOrEqual(MIN_ATTACK_TROOPS);
    expect(sail(back, "camp-1").ok).toBe(true);
  });

  it("an action: applyAction gives the same city as the rule; parseAction reads the troop type only", () => {
    const s = withBarracks();
    expect(applyAction(s, { id: ID, type: "train", troop: "boarders" })).toEqual(train(s, "boarders"));
    expect(parseAction({ id: ID, type: "train", troop: "crossbowmen" })).toEqual({ id: ID, type: "train", troop: "crossbowmen" });
    for (const troop of ["archers", "toString", "constructor", "__proto__", "", 3, null]) expect(parseAction({ id: ID, type: "train", troop }), String(troop)).toBeNull();
    expect(parseAction({ id: ID, type: "train" })).toBeNull();
    // The number of soldiers is the rule's: a client never sends it.
    expect(parseAction({ id: ID, type: "train", troop: "boarders", count: 500 })).toBeNull();
  });
});

describe("parseState: the training in progress", () => {
  const city = started(withBarracks(2));
  const job = city.training!;

  it("reads none, or a training in progress", () => {
    expect(parseState(json(newPlayerState()))?.training).toBeNull();
    expect(parseState(json(city))).toEqual(city);
  });

  it("brings the time left back within its duration, as for the build queue", () => {
    expect(parseState(json({ ...city, training: { ...job, left: job.duration * 3 } }))?.training?.left).toBe(job.duration);
    expect(parseState(json({ ...city, training: { ...job, left: -5 } }))?.training?.left).toBe(0);
  });

  const bad: [string, unknown][] = [
    ["a city without the field", (({ training: _t, ...rest }) => rest)(city)],
    ["an unknown troop type", { ...city, training: { ...job, troop: "archers" } }],
    ["a troop type inherited from Object", { ...city, training: { ...job, troop: "toString" } }],
    ["an unknown kind", { ...city, training: { ...job, kind: "promote" } }],
    ["no soldier", { ...city, training: { ...job, count: 0 } }],
    ["part of a soldier", { ...city, training: { ...job, count: 12.5 } }],
    ["a batch larger than the Barracks trains", { ...city, training: { ...job, count: 41 } }],
    ["a training without a Barracks", { ...city, buildings: { ...city.buildings, barracks: 0 } }],
    ["a duration of 0", { ...city, training: { ...job, duration: 0 } }],
    ["an extra field", { ...city, training: { ...job, veteran: true } }],
    ["a list", { ...city, training: [job] }],
  ];
  for (const [name, c] of bad) {
    it(`refuses ${name}`, () => {
      expect(parseState(json(c))).toBeNull();
    });
  }
});
