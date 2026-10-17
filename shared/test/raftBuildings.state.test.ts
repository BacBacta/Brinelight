import { describe, expect, it } from "vitest";
import {
  DAY,
  RAFT_BUILDINGS,
  RAFT_BUILDING_MAX_COPIES,
  RAFT_BUILDING_MAX_LEVEL,
  RAFT_INSTALL_TIME,
  RAFT_MAX_HP,
  RAFT_SLOTS,
  TIME_SCALE,
  advance,
  applyAction,
  dockRaft,
  installOnRaft,
  netRates,
  newPlayerState,
  parseAction,
  parseState,
  power,
  protoRatePerHour,
  raftBuildingCost,
  raftUpgradeTime,
  sail,
  upgradeRaft,
  type PlayerState,
  type RaftBuildingId,
} from "../src/index.js";

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const ID = "3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e4f";
const INNER = RAFT_SLOTS.filter((s) => s.ring === 3).map((s) => s.key);
const [A, B, C, D] = INNER as [string, string, string, string];
const free = { hp: RAFT_MAX_HP, building: null, level: 0 };

/** A city with four free rafts on the first ring, a large storage and enough to pay for several works. */
const moored = (): PlayerState => {
  const s = newPlayerState();
  return {
    ...s,
    buildings: { ...s.buildings, lighthouse: 6 },
    rafts: { [A]: { ...free }, [B]: { ...free }, [C]: { ...free }, [D]: { ...free } },
    stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 },
  };
};
const ok = (r: { ok: true; state: PlayerState } | { ok: false; reason: string }): PlayerState => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
/** A raft carrying `building` at `level`. */
const carrying = (s: PlayerState, slot: string, building: RaftBuildingId, level: number): PlayerState => ({
  ...s,
  rafts: { ...s.rafts, [slot]: { hp: RAFT_MAX_HP, building, level } },
});

describe("the balance values, from the prototype", () => {
  it("installing costs raftBuildingCost(id, 0) in 8 prototype seconds; upgrading raftBuildingCost(id, level) in 8 × 1.5^level", () => {
    expect(RAFT_INSTALL_TIME).toBe(8 * TIME_SCALE);
    expect(RAFT_INSTALL_TIME).toBe(48 * 60);
    expect([1, 2].map(raftUpgradeTime)).toEqual([72 * 60, 108 * 60]);
    expect(raftBuildingCost("greenhouse", 0)).toEqual({ wood: 200, oil: 80 });
    expect(raftBuildingCost("smokehouse", 0)).toEqual({ wood: 220, fish: 100 });
    expect(raftBuildingCost("watchtower", 0)).toEqual({ wood: 260, oil: 120 });
    expect(raftBuildingCost("greenhouse", 1)).toEqual({ wood: 320, oil: 130 });
    expect(raftBuildingCost("greenhouse", 2)).toEqual({ wood: 510, oil: 200 });
    expect(RAFT_BUILDING_MAX_LEVEL).toBe(3);
    expect(RAFT_BUILDING_MAX_COPIES).toBe(2);
  });
});

