import { describe, expect, it } from "vitest";
import {
  DAY,
  PROMOTE_BARRACKS,
  PROMOTE_COST,
  PROMOTE_COUNT,
  PROMOTE_TIME,
  TIME_SCALE,
  VETERAN_WEIGHT,
  advance,
  applyAction,
  emptyTroops,
  newPlayerState,
  parseAction,
  parseState,
  promote,
  sail,
  train,
  trainingName,
  type PlayerState,
} from "../src/index.js";

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const ID = "3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e4f";
const DOCTRINE = "You need the Veteran Doctrine research at the Observatory and Barracks at level 3.";

/** A city with the Veteran Doctrine, its Barracks at level 3, soldiers and enough fish and oil for a few promotions. */
const ready = (): PlayerState => {
  const s = newPlayerState();
  return {
    ...s,
    buildings: { ...s.buildings, barracks: PROMOTE_BARRACKS, infirmary: 1 },
    techs: { veterans: 1 },
    troops: { boarders: 30, harpooners: 25, crossbowmen: 25 },
    stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 },
  };
};
const promoted = (s: PlayerState, troop: "boarders" | "harpooners" | "crossbowmen" = "boarders"): PlayerState => {
  const r = promote(s, troop);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
/** A city with 10 veteran boarders, the promotion done. */
const withVeterans = (): PlayerState => advance(promoted(ready()), PROMOTE_TIME);

describe("the balance values, from the prototype", () => {
  it("10 soldiers, 60 fish and 40 oil, 6 prototype seconds; the Doctrine and the Barracks at level 3; a veteran is worth 1.8", () => {
    expect(PROMOTE_COUNT).toBe(10);
    expect(PROMOTE_COST).toEqual({ fish: 60, oil: 40 });
    expect(PROMOTE_TIME).toBe(6 * TIME_SCALE);
    expect(PROMOTE_TIME).toBe(36 * 60);
    expect(PROMOTE_BARRACKS).toBe(3);
    expect(VETERAN_WEIGHT).toBe(1.8);
  });
});

describe("promoting veterans at the Barracks", () => {
  it("10 soldiers leave the troops at once, paid at once, in the Barracks' one slot", () => {
    const s = ready();
    const r = promote(s, "harpooners");
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.training).toEqual({ kind: "promote", troop: "harpooners", count: 10, left: PROMOTE_TIME, duration: PROMOTE_TIME });
    expect(r.state.troops).toEqual({ ...s.troops, harpooners: 15 });
    expect(r.state.veterans).toEqual(s.veterans);
    expect(r.state.stock).toEqual({ ...s.stock, fish: s.stock.fish - 60, oil: s.stock.oil - 40 });
    expect(trainingName(r.state.training!)).toBe("10 veteran harpooners");
  });

  it("is refused in this order: the Doctrine and the Barracks, one work at a time, 10 soldiers, the resources", () => {
    const s = ready();
    // Every condition broken at once: the first reason wins, and so on.
    const all: PlayerState = { ...promoted(s), techs: {}, troops: emptyTroops(), stock: { oil: 0, fish: 0, wood: 0, rope: 0 } };
    expect(promote(all, "boarders")).toEqual({ ok: false, reason: DOCTRINE });
    const busy: PlayerState = { ...all, techs: { veterans: 1 } };
    expect(promote(busy, "boarders")).toEqual({ ok: false, reason: "Training is already underway" });
    const few: PlayerState = { ...busy, training: null };
    expect(promote(few, "boarders")).toEqual({ ok: false, reason: "You need 10 boarders to promote." });
    expect(promote(few, "crossbowmen")).toEqual({ ok: false, reason: "You need 10 crossbowmen to promote." });
    const poor: PlayerState = { ...few, troops: s.troops };
    expect(promote(poor, "boarders")).toEqual({ ok: false, reason: "Not enough resources" });
  });

  it("needs both the Doctrine and the Barracks at level 3", () => {
    const s = ready();
    expect(promote({ ...s, techs: {} }, "boarders")).toEqual({ ok: false, reason: DOCTRINE });
    expect(promote({ ...s, buildings: { ...s.buildings, barracks: 2 } }, "boarders")).toEqual({ ok: false, reason: DOCTRINE });
    expect(promote({ ...s, buildings: { ...s.buildings, barracks: 4 } }, "boarders").ok).toBe(true);
  });

  it("just enough: 10 soldiers, 60 fish and 40 oil", () => {
    const s: PlayerState = { ...ready(), troops: { ...ready().troops, boarders: 10 }, stock: { oil: 40, fish: 60, wood: 0, rope: 0 } };
    const r = promote(s, "boarders");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.troops.boarders).toBe(0);
    expect(promote({ ...s, troops: { ...s.troops, boarders: 9 } }, "boarders")).toEqual({ ok: false, reason: "You need 10 boarders to promote." });
    expect(promote({ ...s, stock: { ...s.stock, oil: 39 } }, "boarders")).toEqual({ ok: false, reason: "Not enough resources" });
  });

  it("shares the slot with training: one blocks the other", () => {
    const s = ready();
    expect(train(promoted(s), "boarders")).toEqual({ ok: false, reason: "Training is already underway" });
    const t = train(s, "boarders");
    if (!t.ok) throw new Error(t.reason);
    expect(promote(t.state, "boarders")).toEqual({ ok: false, reason: "Training is already underway" });
  });

  it("ends as an event of advance: 10 veterans join the city, the Barracks is free again", () => {
    const s = promoted(ready());
    expect(advance(s, PROMOTE_TIME - 1).veterans).toEqual(emptyTroops());
    expect(advance(s, PROMOTE_TIME - 1).training?.left).toBeCloseTo(1, 9);
    const done = advance(s, PROMOTE_TIME);
    expect(done.veterans).toEqual({ ...emptyTroops(), boarders: 10 });
    expect(done.troops).toEqual(s.troops);
    expect(done.training).toBeNull();
    expect(promote(done, "boarders").ok).toBe(true);
  });

  it("the veterans arrive at the exact moment, in one step or in a thousand", () => {
    const s = promoted(ready(), "crossbowmen");
    const once = advance(s, DAY);
    let many = s;
    for (let i = 0; i < 1000; i++) many = advance(many, DAY / 1000);
    expect(many.veterans).toEqual(once.veterans);
    expect(once.veterans.crossbowmen).toBe(10);
  });
});

