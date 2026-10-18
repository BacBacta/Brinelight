import { describe, expect, it } from "vitest";
import {
  CHESTS,
  DAILY_TASKS,
  DAY,
  HOUR,
  OBJECTIVES,
  advance,
  applyAction,
  canOpenChest,
  chestReward,
  claimObjective,
  countDaily,
  dailyOn,
  dailyPoints,
  dayOf,
  migrateCity,
  newPlayerState,
  openChest,
  parseAction,
  parseState,
  startingDaily,
  type PlayerState,
} from "../src/index.js";

/** 18 October 2026, 00:00 UTC. */
const MIDNIGHT = 1_792_281_600;
const at = (h: number, m = 0) => MIDNIGHT + h * HOUR + m * 60;
const ID = "00000000-0000-4000-8000-000000000004";
const ok = (r: { ok: true; state: PlayerState } | { ok: false; reason: string }): PlayerState => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
const city = (clock = at(9)): PlayerState => ({ ...newPlayerState(clock), stock: { oil: 50_000, fish: 50_000, wood: 50_000, rope: 50 } });
const act = (s: PlayerState, a: Record<string, unknown>) => applyAction(s, { id: ID, ...a } as Parameters<typeof applyAction>[1]);

describe("the objectives", () => {
  it("18 objectives, the prototype's without other players, payments, speedups or fixed hours", () => {
    expect(OBJECTIVES).toHaveLength(18);
    expect(OBJECTIVES[11]).toMatchObject({ text: "Upgrade the Lumberyard to level 3", reward: { fish: 300 } });
    expect(OBJECTIVES.map((o) => o.text).filter((t) => /alliance|Leviathan|recruit|Pact/i.test(t))).toEqual([]);
  });

  it("each condition, on a city that meets it and one that does not", () => {
    const base = newPlayerState();
    const b = (k: keyof PlayerState["buildings"], level: number) => ({ ...base, buildings: { ...base.buildings, [k]: level } });
    const raft = { hp: 100, building: null, level: 0 };
    const met: PlayerState[] = [
      b("refinery", 2),
      b("barracks", 1),
      b("harbor", 1),
      b("observatory", 1),
      { ...base, research: { id: "nets", left: 10, duration: 20 } },
      { ...base, progress: { gathers: 1, trained: 0, camps: 0 } },
      b("lighthouse", 3),
      { ...base, progress: { gathers: 0, trained: 1, camps: 0 } },
      { ...base, progress: { gathers: 0, trained: 0, camps: 1 } },
      b("infirmary", 1),
      { ...base, mist: { ...base.mist, held: 1 } },
      b("lumberyard", 3),
      b("shelters", 3),
      b("lighthouse", 4),
      { ...base, rafts: { "3,0": raft } },
      { ...base, rafts: { "3,0": { hp: 100, building: "greenhouse", level: 1 } } },
      b("harbor", 3),
      b("lighthouse", 5),
    ];
    OBJECTIVES.forEach((o, i) => {
      expect(o.done(met[i]!), o.text).toBe(true);
      expect(o.done(base), o.text).toBe(false);
    });
    // A research done counts as started; a raft with a Watchtower is not a greenhouse.
    expect(OBJECTIVES[4]!.done({ ...base, techs: { nets: 1 } })).toBe(true);
    expect(OBJECTIVES[15]!.done({ ...base, rafts: { "3,0": { hp: 100, building: "watchtower", level: 1 } } })).toBe(false);
  });

  it("claimed in order, once each: the reward, then the next one", () => {
    const s = city();
    expect(claimObjective(s)).toEqual({ ok: false, reason: "Finish your current objective first" });
    // The Barracks already built does not let you skip the Refinery.
    expect(claimObjective({ ...s, buildings: { ...s.buildings, barracks: 1 } })).toEqual({ ok: false, reason: "Finish your current objective first" });
    const done = { ...s, buildings: { ...s.buildings, refinery: 2, barracks: 1 } };
    const first = ok(claimObjective(done));
    expect(first.objective).toBe(1);
    expect(first.stock).toEqual({ ...done.stock, wood: done.stock.wood + 150, fish: done.stock.fish + 100 });
    const second = ok(claimObjective(first));
    expect(second.objective).toBe(2);
    expect(second.stock.fish).toBe(first.stock.fish + 200);
    expect(claimObjective(second)).toEqual({ ok: false, reason: "Finish your current objective first" });
  });

  it("Pearls go to the Pearls; resources above the storage still come in, as a camp's loot", () => {
    const s = { ...city(), objective: 5, progress: { gathers: 1, trained: 0, camps: 0 } };
    expect(ok(claimObjective(s)).pearls).toBe(s.pearls + 100);
    const full = { ...newPlayerState(), stock: { oil: 9_000_000, fish: 0, wood: 0, rope: 0 }, objective: 2, buildings: { ...newPlayerState().buildings, harbor: 1 } };
    expect(ok(claimObjective(full)).stock.oil).toBe(9_000_150);
  });

  it("after the last one, nothing is left to claim", () => {
    expect(claimObjective({ ...city(), objective: 18 })).toEqual({ ok: false, reason: "You have finished every objective" });
  });

  it("what the objectives count: gathers, trainings and camps beaten, by the rules", () => {
    let s = { ...city(at(9)), buildings: { ...newPlayerState().buildings, barracks: 1 } };
    s = ok(act(s, { type: "sail", site: "wreck-1" }));
    s = ok(act(s, { type: "train", troop: "boarders" }));
    expect(s.progress).toEqual({ gathers: 1, trained: 1, camps: 0 });
    // A camp beaten counts when the fleet fights, on the rules' clock.
    const army = { ...city(at(9)), troops: { boarders: 400, harpooners: 400, crossbowmen: 400 } };
    const won = advance(ok(act(army, { type: "sail", site: "camp-1" })), HOUR);
    expect(won.reports.at(-1)!.win).toBe(true);
    expect(won.progress.camps).toBe(1);
    expect(won.daily.counts.camps).toBe(1);
  });
});

