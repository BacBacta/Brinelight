import { describe, expect, it } from "vitest";
import {
  ATTACK_STAY,
  HOUR,
  OFFLINE_CAP,
  STARTING_BUILDINGS,
  STARTING_STOCK,
  advance,
  catchUp,
  cleanQueue,
  leadOf,
  netRates,
  newPlayerState,
  parseState,
  readReport,
  sail,
  seaSite,
  storeCap,
  travelTime,
  upgrade,
  upgradeCost,
  upgradeTime,
} from "../src/index.js";

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
});

describe("buildings", () => {
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
});

describe("queue read from a save", () => {
  it("keeps one job per building and at most BUILDERS jobs, the first ones", () => {
    const raw = [
      { id: "refinery", left: 100, duration: 3240 },
      { id: "refinery", left: 50, duration: 3240 },
      { id: "fishery", left: 200, duration: 3240 },
      { id: "lumberyard", left: 300, duration: 3240 },
    ];
    expect(cleanQueue(raw)).toEqual([
      { id: "refinery", left: 100, duration: 3240 },
      { id: "fishery", left: 200, duration: 3240 },
    ]);
  });

  it("brings left back between 0 and duration", () => {
    const raw = [
      { id: "refinery", left: 99_999, duration: 3240 },
      { id: "fishery", left: -5, duration: 3240 },
    ];
    expect(cleanQueue(raw)).toEqual([
      { id: "refinery", left: 3240, duration: 3240 },
      { id: "fishery", left: 0, duration: 3240 },
    ]);
  });

  it("a bad job does not take a builder's place", () => {
    const raw = [{ id: "castle", left: 1, duration: 1 }, null, { id: "refinery", left: 1, duration: 10 }, { id: "fishery", left: 2, duration: 10 }];
    expect(cleanQueue(raw).map((j) => j.id)).toEqual(["refinery", "fishery"]);
  });
});

describe("Pearls", () => {
  it("a new city starts with the shared starting Pearls, apart from the stock", () => {
    const s = newPlayerState();
    expect(s.pearls).toBe(200);
    expect(s.stock).not.toHaveProperty("pearls");
  });

  it("are not capped by storage and do not change with production", () => {
    const s = { ...newPlayerState(), pearls: 1_000_000 };
    expect(advance(s, 1000 * HOUR).pearls).toBe(1_000_000);
  });
});

describe("fleets", () => {
  const trip = travelTime(seaSite("camp-1")!, {}, leadOf("tom", { tom: { level: 1 } }));
  const sent = () => {
    const r = sail(newPlayerState(), "camp-1");
    if (!r.ok) throw new Error(r.reason);
    return r.state;
  };

  it("a new city has no fleet, the starting sea and Old Tom in the lead", () => {
    const s = newPlayerState();
    expect(s.fleets).toEqual([]);
    expect(s.lead).toBe("tom");
    expect(s.world.camps["camp-1"]).toBe(1);
  });

  it("time away: the fleet sails, fights and comes back during 8 h of catch-up", () => {
    const s0 = sent();
    expect(s0.troops).toEqual({ boarders: 0, harpooners: 0, crossbowmen: 0 });
    const after = catchUp(s0, OFFLINE_CAP);
    expect(after.fleets).toEqual([]);
    expect(after.troops).toEqual({ boarders: 13, harpooners: 13, crossbowmen: 13 });
    expect(after.pearls).toBe(216);
    expect(after.world.camps["camp-1"]).toBe(2);
    expect(after.reports).toHaveLength(1);
    expect(after.reports[0]).toMatchObject({ site: "camp-1", level: 1, win: true, read: false, losses: { boarders: 12, harpooners: 12, crossbowmen: 12 } });
    // The loot comes back on top of 8 h of production.
    expect(after.stock.rope).toBe(s0.stock.rope + 1);
    expect(after.stock.wood).toBeCloseTo(advance({ ...s0, fleets: [] }, OFFLINE_CAP).stock.wood + 110);
  });

  it("live time in small frames gives the same result", () => {
    let s = sent();
    for (let i = 0; i < 2000; i++) s = advance(s, (2 * trip + ATTACK_STAY + 10) / 2000);
    const once = advance(sent(), 2 * trip + ATTACK_STAY + 10);
    expect(s.troops).toEqual(once.troops);
    expect(s.pearls).toBe(once.pearls);
    expect(s.reports).toEqual(once.reports);
  });

  it("research finished during the trip does not change the result", () => {
    const s0 = sent();
    const plain = advance(s0, 2 * trip + ATTACK_STAY);
    const researched = advance({ ...s0, techs: { blades: 3, hulls: 3, sails: 3 } }, 2 * trip + ATTACK_STAY);
    expect(researched.reports.map(({ read: _r, ...r }) => r)).toEqual(plain.reports.map(({ read: _r, ...r }) => r));
    expect(researched.troops).toEqual(plain.troops);
  });

  it("reports are read one after another", () => {
    let s = catchUp(sent(), OFFLINE_CAP);
    s = readReport(s);
    expect(s.reports.every((r) => r.read)).toBe(true);
  });

  it("a refusal keeps the reason from the shared rules", () => {
    expect(sail(sent(), "wreck-1")).toEqual({ ok: false, reason: "Build the Harbor to send more fleets" });
  });
});