describe("putting a building on a raft", () => {
  it("is paid at once and takes the shipyard; the building stands at level 1 when the work is done", () => {
    const s = moored();
    const t = ok(installOnRaft(s, A, "greenhouse"));
    expect(t.yard).toEqual({ slot: A, kind: "install", building: "greenhouse", left: RAFT_INSTALL_TIME, duration: RAFT_INSTALL_TIME });
    expect(t.stock).toEqual({ ...s.stock, wood: 4800, oil: 4920 });
    expect(t.rafts[A]).toEqual(free);
    expect(advance(t, RAFT_INSTALL_TIME - 1).rafts[A]).toEqual(free);
    const done = advance(t, RAFT_INSTALL_TIME);
    expect(done.rafts[A]).toEqual({ hp: RAFT_MAX_HP, building: "greenhouse", level: 1 });
    expect(done.yard).toBeNull();
  });

  it("is refused in this order: no raft, a raft with a building, a third copy, the shipyard busy, the resources", () => {
    const s = carrying(carrying(moored(), A, "greenhouse", 1), B, "greenhouse", 2);
    const busy = ok(dockRaft({ ...s, rafts: { [A]: s.rafts[A]!, [B]: s.rafts[B]! } }, C));
    const broke = { ...busy, stock: { oil: 0, fish: 0, wood: 0, rope: 0 } };
    expect(installOnRaft(broke, C, "greenhouse")).toEqual({ ok: false, reason: "There is no raft here" });
    expect(installOnRaft(broke, A, "smokehouse")).toEqual({ ok: false, reason: "This raft already has a building" });
    const withFree = { ...broke, rafts: { ...broke.rafts, [D]: { ...free } } };
    expect(installOnRaft(withFree, D, "greenhouse")).toEqual({ ok: false, reason: "Each type is limited to 2 rafts" });
    expect(installOnRaft(withFree, D, "smokehouse")).toEqual({ ok: false, reason: "The shipyard is busy" });
    expect(installOnRaft({ ...withFree, yard: null }, D, "smokehouse")).toEqual({ ok: false, reason: "Not enough resources" });
    expect(installOnRaft({ ...withFree, yard: null, stock: moored().stock }, D, "smokehouse").ok).toBe(true);
  });

  it("a building being put on a raft counts as a copy", () => {
    const one = ok(installOnRaft(carrying(moored(), A, "watchtower", 1), B, "watchtower"));
    const done = advance(one, RAFT_INSTALL_TIME);
    expect(installOnRaft(done, C, "watchtower")).toEqual({ ok: false, reason: "Each type is limited to 2 rafts" });
    expect(installOnRaft(done, C, "smokehouse").ok).toBe(true);
  });

  it("just enough resources", () => {
    const s = { ...moored(), stock: { oil: 120, fish: 0, wood: 260, rope: 0 } };
    expect(installOnRaft(s, A, "watchtower").ok).toBe(true);
    expect(installOnRaft({ ...s, stock: { ...s.stock, oil: 119 } }, A, "watchtower")).toEqual({ ok: false, reason: "Not enough resources" });
  });
});

describe("upgrading a building on a raft", () => {
  it("costs raftBuildingCost(id, level), takes raftUpgradeTime(level), and adds one level", () => {
    const s = carrying(moored(), A, "smokehouse", 1);
    const t = ok(upgradeRaft(s, A));
    expect(t.yard).toEqual({ slot: A, kind: "upgrade", left: raftUpgradeTime(1), duration: raftUpgradeTime(1) });
    expect(t.stock).toEqual({ ...s.stock, wood: s.stock.wood - 350, fish: s.stock.fish - 160 });
    expect(advance(t, raftUpgradeTime(1) - 1).rafts[A]!.level).toBe(1);
    const done = advance(t, raftUpgradeTime(1));
    expect(done.rafts[A]).toEqual({ hp: RAFT_MAX_HP, building: "smokehouse", level: 2 });
    const three = advance(ok(upgradeRaft(done, A)), raftUpgradeTime(2));
    expect(three.rafts[A]!.level).toBe(3);
  });

  it("is refused in this order: no raft, no building, the highest level, the shipyard busy, the resources", () => {
    const s = carrying(carrying(moored(), A, "greenhouse", 3), B, "greenhouse", 1);
    const busy = { ...ok(installOnRaft(s, C, "watchtower")), stock: { oil: 0, fish: 0, wood: 0, rope: 0 } };
    const gone = { ...busy, rafts: { [A]: busy.rafts[A]!, [B]: busy.rafts[B]!, [C]: busy.rafts[C]! } };
    expect(upgradeRaft(gone, D)).toEqual({ ok: false, reason: "There is no raft here" });
    expect(upgradeRaft(busy, D)).toEqual({ ok: false, reason: "Put a building on this raft first" });
    expect(upgradeRaft(busy, A)).toEqual({ ok: false, reason: "Max level" });
    expect(upgradeRaft(busy, B)).toEqual({ ok: false, reason: "The shipyard is busy" });
    expect(upgradeRaft({ ...busy, yard: null }, B)).toEqual({ ok: false, reason: "Not enough resources" });
  });

  it("one work at a time at the shipyard, new rafts included", () => {
    const s = carrying(moored(), A, "greenhouse", 1);
    const up = ok(upgradeRaft(s, A));
    expect(dockRaft({ ...up, buildings: { ...up.buildings, lighthouse: 8 } }, INNER[5]!)).toEqual({ ok: false, reason: "The shipyard is busy" });
    expect(installOnRaft(up, B, "smokehouse")).toEqual({ ok: false, reason: "The shipyard is busy" });
    const raft = ok(dockRaft({ ...s, rafts: { [A]: s.rafts[A]! } }, B));
    expect(upgradeRaft(raft, A)).toEqual({ ok: false, reason: "The shipyard is busy" });
  });

  it("each level adds 90 to your Power, as the sheet says", () => {
    const p = (s: PlayerState) => power({ ...s, captains: [] });
    const s = carrying(moored(), A, "watchtower", 1);
    expect(p(carrying(s, A, "watchtower", 2)) - p(s)).toBe(90);
  });
});

