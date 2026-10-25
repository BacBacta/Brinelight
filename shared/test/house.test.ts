import { describe, expect, it } from "vitest";
import {
  HOUR,
  HOUSE_LEVEL_EVERY,
  HOUSE_MAX_LEVEL,
  HOUSE_ROOM,
  RAFT_BUILDINGS,
  RAFT_BUILDING_MAX_LEVEL,
  RAFT_INSTALL_TIME,
  RAFT_MAX_HP,
  RAFT_SLOTS,
  advance,
  eventsBetween,
  houseLevelCap,
  houseLevels,
  installOnRaft,
  newPlayerState,
  parseState,
  raftBuildingCost,
  raftBuildingMaxLevel,
  raftUpgradeTime,
  survivorCap,
  survivorRoom,
  upgradeRaft,
  type PlayerState,
  type RaftBuildingId,
} from "../src/index.js";

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const SLOTS = RAFT_SLOTS.filter((s) => s.ring === 3).map((s) => s.key);
const [A, B, C] = SLOTS as [string, string, string];
const free = { hp: RAFT_MAX_HP, building: null, level: 0 };
const ok = (r: { ok: true; state: PlayerState } | { ok: false; reason: string }): PlayerState => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
/** A city at a Lighthouse level, with free plots won, much wood and a little of the rest. */
const city = (lighthouse: number, slots = SLOTS): PlayerState => {
  const s = newPlayerState(0);
  return {
    ...s,
    buildings: { ...s.buildings, lighthouse },
    rafts: Object.fromEntries(slots.map((k) => [k, { ...free }])),
    stock: { oil: 100, fish: 10_000, wood: 100_000, rope: 0 },
  };
};
const carrying = (s: PlayerState, slot: string, building: RaftBuildingId, level: number): PlayerState => ({ ...s, rafts: { ...s.rafts, [slot]: { hp: RAFT_MAX_HP, building, level } } });

describe("the House: the values (owner's decision, 25 October, option 5 of docs/studies/population.md)", () => {
  it("wood only: 600 at level 1, ×3 a level (48,600 for level 5)", () => {
    expect(RAFT_BUILDINGS.house.name).toBe("House");
    expect([0, 1, 2, 3, 4].map((l) => raftBuildingCost("house", l))).toEqual([{ wood: 600 }, { wood: 1800 }, { wood: 5400 }, { wood: 16_200 }, { wood: 48_600 }]);
  });

  it("5 levels, one more every 7 Lighthouse levels: level 1 from the start, 2 from Lighthouse 7, 5 from 28", () => {
    expect([HOUSE_MAX_LEVEL, HOUSE_LEVEL_EVERY]).toEqual([5, 7]);
    expect(raftBuildingMaxLevel("house")).toBe(5);
    expect(raftBuildingMaxLevel("greenhouse")).toBe(RAFT_BUILDING_MAX_LEVEL);
    expect([1, 6, 7, 13, 14, 21, 27, 28, 30].map(houseLevelCap)).toEqual([1, 1, 2, 2, 3, 4, 4, 5, 5]);
  });

  it("4 survivors of room a level, added to the Shelters'", () => {
    expect(HOUSE_ROOM).toBe(4);
    const s = carrying(carrying(city(20), A, "house", 3), B, "greenhouse", 2);
    expect(houseLevels(s.rafts)).toBe(3);
    expect(survivorRoom(s)).toBe(survivorCap(s.buildings.shelters) + 12);
    // A damaged plot's House keeps its room: no one is turned out.
    const flooded = { ...s, rafts: { ...s.rafts, [A]: { ...s.rafts[A]!, hp: 30 } } };
    expect(survivorRoom(flooded)).toBe(survivorRoom(s));
  });
});

