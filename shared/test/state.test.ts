import { describe, expect, it } from "vitest";
import {
  ATTACK_STAY,
  HOUR,
  MIST_DURATION,
  MIST_HELD_PEARLS,
  MAX_REPORTS,
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
  type PlayerState,
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
    expect(STARTING_STOCK.oil).toBe(1400);
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
    const away = 8 * HOUR;
    const after = catchUp(r.state, away);
    expect(after.buildings.refinery).toBe(2);
    // Up to the end of the job, level 1; then level 2 for the rest of the 8 h.
    const expected = advance({ ...advance(before, d), buildings: { ...before.buildings, refinery: 2 } }, away - d);
    expect(after.stock.oil).toBeCloseTo(expected.stock.oil);
    expect(after.stock.oil).toBeGreaterThan(catchUp(before, away).stock.oil);
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

describe("long time away", () => {
  const DAYS_3 = 3 * 24 * HOUR;

  it("a 34 h upgrade started before 3 days away is finished", () => {
    // The Lighthouse 20 to 21 takes 34 h 10.
    const cap = storeCap(20);
    const city = { ...newPlayerState(), buildings: { ...STARTING_BUILDINGS, lighthouse: 20 }, stock: { oil: cap, fish: cap, wood: cap, rope: 50 } };
    expect(upgradeTime("lighthouse", 20)).toBeGreaterThan(34 * HOUR);
    const r = upgrade(city, "lighthouse");
    if (!r.ok) throw new Error(r.reason);
    const after = catchUp(r.state, DAYS_3);
    expect(after.buildings.lighthouse).toBe(21);
    expect(after.queue).toEqual([]);
  });

  it("a fleet sent before 3 days away is back with its loot", () => {
    const r = sail(newPlayerState(), "camp-1");
    if (!r.ok) throw new Error(r.reason);
    const after = catchUp(r.state, DAYS_3);
    expect(after.fleets).toEqual([]);
    expect(after.troops).toEqual({ boarders: 13, harpooners: 13, crossbowmen: 13 });
    // The camp's 16 Pearls, and 30 for each of the 9 Mists the Lighthouse held in 3 days.
    expect(after.mist.held).toBe(9);
    expect(after.pearls).toBe(216 + 9 * MIST_HELD_PEARLS);
    expect(after.stock.rope).toBe(r.state.stock.rope + 1);
    expect(after.reports).toHaveLength(1);
    expect(after.reports[0]).toMatchObject({ site: "camp-1", win: true, read: false });
  });

  it("3 days away produce in full, and a long absence stops production at storage", () => {
    const s = newPlayerState();
    const cap = storeCap(s.buildings.lighthouse, s.techs);
    const rates = netRates(s);
    // 9 Mists in 3 days, all held: production stays full, and the stoked Lighthouse burns more oil while they last.
    const mist = netRates(s, { mist: true, stoked: true });
    const inMist = 9 * MIST_DURATION;
    const after = catchUp(s, DAYS_3);
    expect(after.mist).toMatchObject({ held: 9, missed: 0 });
    for (const k of ["oil", "fish", "wood"] as const) {
      expect(after.stock[k], k).toBeCloseTo(Math.min(cap, Math.max(0, s.stock[k] + (rates[k] * (DAYS_3 - inMist) + mist[k] * inMist) / 3600)));
    }
    // 60 days fill the storage; longer still changes nothing.
    const full = catchUp(s, 60 * 24 * HOUR);
    for (const k of ["oil", "fish", "wood"] as const) if (rates[k] > 0) expect(full.stock[k], k).toBe(cap);
    expect(catchUp(s, 120 * 24 * HOUR).stock).toEqual(full.stock);
  });

  it("a resource that falls stops at 0 instead of going below", () => {
    const hungry = { ...newPlayerState(), survivors: 200 };
    expect(netRates(hungry).fish).toBeLessThan(0);
    expect(catchUp(hungry, DAYS_3).stock.fish).toBe(0);
  });

  it("a negative time away changes nothing", () => {
    const s = newPlayerState();
    expect(catchUp(s, -5 * HOUR)).toEqual(s);
  });
});

describe("Pearls", () => {
  it("a new city starts with the shared starting Pearls, apart from the stock", () => {
    const s = newPlayerState();
    expect(s.pearls).toBe(200);
    expect(s.stock).not.toHaveProperty("pearls");
  });

  it("are not capped by storage and do not change with production", () => {
    // The order to stoke off: no Mist held, no Pearls from the Mist.
    const s = { ...newPlayerState(), pearls: 1_000_000, mist: { ...newPlayerState().mist, stoke: false } };
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
    const after = catchUp(s0, 8 * HOUR);
    expect(after.fleets).toEqual([]);
    expect(after.troops).toEqual({ boarders: 13, harpooners: 13, crossbowmen: 13 });
    // The camp's 16 Pearls, and the Mist of 04:00 held.
    expect(after.mist.held).toBe(1);
    expect(after.pearls).toBe(216 + MIST_HELD_PEARLS);
    expect(after.world.camps["camp-1"]).toBe(2);
    expect(after.reports).toHaveLength(1);
    expect(after.reports[0]).toMatchObject({ site: "camp-1", level: 1, win: true, read: false, losses: { boarders: 12, harpooners: 12, crossbowmen: 12 } });
    // The loot comes back on top of 8 h of production.
    expect(after.stock.rope).toBe(s0.stock.rope + 1);
    expect(after.stock.wood).toBeCloseTo(advance({ ...s0, fleets: [] }, 8 * HOUR).stock.wood + 110);
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

  it("reading a report marks that one only; a report gone or already read changes nothing", () => {
    const s = catchUp(sent(), 8 * HOUR);
    const read = readReport(s, "r1");
    expect(read.reports.every((r) => r.read)).toBe(true);
    expect(readReport(read, "r1")).toBe(read);
    expect(readReport(s, "r99")).toBe(s);
  });

  it("a refusal keeps the reason from the shared rules", () => {
    expect(sail(sent(), "wreck-1")).toEqual({ ok: false, reason: "Build the Harbor to send more fleets" });
  });
});

describe("report ids", () => {
  const FULL = { boarders: 25, harpooners: 25, crossbowmen: 25 };
  /** Sends a fleet to camp-1 with full troops, and brings it back with its report. */
  const raid = (s: PlayerState): PlayerState => {
    const r = sail({ ...s, troops: { ...FULL } }, "camp-1");
    if (!r.ok) throw new Error(r.reason);
    return advance(r.state, 8 * HOUR);
  };

  it("a new city has no report and a counter at 0", () => {
    expect(newPlayerState().reportSeq).toBe(0);
  });

  it("reports are numbered r1, r2… in the order they arrive", () => {
    const s = raid(raid(newPlayerState()));
    expect(s.reports.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(s.reportSeq).toBe(2);
  });

  it("two fleets coming back in the same stretch of time get different ids", () => {
    let s: PlayerState = { ...newPlayerState(), buildings: { ...newPlayerState().buildings, harbor: 2 } };
    for (const site of ["camp-1", "camp-2"]) {
      const r = sail({ ...s, troops: { ...FULL } }, site);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    expect(s.fleets).toHaveLength(2);
    const after = advance(s, 8 * HOUR);
    expect(after.reports.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(after.reports.map((r) => r.site).sort()).toEqual(["camp-1", "camp-2"]);
  });

  it("the same ids, whether time passes at once or in 2000 small steps", () => {
    const start = sail(newPlayerState(), "camp-1");
    if (!start.ok) throw new Error(start.reason);
    let s = start.state;
    for (let i = 0; i < 2000; i++) s = advance(s, (8 * HOUR) / 2000);
    const once = advance(start.state, 8 * HOUR);
    expect(once.reports).toHaveLength(1);
    expect(s.reports.map((r) => r.id)).toEqual(once.reports.map((r) => r.id));
    expect(s.reportSeq).toBe(once.reportSeq);
  });

  it("only the last 20 reports are kept, and an id is never used again", () => {
    let s = newPlayerState();
    for (let i = 0; i < 21; i++) s = raid(s);
    expect(s.reports).toHaveLength(MAX_REPORTS);
    expect(s.reports[0]!.id).toBe("r2");
    expect(s.reports.at(-1)!.id).toBe("r21");
    expect(s.reportSeq).toBe(21);
    expect(raid(s).reports.at(-1)!.id).toBe("r22");
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

  it("reads an empty wreck with its wait, and refuses an empty wreck without one, a wait too long, or a wait for a wreck that is not empty", () => {
    const s = newPlayerState();
    const empty = { ...s.world.wrecks, "wreck-1": 0 };
    const ok = { ...s, world: { ...s.world, wrecks: empty, refill: { "wreck-1": 1200 } } };
    expect(parseState(json(ok))).toEqual(ok);
    expect(parseState(json({ ...s, world: { ...s.world, wrecks: empty } }))).toBeNull();
    expect(parseState(json({ ...s, world: { ...s.world, wrecks: empty, refill: { "wreck-1": 2 * HOUR + 1 } } }))).toBeNull();
    expect(parseState(json({ ...s, world: { ...s.world, wrecks: empty, refill: { "wreck-1": 0 } } }))).toBeNull();
    expect(parseState(json({ ...s, world: { ...s.world, refill: { "wreck-1": 1200 } } }))).toBeNull();
    expect(parseState(json({ ...s, world: { ...s.world, refill: { "camp-1": 1200 } } }))).toBeNull();
    const { refill: _r, ...noRefill } = s.world;
    expect(parseState(json({ ...s, world: noRefill }))).toBeNull();
  });

  it("refuses a report without a good id, ids used twice, or a counter below an id", () => {
    const s = catchUp(playing(), 8 * HOUR);
    const r = s.reports[0]!;
    const { id: _id, ...noId } = r;
    expect(parseState(json({ ...s, reports: [noId] }))).toBeNull();
    for (const id of ["1", "r0", "r01", "R1", "r1234567890", ""]) expect(parseState(json({ ...s, reports: [{ ...r, id }] })), id).toBeNull();
    expect(parseState(json({ ...s, reports: [r, { ...r }] }))).toBeNull();
    expect(parseState(json({ ...s, reportSeq: 0 }))).toBeNull();
    const { reportSeq: _seq, ...noSeq } = s;
    expect(parseState(json(noSeq))).toBeNull();
    for (const reportSeq of [-1, 1.5, "1", 1_000_000_000]) expect(parseState(json({ ...s, reportSeq })), String(reportSeq)).toBeNull();
    expect(parseState(json({ ...s, reportSeq: 999_999_999 }))?.reportSeq).toBe(999_999_999);
    expect(parseState(json({ ...s, reportSeq: 7 }))?.reportSeq).toBe(7);
  });

  it("refuses a bad report, or more reports than are kept", () => {
    const s = catchUp(playing(), 8 * HOUR);
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