describe("veterans at sea", () => {
  it("every veteran of the city goes with an attack fleet; none with a salvage fleet", () => {
    const s = withVeterans();
    const away = sail(s, "camp-1");
    if (!away.ok) throw new Error(away.reason);
    expect(away.state.veterans).toEqual(emptyTroops());
    expect(away.state.fleets[0]!.veterans).toEqual(s.veterans);
    const wreck = sail(s, "wreck-1");
    if (!wreck.ok) throw new Error(wreck.reason);
    expect(wreck.state.veterans).toEqual(s.veterans);
    expect(wreck.state.fleets[0]!.veterans).toEqual(emptyTroops());
  });

  it("veterans alone can make up a fleet", () => {
    const s: PlayerState = { ...withVeterans(), troops: emptyTroops() };
    expect(sail(s, "camp-1").ok).toBe(true);
  });

  it("fight harder than soldiers: 10 veterans beat a camp that 10 soldiers do not", () => {
    const base: PlayerState = { ...ready(), troops: emptyTroops() };
    const report = (s: PlayerState) => {
      const away = sail(s, "camp-1");
      if (!away.ok) throw new Error(away.reason);
      return advance(away.state, DAY).reports[0]!;
    };
    const soldiers = report({ ...base, troops: { boarders: 10, harpooners: 10, crossbowmen: 10 } });
    const veterans = report({ ...base, veterans: { boarders: 10, harpooners: 10, crossbowmen: 10 } });
    expect(veterans.attack).toBeCloseTo(soldiers.attack * VETERAN_WEIGHT, 9);
  });

  it("the survivors come back to the city; the lost ones never become wounded", () => {
    const s = withVeterans();
    const away = sail(s, "camp-1");
    if (!away.ok) throw new Error(away.reason);
    const back = advance(away.state, DAY);
    const r = back.reports[0]!;
    expect(r.veteranSent).toEqual(s.veterans);
    expect(r.veteranLosses!.boarders).toBeGreaterThan(0);
    expect(back.veterans).toEqual({ ...emptyTroops(), boarders: 10 - r.veteranLosses!.boarders });
    // The wounded are soldiers only: as many as the report says, none from the veterans.
    expect(back.wounded).toEqual(r.wounded);
    expect(r.wounded.boarders).toBeLessThanOrEqual(r.losses.boarders);
  });

  it("the report keeps whether the city had an Infirmary at the time of the battle", () => {
    const s = withVeterans();
    for (const infirmary of [0, 1]) {
      const away = sail({ ...s, buildings: { ...s.buildings, infirmary } }, "camp-1");
      if (!away.ok) throw new Error(away.reason);
      const back = advance(away.state, DAY);
      expect(back.reports[0]!.infirmary).toBe(infirmary > 0);
    }
  });
});