describe("building a House", () => {
  it("on a free plot won, at the shipyard, in a raft building's time; as many as there are plots", () => {
    let s = city(10);
    const t = ok(installOnRaft(s, A, "house"));
    expect(t.stock.wood).toBe(s.stock.wood - 600);
    expect(t.stock.fish).toBe(s.stock.fish);
    expect(t.yard).toMatchObject({ kind: "install", building: "house", duration: RAFT_INSTALL_TIME });
    s = advance(t, RAFT_INSTALL_TIME);
    expect(s.rafts[A]).toEqual({ hp: RAFT_MAX_HP, building: "house", level: 1 });
    s = advance(ok(installOnRaft(s, B, "house")), RAFT_INSTALL_TIME);
    s = advance(ok(installOnRaft(s, C, "house")), RAFT_INSTALL_TIME);
    expect(houseLevels(s.rafts)).toBe(3);
  });

  it("goes up a level at the shipyard up to what the Lighthouse allows, in a raft building's upgrade time", () => {
    const s = carrying(city(14), A, "house", 1);
    const up = ok(upgradeRaft(s, A));
    expect(up.stock.wood).toBe(s.stock.wood - 1800);
    expect(up.yard).toMatchObject({ kind: "upgrade", duration: raftUpgradeTime(1) });
    const two = advance(up, raftUpgradeTime(1));
    expect(two.rafts[A]!.level).toBe(2);
    const three = advance(ok(upgradeRaft(two, A)), raftUpgradeTime(2));
    expect(three.rafts[A]!.level).toBe(3);
    // The Lighthouse 14 allows level 3; 21 allows 4.
    expect(upgradeRaft(three, A)).toEqual({ ok: false, reason: "Upgrade the Lighthouse first" });
    const four = advance(ok(upgradeRaft({ ...three, buildings: { ...three.buildings, lighthouse: 21 } }, A)), raftUpgradeTime(3));
    expect(four.rafts[A]!.level).toBe(4);
    expect(upgradeRaft(carrying(city(30), A, "house", 5), A)).toEqual({ ok: false, reason: "Max level" });
    // The other raft buildings still stop at level 3.
    expect(upgradeRaft(carrying(city(30), A, "greenhouse", 3), A)).toEqual({ ok: false, reason: "Max level" });
  });

  it("is told when it stands and when it goes up a level", () => {
    const s = city(10);
    const built = advance(ok(installOnRaft(s, A, "house")), RAFT_INSTALL_TIME);
    expect(eventsBetween(s, built)).toContainEqual({ kind: "raftBuilding", slot: A, building: "house", level: 1 });
  });
});

describe("the survivors come to the Houses' room", () => {
  it("a city whose Shelters are full fills its Houses", () => {
    const base = carrying(carrying(city(10), A, "house", 2), B, "house", 1);
    const s = { ...base, survivors: survivorCap(base.buildings.shelters) };
    const later = advance(s, 48 * HOUR);
    expect(later.survivors).toBe(survivorRoom(s));
    expect(later.survivors).toBe(survivorCap(s.buildings.shelters) + 12);
  });
});

describe("a city with Houses, read back", () => {
  it("is accepted as it is; a House past its last level, past the Lighthouse's, or survivors past the room are not", () => {
    const s = { ...carrying(carrying(city(28), A, "house", 5), B, "house", 2), survivors: 30 };
    expect(parseState(json(s))).toEqual(s);
    expect(parseState(json(carrying(s, A, "house", 6)))).toBeNull();
    expect(parseState(json(carrying({ ...s, buildings: { ...s.buildings, lighthouse: 13 } }, B, "house", 3)))).toBeNull();
    expect(parseState(json({ ...s, survivors: survivorRoom(s) + 1 }))).toBeNull();
    // As many Houses as there are plots: no limit of two.
    const many = SLOTS.reduce((c, k) => carrying(c, k, "house", 1), city(10));
    expect(parseState(json(many))).toEqual(many);
    // A House going up a level only below what the Lighthouse allows.
    const going = { ...carrying(city(14), A, "house", 3), yard: { slot: A, kind: "upgrade", left: 10, duration: 100 } };
    expect(parseState(json(going))).toBeNull();
    const fine = { ...carrying(city(14), A, "house", 2), yard: { slot: A, kind: "upgrade", left: 10, duration: 100 } };
    expect(parseState(json(fine))).toEqual(fine);
  });
});
