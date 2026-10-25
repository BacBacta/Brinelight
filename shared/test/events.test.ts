import { describe, expect, it } from "vitest";
import {
  DAY,
  HOUR,
  RAFT_SLOTS,
  advance,
  dockRaft,
  eventsBetween,
  heal,
  installOnRaft,
  logbook,
  newPlayerState,
  promote,
  research,
  stoke,
  train,
  unlockCaptain,
  upgrade,
  upgradeRaft,
  type ActionResult,
  type PlayerState,
} from "../src/index.js";

const ok = (r: ActionResult): PlayerState => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
/** A rich, built city, so every work can start. */
const rich = (): PlayerState => {
  const s = newPlayerState();
  return {
    ...s,
    buildings: { lighthouse: 6, refinery: 3, fishery: 3, lumberyard: 3, shelters: 2, barracks: 3, harbor: 1, observatory: 3, infirmary: 1 },
    techs: { veterans: 1 },
    stock: { oil: 90000, fish: 90000, wood: 90000, rope: 50 },
    troops: { boarders: 60, harpooners: 60, crossbowmen: 60 },
    wounded: { boarders: 5, harpooners: 3, crossbowmen: 0 },
    // Its Shelters full: no survivor comes in these tests (told apart, in population.test.ts).
    survivors: 14,
  };
};
/** The city once every work in progress is done. */
const later = (s: PlayerState): PlayerState => advance(s, DAY);
const slot = RAFT_SLOTS.find((x) => x.ring === 3)!.key;
/** The events of the works only: a day also brings three Mists, tested on their own. */
const works = (a: PlayerState, b: PlayerState) => eventsBetween(a, b).filter((e) => e.kind !== "mistHeld" && e.kind !== "mistMissed");

describe("what happened between two cities", () => {
  it("nothing between a city and itself, or while works only go on", () => {
    const s = ok(upgrade(rich(), "refinery"));
    expect(works(s, s)).toEqual([]);
    expect(works(s, advance(s, 1))).toEqual([]);
  });

  it("a building that ends its upgrade, with its new level", () => {
    const s = ok(upgrade(rich(), "refinery"));
    expect(works(s, later(s))).toEqual([{ kind: "building", building: "refinery", level: 4 }]);
  });

  it("a research that ends", () => {
    const s = ok(research(rich(), "saws"));
    expect(works(s, later(s))).toEqual([{ kind: "research", tech: "saws", level: 1 }]);
  });

  it("a raft moored, a building put on it, then that building one level up", () => {
    const docked = ok(dockRaft(rich(), slot));
    const moored = later(docked);
    expect(works(docked, moored)).toEqual([{ kind: "raft", slot }]);
    const installing = ok(installOnRaft(moored, slot, "greenhouse"));
    const installed = later(installing);
    expect(works(installing, installed)).toEqual([{ kind: "raftBuilding", slot, building: "greenhouse", level: 1 }]);
    const upgrading = ok(upgradeRaft(installed, slot));
    expect(works(upgrading, later(upgrading))).toEqual([{ kind: "raftBuilding", slot, building: "greenhouse", level: 2 }]);
  });

  it("soldiers trained, veterans promoted, wounded healed", () => {
    const training = ok(train(rich(), "harpooners"));
    expect(works(training, later(training))).toEqual([{ kind: "troops", troop: "harpooners", count: 60 }]);
    const promoting = ok(promote(rich(), "boarders"));
    expect(works(promoting, later(promoting))).toEqual([{ kind: "veterans", troop: "boarders", count: 10 }]);
    const healing = ok(heal(rich()));
    expect(works(healing, later(healing))).toEqual([{ kind: "healed", count: 8 }]);
  });

  it("a new batch started right after the last one ended still counts the one that ended", () => {
    const first = ok(train(rich(), "boarders"));
    const second = ok(train(later(first), "crossbowmen"));
    expect(works(first, second)).toEqual([{ kind: "troops", troop: "boarders", count: 60 }]);
  });

  it("a captain who rises a level; a captain just recruited is not a level up", () => {
    const s = rich();
    const lead = s.lead!;
    const before = { ...s, pearls: 5000, captains: { ...s.captains, [lead]: { level: 1, xp: 79, stars: 1 } } };
    const after = ok(logbook(before));
    expect(after.captains[lead]!.level).toBeGreaterThan(1);
    expect(works(before, after)).toEqual([{ kind: "captain", captain: lead, level: after.captains[lead]!.level }]);
    const recruit = ok(unlockCaptain({ ...s, shards: { sel: 10 } }, "sel"));
    expect(works({ ...s, shards: { sel: 10 } }, recruit)).toEqual([]);
  });

  it("a long time away: every work that ended, in a fixed order, and a building risen two levels counts once", () => {
    let s = ok(upgrade(rich(), "fishery"));
    s = ok(research(s, "nets"));
    s = ok(train(s, "boarders"));
    const away = later(s);
    const again = later(ok(upgrade(away, "fishery")));
    expect(works(s, away).map((e) => e.kind)).toEqual(["building", "research", "troops"]);
    expect(works(s, again).filter((e) => e.kind === "building")).toEqual([{ kind: "building", building: "fishery", level: 5 }]);
  });

  it("the Mists that lifted: one event for those held, with their Pearls, one for those not held, with the rafts damaged", () => {
    const s = { ...rich(), rafts: { [slot]: { hp: 100, building: null, level: 0 } } };
    expect(eventsBetween(s, advance(s, DAY))).toContainEqual({ kind: "mistHeld", count: 3, pearls: 90 });
    const off = ok(stoke(s, false));
    expect(eventsBetween(off, advance(off, 7 * HOUR))).toEqual([{ kind: "mistMissed", count: 1, rafts: 1 }]);
    expect(eventsBetween(s, advance(s, HOUR))).toEqual([]);
  });
});