describe("the promote action", () => {
  it("applyAction gives the same city as the rule; parseAction reads the troop type only", () => {
    const s = ready();
    expect(applyAction(s, { id: ID, type: "promote", troop: "boarders" })).toEqual(promote(s, "boarders"));
    expect(parseAction({ id: ID, type: "promote", troop: "harpooners" })).toEqual({ id: ID, type: "promote", troop: "harpooners" });
    for (const troop of ["archers", "toString", "__proto__", "", 3, null]) expect(parseAction({ id: ID, type: "promote", troop }), String(troop)).toBeNull();
    expect(parseAction({ id: ID, type: "promote" })).toBeNull();
    // The number of soldiers is the rule's: a client never sends it.
    expect(parseAction({ id: ID, type: "promote", troop: "boarders", count: 10 })).toBeNull();
  });
});

describe("parseState: veterans and the promotion in progress", () => {
  const city = promoted(withVeterans(), "harpooners");
  const job = city.training!;

  it("reads the veterans, the promotion and a fleet's veterans", () => {
    expect(parseState(json(city))).toEqual(city);
    const away = sail(withVeterans(), "camp-1");
    if (!away.ok) throw new Error(away.reason);
    expect(parseState(json(away.state))).toEqual(away.state);
    const back = advance(away.state, DAY);
    expect(parseState(json(back))).toEqual(back);
  });

  it("reads a report from before the veterans, without their three fields", () => {
    const away = sail(withVeterans(), "camp-1");
    if (!away.ok) throw new Error(away.reason);
    const back = advance(away.state, DAY);
    const { veteranSent: _s, veteranLosses: _l, infirmary: _i, ...old } = back.reports[0]!;
    expect(parseState(json({ ...back, reports: [old] }))?.reports).toEqual([old]);
  });

  const away = (() => {
    const r = sail(withVeterans(), "camp-1");
    if (!r.ok) throw new Error(r.reason);
    return r.state;
  })();
  const back = advance(away, DAY);
  const report = back.reports[0]!;
  it("drops a fleet without veterans, as any bad fleet: its troops are lost", () => {
    const read = parseState(json({ ...away, fleets: away.fleets.map(({ veterans: _v, ...f }) => f) }));
    expect(read?.fleets).toEqual([]);
  });

  const bad: [string, unknown][] = [
    ["a city without veterans", (({ veterans: _v, ...rest }) => rest)(city)],
    ["veterans in decimals", { ...city, veterans: { ...city.veterans, boarders: 2.5 } }],
    ["veterans below 0", { ...city, veterans: { ...city.veterans, boarders: -1 } }],
    ["a promotion of more than 10", { ...city, training: { ...job, count: 11 } }],
    ["a promotion of fewer than 10", { ...city, training: { ...job, count: 9 } }],
    ["a promotion without the Doctrine", { ...city, techs: {} }],
    ["a promotion with the Barracks below level 3", { ...city, buildings: { ...city.buildings, barracks: 2 } }],
    ["a report with veterans in decimals", { ...back, reports: [{ ...report, veteranLosses: { ...report.veteranLosses!, boarders: 0.5 } }] }],
    ["a report whose Infirmary is not true or false", { ...back, reports: [{ ...report, infirmary: 1 }] }],
  ];
  for (const [name, c] of bad) {
    it(`refuses ${name}`, () => {
      expect(parseState(json(c))).toBeNull();
    });
  }
});