describe("the daily tasks", () => {
  it("six tasks for 110 points; five chests", () => {
    expect(DAILY_TASKS.reduce((p, t) => p + t.points, 0)).toBe(110);
    expect(CHESTS).toEqual([20, 40, 60, 80, 100]);
  });

  it("points come when a task reaches its goal, counted from the city's actions", () => {
    let s = { ...city(at(9)), buildings: { ...newPlayerState().buildings, barracks: 1, observatory: 1 } };
    for (const building of ["refinery", "fishery"] as const) s = ok(act(s, { type: "upgrade", building }));
    expect(s.daily.counts.upgrades).toBe(2);
    expect(dailyPoints(s.daily)).toBe(0);
    // The two builders free again, a third upgrade: 30 points.
    s = advance(s, 2 * HOUR);
    s = ok(act(s, { type: "upgrade", building: "lumberyard" }));
    expect(dailyPoints(s.daily)).toBe(30);
    s = ok(act(s, { type: "train", troop: "boarders" }));
    s = ok(act(s, { type: "research", tech: "nets" }));
    expect(dailyPoints(s.daily)).toBe(50);
    // A fleet to a camp is not a gather; a refused action counts nothing.
    expect(act(s, { type: "train", troop: "boarders" }).ok).toBe(false);
    expect(s.daily.counts).toMatchObject({ gathers: 0, trains: 1, research: 1 });
  });

  it("a Mist held counts for the day it lifts", () => {
    const s = advance(city(at(11)), 4 * HOUR);
    expect(s.mist.held).toBe(1);
    expect(s.daily.counts.mists).toBe(1);
    expect(dailyPoints(s.daily)).toBe(20);
  });

  it("chests: once a day each, with enough points; the first two grow with the Lighthouse", () => {
    const s = { ...city(), daily: { ...startingDaily(at(9)), counts: { upgrades: 3, gathers: 3, camps: 0, trains: 1, mists: 1, research: 0 } } };
    expect(dailyPoints(s.daily)).toBe(80);
    const opened = ok(openChest(s, 20));
    expect(opened.stock).toEqual({ ...s.stock, wood: s.stock.wood + 120, fish: s.stock.fish + 120 });
    expect(opened.daily.chests).toEqual([20]);
    expect(openChest(opened, 20)).toEqual({ ok: false, reason: "You already opened this chest today" });
    expect(openChest(opened, 100)).toEqual({ ok: false, reason: "Not enough points yet" });
    expect(ok(openChest(opened, 80)).stock).toMatchObject({ oil: s.stock.oil + 400, rope: s.stock.rope + 2 });
    expect(chestReward(20, 10)).toEqual({ wood: 600, fish: 600 });
    expect(chestReward(40, 10)).toEqual({ oil: 800 });
    expect(chestReward(60, 10)).toEqual({ pearls: 100 });
    expect(chestReward(100, 30)).toEqual({ pearls: 200 });
  });

  it("everything resets at 00:00 UTC, an advance across midnight included", () => {
    const d = countDaily(startingDaily(at(23)), at(23), "upgrades", 3);
    expect(dailyOn(d, at(23, 59))).toBe(d);
    expect(dailyOn(d, at(24))).toEqual(startingDaily(at(24)));
    // A chest opened yesterday can be opened again today, with today's points.
    const s: PlayerState = { ...city(at(23)), daily: { ...d, counts: { ...d.counts, gathers: 3 }, chests: [20, 40] } };
    expect(canOpenChest(s.daily, at(23, 30), 20)).toEqual({ ok: false, reason: "You already opened this chest today" });
    expect(canOpenChest(s.daily, at(24, 30), 20)).toEqual({ ok: false, reason: "Not enough points yet" });
    // An advance from 23:00 to 01:00: yesterday's counts are gone, and the day is the new one.
    const after = advance(s, 2 * HOUR);
    expect(after.daily).toEqual(startingDaily(at(25)));
    expect(dayOf(after.clock)).toBe(dayOf(MIDNIGHT) + 1);
    // One long advance equals many short ones, across midnight and the Mist of 04:00 (it lifts at 06:00).
    let many = s;
    for (let i = 0; i < 60; i++) many = advance(many, 8 * 60);
    const once = advance(s, 8 * HOUR);
    expect(many.daily).toEqual(once.daily);
    expect(many.clock).toBe(once.clock);
    expect(once.daily.counts.mists).toBe(1);
    expect(once.daily.day).toBe(dayOf(at(31)));
    expect(DAY).toBe(24 * HOUR);
  });
});