/** A city as it travels as JSON (to the server, or into a save). */
const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

describe("parseState: strict reading of a city", () => {
  const playing = () => {
    const r = sail(newPlayerState(), "camp-1");
    if (!r.ok) throw new Error(r.reason);
    const u = upgrade(advance(r.state, 600), "fishery");
    if (!u.ok) throw new Error(u.reason);
    return u.state;
  };

  it("reads back a city that went through JSON, unchanged", () => {
    expect(parseState(json(newPlayerState()))).toEqual(newPlayerState());
    const s = catchUp(playing(), 3 * HOUR);
    expect(parseState(json(s))).toEqual(s);
  });

  it("refuses a city without Pearls instead of giving back 200", () => {
    const { pearls: _p, ...noPearls } = newPlayerState();
    expect(parseState(json(noPearls))).toBeNull();
    expect(parseState(json({ ...newPlayerState(), pearls: -1 }))).toBeNull();
  });

  it("refuses a city without its sea instead of giving back full wrecks", () => {
    const s = newPlayerState();
    for (const key of ["world", "fleets", "wounded", "reports", "lead", "queue"] as const) {
      const { [key]: _gone, ...rest } = s;
      expect(parseState(json(rest)), key).toBeNull();
    }
  });

  it("refuses a sea with a missing or invalid camp or wreck", () => {
    const s = newPlayerState();
    const { "camp-1": _c, ...camps } = s.world.camps;
    expect(parseState(json({ ...s, world: { ...s.world, camps } }))).toBeNull();
    expect(parseState(json({ ...s, world: { ...s.world, camps: { ...s.world.camps, "camp-1": 0 } } }))).toBeNull();
    // More oil in a wreck than it ever holds.
    expect(parseState(json({ ...s, world: { ...s.world, wrecks: { ...s.world.wrecks, "wreck-1": 99_999 } } }))).toBeNull();
  });

  it("refuses a bad report, or more reports than are kept", () => {
    const s = catchUp(playing(), OFFLINE_CAP);
    expect(parseState(json({ ...s, reports: [{ ...s.reports[0], win: "yes" }] }))).toBeNull();
    expect(parseState(json({ ...s, reports: Array.from({ length: 21 }, () => s.reports[0]) }))).toBeNull();
  });

  it("refuses a city with a missing building, a wrong lead or a bad stock", () => {
    const s = newPlayerState();
    const { harbor: _h, ...buildings } = s.buildings;
    expect(parseState(json({ ...s, buildings }))).toBeNull();
    expect(parseState(json({ ...s, lead: "blackbeard" }))).toBeNull();
    expect(parseState(json({ ...s, stock: { ...s.stock, oil: "lots" } }))).toBeNull();
  });

  it("still accepts no lead captain", () => {
    expect(parseState(json({ ...newPlayerState(), lead: null }))?.lead).toBeNull();
  });

  it("drops a bad job or a bad fleet: the player can only lose, never gain", () => {
    const s = playing();
    const raw = json({
      ...s,
      queue: [{ id: "castle", left: 1, duration: 1 }, ...s.queue],
      fleets: [{ ...s.fleets[0], site: "fish-1" }, ...s.fleets],
    });
    expect(parseState(raw)).toEqual(s);
  });

  it("brings time left back within bounds", () => {
    const s = playing();
    const raw = json({ ...s, queue: [{ ...s.queue[0], left: 1e9 }], fleets: [{ ...s.fleets[0], left: -50 }] });
    const p = parseState(raw)!;
    expect(p.queue[0]!.left).toBe(p.queue[0]!.duration);
    expect(p.fleets[0]!.left).toBe(0);
  });

  it("keeps only the fields of a city", () => {
    expect(parseState(json({ ...newPlayerState(), admin: true }))).not.toHaveProperty("admin");
  });

  it("never throws, whatever it is given", () => {
    for (const raw of [null, undefined, 0, "city", [], {}, { buildings: null }, json({ ...newPlayerState(), fleets: [null, 1, "x"] })]) {
      expect(() => parseState(raw)).not.toThrow();
    }
    expect(parseState({})).toBeNull();
  });
});
