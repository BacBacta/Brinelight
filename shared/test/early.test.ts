import { describe, expect, it } from "vitest";
import {
  ATTACK_STAY,
  EARLY_BELOW,
  EARLY_CAMP_TRIP,
  EARLY_INSTALL,
  EARLY_RAFT,
  EARLY_TRAINING,
  RAFT_BUILD_TIME,
  RAFT_INSTALL_TIME,
  advance,
  applyAction,
  campTrip,
  installTime,
  newPlayerState,
  parseState,
  raftBuildTime,
  raftUpgradeTime,
  seaSite,
  trainDuration,
  trainTime,
  travelTime,
  type GameAction,
  type PlayerState,
} from "../src/index.js";

/** The early start's uncapped works, capped (owner's decision of 23 October, docs/tasks/early-start.md). */
const act = (state: PlayerState, action: { type: GameAction["type"]; [field: string]: unknown }): PlayerState => {
  const r = applyAction(state, { ...action, id: "00000000-0000-4000-8000-000000000001" } as GameAction);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
const city = (lighthouse: number): PlayerState => {
  const s = newPlayerState(8 * 3600);
  return { ...s, buildings: { ...s.buildings, lighthouse, barracks: 1, harbor: 1 }, stock: { oil: 50_000, fish: 50_000, wood: 50_000, rope: 50 } };
};

describe("the early start's caps (owner's decision, 23 October)", () => {
  it("hold for every city while the Lighthouse is below level 6: 5, 5, 5 and 10 minutes", () => {
    expect(EARLY_BELOW).toBe(6);
    expect([EARLY_RAFT, EARLY_INSTALL, EARLY_TRAINING, EARLY_CAMP_TRIP]).toEqual([300, 300, 300, 600]);
  });

  it("a batch of soldiers: at most 5 minutes below Lighthouse 6, then its own time", () => {
    expect(trainTime(20)).toBe(2880);
    for (const lh of [1, 2, 5]) expect(trainDuration(20, lh)).toBe(300);
    expect(trainDuration(20, 6)).toBe(2880);
    expect(trainDuration(0, 2)).toBe(Math.min(trainTime(0), 300));
    const trained = act(city(2), { type: "train", troop: "boarders" });
    expect(trained.training).toMatchObject({ kind: "train", left: 300, duration: 300 });
    expect(act(city(6), { type: "train", troop: "boarders" }).training).toMatchObject({ left: 2880, duration: 2880 });
  });

  it("the first raft: at most 5 minutes below Lighthouse 6; the next ones, and from 6, the raft's own time", () => {
    expect(RAFT_BUILD_TIME).toBe(4320);
    expect(raftBuildTime({}, 5)).toBe(300);
    expect(raftBuildTime({ "-3,0": { hp: 100, building: null, level: 0 } }, 5)).toBe(RAFT_BUILD_TIME);
    expect(raftBuildTime({}, 6)).toBe(RAFT_BUILD_TIME);
    const s = act(city(5), { type: "dockRaft", slot: "-3,0" });
    expect(s.yard).toMatchObject({ kind: "raft", left: 300, duration: 300 });
  });

  it("a raft building's first level: at most 5 minutes below Lighthouse 6; its next levels unchanged", () => {
    expect(RAFT_INSTALL_TIME).toBe(2880);
    expect(installTime(5)).toBe(300);
    expect(installTime(6)).toBe(RAFT_INSTALL_TIME);
    const moored = { ...city(4), rafts: { "-3,0": { hp: 100, building: null, level: 0 } } };
    expect(act(moored, { type: "installOnRaft", slot: "-3,0", building: "greenhouse" }).yard).toMatchObject({ kind: "install", left: 300, duration: 300 });
    const built = { ...city(4), rafts: { "-3,0": { hp: 100, building: "greenhouse" as const, level: 1 } } };
    expect(act(built, { type: "upgradeRaft", slot: "-3,0" }).yard).toMatchObject({ kind: "upgrade", duration: raftUpgradeTime(1) });
  });

  it("the way out to a pirate camp: at most 10 minutes below Lighthouse 6; the way back, the wrecks and the Leviathan unchanged", () => {
    const camp = seaSite("camp-1")!;
    const travel = travelTime(camp, {}, null);
    expect(travel).toBeGreaterThan(600);
    expect(campTrip(travel, 5)).toBe(600);
    expect(campTrip(300, 5)).toBe(300);
    expect(campTrip(travel, 6)).toBe(travel);

    const s = act(city(2), { type: "sail", site: "camp-1" });
    const fleet = s.fleets[0]!;
    expect(fleet).toMatchObject({ phase: "out", left: 600, out: 600 });
    expect(fleet.travel).toBe(travelTime(camp, s.techs, fleet.lead));
    // Out in 10 minutes, then the camp's stay, then the whole way back.
    const there = advance(s, 600);
    expect(there.fleets[0]?.phase ?? "fought").not.toBe("out");
    const wreck = act(city(2), { type: "sail", site: "wreck-1" }).fleets[0]!;
    expect(wreck.out).toBeUndefined();
    expect(wreck.left).toBe(wreck.travel);
    const later = act(city(6), { type: "sail", site: "camp-1" }).fleets[0]!;
    expect(later.out).toBeUndefined();
    expect(later.left).toBe(later.travel);
    expect(ATTACK_STAY).toBeGreaterThan(0);
  });

  it("a stored fleet with its way out reads back; a way out longer than the trip, or not a number, drops the fleet", () => {
    const s = act(city(2), { type: "sail", site: "camp-1" });
    const read = parseState(JSON.parse(JSON.stringify(s)))!;
    expect(read.fleets[0]).toMatchObject({ out: 600, left: 600 });
    const raw = JSON.parse(JSON.stringify(s));
    raw.fleets[0].left = 5000;
    expect(parseState(raw)!.fleets[0]!.left).toBe(600);
    for (const out of [raw.fleets[0].travel + 1, "600", 0]) {
      const bad = JSON.parse(JSON.stringify(s));
      bad.fleets[0].out = out;
      expect(parseState(bad)!.fleets, String(out)).toEqual([]);
    }
  });
});