describe("in the city", () => {
  it("a new city: the first objective, nothing counted, today's tasks", () => {
    const s = newPlayerState(at(9));
    expect(s.objective).toBe(0);
    expect(s.progress).toEqual({ gathers: 0, trained: 0, camps: 0 });
    expect(s.daily).toEqual(startingDaily(at(9)));
  });

  it("actions: claimObjective has no field, claimChest only a chest that exists", () => {
    expect(parseAction({ id: ID, type: "claimObjective" })).toEqual({ id: ID, type: "claimObjective" });
    expect(parseAction({ id: ID, type: "claimObjective", objective: 17 })).toBeNull();
    expect(parseAction({ id: ID, type: "claimChest", chest: 60 })).toEqual({ id: ID, type: "claimChest", chest: 60 });
    for (const chest of [0, 10, 50, 120, "20", null]) expect(parseAction({ id: ID, type: "claimChest", chest }), String(chest)).toBeNull();
    expect(parseAction({ id: ID, type: "claimChest", chest: 20, pearls: 200 })).toBeNull();
  });

  it("parseState keeps them, and refuses a day from the future, a chest twice or beyond the day's points", () => {
    const s: PlayerState = { ...city(at(9)), objective: 3, progress: { gathers: 2, trained: 1, camps: 4 }, daily: { ...startingDaily(at(9)), counts: { upgrades: 3, gathers: 0, camps: 0, trains: 1, mists: 0, research: 0 }, chests: [20, 40] } };
    const json = JSON.parse(JSON.stringify(s));
    expect(parseState(json)).toEqual(s);
    for (const bad of [
      { objective: 19 },
      { objective: -1 },
      { progress: { gathers: 1, trained: 0 } },
      { daily: { ...json.daily, day: dayOf(at(9)) + 1 } },
      { daily: { ...json.daily, chests: [20, 20] } },
      { daily: { ...json.daily, chests: [60] } },
      { daily: { ...json.daily, chests: [30] } },
      { daily: { ...json.daily, counts: { ...json.daily.counts, hunts: 1 } } },
    ]) {
      expect(parseState({ ...json, ...bad }), JSON.stringify(bad)).toBeNull();
    }
  });

  it("from shape 7: only the objectives and the daily tasks are added, on the city's own clock", () => {
    const { objective: _o, progress: _p, daily: _d, ...shape7 } = JSON.parse(JSON.stringify(newPlayerState(at(9))));
    expect(migrateCity(shape7, 7, { clock: at(9) + 3 * DAY })).toEqual(newPlayerState(at(9)));
  });
});