describe("the effects start at the exact end of the work", () => {
  /** The rates of the city as it would be without the work: the cost is paid, but nothing is on the raft. */
  const fishRate = (s: PlayerState) => netRates(s).fish;

  it("Kelp Greenhouse: +4.5 fish per hour per level, from the end of the work, in one step or a thousand", () => {
    const s = ok(installOnRaft(moored(), A, "greenhouse"));
    const without = { ...s, yard: null };
    // Up to the end, exactly as a city without the greenhouse.
    expect(advance(s, RAFT_INSTALL_TIME).stock.fish).toBeCloseTo(advance(without, RAFT_INSTALL_TIME).stock.fish, 9);
    const done = advance(s, RAFT_INSTALL_TIME);
    expect(fishRate(done) - fishRate(without)).toBeCloseTo(protoRatePerHour(0.45), 9);
    expect(protoRatePerHour(0.45)).toBeCloseTo(4.5, 9);
    // An hour later: one more hour at the new rate.
    expect(advance(s, RAFT_INSTALL_TIME + 3600).stock.fish - done.stock.fish).toBeCloseTo(fishRate(done), 6);
    let many = s;
    for (let i = 0; i < 1000; i++) many = advance(many, (RAFT_INSTALL_TIME + 3600) / 1000);
    expect(many.stock.fish).toBeCloseTo(advance(s, RAFT_INSTALL_TIME + 3600).stock.fish, 6);
  });

  it("Smokehouse: 10% less fish eaten per level, from the end of the work", () => {
    const s = ok(installOnRaft(moored(), A, "smokehouse"));
    const without = { ...s, yard: null };
    const eaten = s.survivors * protoRatePerHour(0.06);
    expect(advance(s, RAFT_INSTALL_TIME - 1).stock.fish).toBeCloseTo(advance(without, RAFT_INSTALL_TIME - 1).stock.fish, 9);
    expect(fishRate(advance(s, RAFT_INSTALL_TIME)) - fishRate(without)).toBeCloseTo(eaten * 0.1, 9);
    const two = advance(ok(upgradeRaft(advance(s, RAFT_INSTALL_TIME), A)), raftUpgradeTime(1));
    expect(fishRate(two) - fishRate(without)).toBeCloseTo(eaten * 0.2, 9);
  });

  it("Watchtower: +5% attack per level for a fleet that leaves after the end of the work", () => {
    const s = ok(installOnRaft(moored(), A, "watchtower"));
    const before = ok(sail(advance(s, RAFT_INSTALL_TIME - 1), "camp-1"));
    const after = ok(sail(advance(s, RAFT_INSTALL_TIME), "camp-1"));
    expect(before.fleets[0]!.watchtowers).toBe(0);
    expect(after.fleets[0]!.watchtowers).toBe(1);
    const attack = (c: PlayerState) => advance(c, DAY).reports[0]!.attack;
    expect(attack(after)).toBeCloseTo(attack(before) * 1.05, 9);
    // A fleet at sea keeps the Watchtowers it left with.
    expect(advance(before, RAFT_INSTALL_TIME).fleets[0]!.watchtowers).toBe(0);
  });
});

describe("the raft actions", () => {
  it("applyAction gives the same city as the rule; parseAction reads a known slot and a known building only", () => {
    const s = carrying(moored(), B, "greenhouse", 1);
    expect(applyAction(s, { id: ID, type: "installOnRaft", slot: A, building: "watchtower" })).toEqual(installOnRaft(s, A, "watchtower"));
    expect(applyAction(s, { id: ID, type: "upgradeRaft", slot: B })).toEqual(upgradeRaft(s, B));
    expect(parseAction({ id: ID, type: "installOnRaft", slot: A, building: "smokehouse" })).toEqual({ id: ID, type: "installOnRaft", slot: A, building: "smokehouse" });
    expect(parseAction({ id: ID, type: "upgradeRaft", slot: A })).toEqual({ id: ID, type: "upgradeRaft", slot: A });
    for (const building of ["casino", "toString", "__proto__", "", 1, null]) {
      expect(parseAction({ id: ID, type: "installOnRaft", slot: A, building }), String(building)).toBeNull();
    }
    for (const slot of ["0,0", "9,9", "", null]) {
      expect(parseAction({ id: ID, type: "installOnRaft", slot, building: "greenhouse" })).toBeNull();
      expect(parseAction({ id: ID, type: "upgradeRaft", slot })).toBeNull();
    }
    // The level and the cost are the rule's: a client never sends them.
    expect(parseAction({ id: ID, type: "upgradeRaft", slot: A, level: 3 })).toBeNull();
    expect(parseAction({ id: ID, type: "installOnRaft", slot: A, building: "greenhouse", level: 3 })).toBeNull();
    expect(parseAction({ id: ID, type: "installOnRaft", slot: A })).toBeNull();
    expect(Object.keys(RAFT_BUILDINGS)).toEqual(["greenhouse", "smokehouse", "watchtower"]);
  });
});

describe("parseState: buildings on rafts and the shipyard's work", () => {
  const installing = ok(installOnRaft(carrying(moored(), B, "greenhouse", 1), A, "greenhouse"));
  const upgrading = ok(upgradeRaft(carrying(moored(), A, "smokehouse", 2), A));

  it("reads an installation and an upgrade in progress, and brings their time back within bounds", () => {
    expect(parseState(json(installing))).toEqual(installing);
    expect(parseState(json(upgrading))).toEqual(upgrading);
    expect(parseState(json({ ...upgrading, yard: { ...upgrading.yard!, left: 1e9 } }))?.yard?.left).toBe(upgrading.yard!.duration);
  });

  const job = installing.yard!;
  const bad: [string, unknown][] = [
    ["a raft with no building above level 0", { ...moored(), rafts: { [A]: { ...free, level: 1 } } }],
    ["a raft with a building at level 0", carrying(moored(), A, "greenhouse", 0)],
    ["a third copy of a type", carrying(carrying(carrying(moored(), A, "watchtower", 1), B, "watchtower", 1), C, "watchtower", 1)],
    ["a third copy being installed", carrying(installing, C, "greenhouse", 1)],
    ["an installation without a building", { ...installing, yard: { slot: job.slot, kind: "install", left: job.left, duration: job.duration } }],
    ["an installation of an unknown building", { ...installing, yard: { ...job, building: "casino" } }],
    ["an installation on a slot with no raft", { ...installing, yard: { ...job, slot: INNER[6] } }],
    ["an installation on a raft with a building", { ...installing, yard: { ...job, slot: B } }],
    ["an upgrade of a raft with no building", { ...upgrading, yard: { ...upgrading.yard!, slot: B } }],
    ["an upgrade above the highest level", carrying(upgrading, A, "smokehouse", 3)],
    ["an upgrade with a building named", { ...upgrading, yard: { ...upgrading.yard!, building: "smokehouse" } }],
    ["an unknown kind of work", { ...upgrading, yard: { ...upgrading.yard!, kind: "repair" } }],
  ];
  for (const [name, city] of bad) {
    it(`refuses ${name}`, () => {
      expect(parseState(json(city))).toBeNull();
    });
  }
});
