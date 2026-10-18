import { describe, expect, it } from "vitest";
import {
  ATTACK_STAY,
  COLLECT_STAY,
  HOME,
  SEA_SITES,
  STARTING_BUILDINGS,
  STARTING_STOCK,
  STARTING_TROOPS,
  WRECK_REFILL,
  advanceFleets,
  distance,
  emptyTroops,
  fleetsMax,
  holdCapacity,
  hospitalCapacity,
  leadOf,
  pirateCamp,
  resolveCombat,
  seaSite,
  sendFleet,
  startingLeviathan,
  startingSeaWorld,
  storeCap,
  travelTime,
  wreckOil,
  type SeaState,
} from "../src/index.js";

const start = (): SeaState => ({
  buildings: { ...STARTING_BUILDINGS },
  troops: { ...STARTING_TROOPS },
  veterans: emptyTroops(),
  stock: { ...STARTING_STOCK },
  pearls: 200,
  wounded: emptyTroops(),
  techs: {},
  rafts: {},
  lead: leadOf("tom", { tom: { level: 1 } }),
  captains: { tom: { level: 1, xp: 0, stars: 1 } },
  shards: {},
  fleets: [],
  world: startingSeaWorld(),
  clock: 0,
  leviathan: startingLeviathan(),
});

const send = (id: string, s: SeaState): SeaState => {
  const r = sendFleet(id, s);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};

describe("sea map (prototype values)", () => {
  it("41 sites with unique ids (the prototype's 40 and the Leviathan), your city at (-14, 12)", () => {
    expect(SEA_SITES).toHaveLength(41);
    expect(new Set(SEA_SITES.map((s) => s.id)).size).toBe(41);
    expect(HOME).toEqual({ x: -14, z: 12 });
    expect(SEA_SITES.filter((s) => s.kind === "wreck")).toHaveLength(8);
    expect(SEA_SITES.filter((s) => s.kind === "camp").map((s) => s.level)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("the level 1 camp sits where the prototype put it", () => {
    expect(seaSite("camp-1")).toMatchObject({ x: 23.14, z: 15.1, level: 1 });
    expect(distance(seaSite("camp-1")!)).toBeCloseTo(37.27, 2);
  });

  it("wrecks start with the amounts of the fixed list", () => {
    expect(startingSeaWorld().wrecks["wreck-1"]).toBe(240);
    expect(startingSeaWorld().camps["camp-6"]).toBe(6);
  });
});

describe("fleet rules", () => {
  it("one fleet with no Harbor, one more every two levels", () => {
    expect([0, 1, 2, 3, 4].map(fleetsMax)).toEqual([1, 2, 2, 3, 3]);
  });

  it("travel time: distance at 4.2 units per prototype second, in real seconds", () => {
    // 37.27 / 4.2 = 8.87 prototype seconds × 360 = 3194 real seconds (53 min)
    const d = distance(seaSite("camp-1")!);
    expect(travelTime(seaSite("camp-1")!, {}, null)).toBe(3194);
    expect(travelTime(seaSite("camp-1")!, { sails: 1 }, null)).toBe(Math.round(((d / 4.2) * 360) / 1.1));
    expect(travelTime(seaSite("camp-1")!, {}, leadOf("sel", { sel: { level: 1 } }))).toBe(Math.round(((d / 4.2) * 360) / 1.4));
  });

  it("hold: 300 with no Harbor, +30% with Old Tom", () => {
    expect(holdCapacity(0, {}, null)).toBe(300);
    expect(holdCapacity(0, {}, leadOf("tom", { tom: { level: 1 } }))).toBe(390);
    expect(holdCapacity(2, { holds: 1 }, null)).toBe(920);
  });

  it("60 beds per Infirmary level", () => {
    expect(hospitalCapacity(0)).toBe(0);
    expect(hospitalCapacity(3)).toBe(180);
  });

  it("refuses with a reason in the second person", () => {
    const s = start();
    expect(sendFleet("fish-1", s)).toEqual({ ok: false, reason: "You cannot send a fleet there yet" });
    const busy = send("camp-1", s);
    expect(sendFleet("wreck-1", busy)).toEqual({ ok: false, reason: "Build the Harbor to send more fleets" });
    const harbor = { ...busy, buildings: { ...busy.buildings, harbor: 1 } };
    expect(sendFleet("wreck-1", { ...harbor, fleets: [...harbor.fleets, ...harbor.fleets] })).toEqual({ ok: false, reason: "All your fleets are at sea" });
    expect(sendFleet("camp-2", { ...s, troops: { boarders: 2, harpooners: 2, crossbowmen: 0 } })).toEqual({ ok: false, reason: "You do not have enough troops" });
  });
});

describe("attack: 25/25/25 against the level 1 camp, the whole trip", () => {
  const t = travelTime(seaSite("camp-1")!, {}, leadOf("tom", { tom: { level: 1 } }));

  it("your troops leave the city", () => {
    const s = send("camp-1", start());
    expect(s.troops).toEqual(emptyTroops());
    expect(s.fleets).toHaveLength(1);
    expect(s.fleets[0]!.troops).toEqual({ boarders: 25, harpooners: 25, crossbowmen: 25 });
  });

  it("nothing happens before the fleet arrives", () => {
    const r = advanceFleets(send("camp-1", start()), t - 1);
    expect(r.reports).toEqual([]);
    expect(r.state.fleets[0]!.phase).toBe("out");
  });

  it("on arrival: victory and 12 losses per type, as in the known prototype scenario", () => {
    const r = advanceFleets(send("camp-1", start()), t);
    expect(r.reports).toHaveLength(1);
    const rep = r.reports[0]!;
    const same = resolveCombat({ troops: { boarders: 25, harpooners: 25, crossbowmen: 25 }, enemy: pirateCamp(1), captain: { cls: "collect", rarity: "officer", level: 1 } });
    expect(rep.win).toBe(true);
    expect(rep.losses).toEqual({ boarders: 12, harpooners: 12, crossbowmen: 12 });
    expect(rep.attack).toBe(same.attack);
    expect(rep.defense).toBe(same.defense);
    expect(rep.loot).toEqual({ oil: 110, wood: 110, pearls: 16, rope: 1 });
    expect(r.state.world.camps["camp-1"]).toBe(2);
    expect(r.state.fleets[0]!.troops).toEqual({ boarders: 13, harpooners: 13, crossbowmen: 13 });
    expect(r.state.wounded).toEqual(emptyTroops());
  });

  it("back home: survivors and loot come back", () => {
    const s0 = start();
    const r = advanceFleets(send("camp-1", s0), t + ATTACK_STAY + t);
    expect(r.state.fleets).toEqual([]);
    expect(r.state.troops).toEqual({ boarders: 13, harpooners: 13, crossbowmen: 13 });
    expect(r.state.stock).toEqual({ ...s0.stock, oil: s0.stock.oil + 110, wood: s0.stock.wood + 110, rope: s0.stock.rope + 1 });
    expect(r.state.pearls).toBe(216);
    // A camp's loot has no storage cap: it carries the stock past it.
    const cap = storeCap(STARTING_BUILDINGS.lighthouse);
    const full = { ...start(), stock: { ...STARTING_STOCK, oil: cap, wood: cap } };
    expect(advanceFleets(send("camp-1", full), t + ATTACK_STAY + t).state.stock).toMatchObject({ oil: cap + 110, wood: cap + 110 });
  });

  it("the same trip in small steps gives the same result", () => {
    let s = send("camp-1", start());
    const reports = [];
    for (let i = 0; i < 100; i++) {
      const r = advanceFleets(s, (2 * t + ATTACK_STAY) / 100);
      s = r.state;
      reports.push(...r.reports);
    }
    // Small steps can leave a rounding crumb of time; the next step finishes the trip.
    const end = advanceFleets(s, 1);
    s = end.state;
    reports.push(...end.reports);
    const once = advanceFleets(send("camp-1", start()), 2 * t + ATTACK_STAY);
    expect(reports).toEqual(once.reports);
    expect(s.troops).toEqual(once.state.troops);
    expect(s.stock).toEqual(once.state.stock);
  });

  it("with an Infirmary, part of the losses rest there as wounded", () => {
    const s0 = { ...start(), buildings: { ...STARTING_BUILDINGS, infirmary: 1 } };
    const r = advanceFleets(send("camp-1", s0), t);
    expect(r.reports[0]!.wounded).toEqual({ boarders: 6, harpooners: 6, crossbowmen: 6 });
    expect(r.state.wounded).toEqual({ boarders: 6, harpooners: 6, crossbowmen: 6 });
  });

  it("the fleet keeps the research and captain it left with", () => {
    const s0 = start();
    const sent = send("camp-1", s0);
    // Research finished during the trip: Tempered Blades 3 and Double Hulls 3, and another lead captain.
    const later: SeaState = { ...sent, techs: { blades: 3, hulls: 3 }, lead: leadOf("mira", { mira: { level: 20 } }) };
    const a = advanceFleets(sent, 2 * t + ATTACK_STAY);
    const b = advanceFleets(later, 2 * t + ATTACK_STAY);
    expect(b.reports).toEqual(a.reports);
    expect(b.state.troops).toEqual(a.state.troops);
  });

  it("the copy does not follow later changes to the research object", () => {
    const techs = {};
    const sent = send("camp-1", { ...start(), techs });
    (techs as Record<string, number>).blades = 3;
    expect(sent.fleets[0]!.techs).toEqual({});
  });
});

describe("salvage", () => {
  const tom = leadOf("tom", { tom: { level: 1 } });
  const t = travelTime(seaSite("wreck-2")!, {}, tom);

  it("brings back what the hold carries, and 2 rope", () => {
    const s0 = start();
    const r = advanceFleets(send("wreck-2", s0), t + COLLECT_STAY + t);
    expect(r.state.stock.oil).toBe(s0.stock.oil + 390);
    expect(r.state.stock.rope).toBe(s0.stock.rope + 2);
    expect(r.state.world.wrecks["wreck-2"]).toBe(480 - 390);
    expect(r.state.troops).toEqual(s0.troops);
  });

  it("a wreck's oil fills the storage and no more; its rope always comes in", () => {
    const cap = storeCap(STARTING_BUILDINGS.lighthouse);
    const near = { ...start(), stock: { ...STARTING_STOCK, oil: cap - 100 } };
    const r = advanceFleets(send("wreck-2", near), t + COLLECT_STAY + t);
    expect(r.state.stock.oil).toBe(cap);
    expect(r.state.stock.rope).toBe(STARTING_STOCK.rope + 2);
    // Already past the storage (a camp's loot): the oil stays where it is.
    const over = { ...start(), stock: { ...STARTING_STOCK, oil: cap + 500 } };
    expect(advanceFleets(send("wreck-2", over), t + COLLECT_STAY + t).state.stock.oil).toBe(cap + 500);
  });

  it("an emptied wreck waits 2 hours, then fills again to its starting amount", () => {
    expect(WRECK_REFILL).toBe(2 * 3600);
    const t1 = travelTime(seaSite("wreck-1")!, {}, tom);
    const r = advanceFleets(send("wreck-1", start()), t1 + COLLECT_STAY);
    expect(r.state.fleets[0]!.cargo).toEqual({ oil: 240, rope: 2 });
    expect(r.state.world.wrecks["wreck-1"]).toBe(0);
    expect(r.state.world.refill).toEqual({ "wreck-1": WRECK_REFILL });
    // No fleet can sail to it while it waits.
    expect(sendFleet("wreck-1", { ...r.state, fleets: [] })).toEqual({ ok: false, reason: "This wreck is empty. Wait for it to fill again." });
    // It counts down only the time after its salvage, in one step or many.
    const later = advanceFleets(send("wreck-1", start()), t1 + COLLECT_STAY + WRECK_REFILL - 1).state;
    expect(later.world.wrecks["wreck-1"]).toBe(0);
    expect(later.world.refill).toEqual({ "wreck-1": 1 });
    let steps = r.state;
    for (let i = 0; i < 4; i++) steps = advanceFleets(steps, WRECK_REFILL / 4).state;
    expect(steps.world.wrecks["wreck-1"]).toBe(240);
    expect(steps.world.refill).toEqual({});
    expect(advanceFleets(r.state, WRECK_REFILL).state.world).toEqual(steps.world);
  });

  it("past Lighthouse 24, a salvage brings 25 % more oil per level above 24", () => {
    expect(wreckOil(400, 24)).toBe(400);
    expect(wreckOil(400, 25)).toBe(500);
    expect(wreckOil(400, 30)).toBe(1000);
    const t1 = travelTime(seaSite("wreck-1")!, {}, tom);
    const rich = { ...start(), buildings: { ...STARTING_BUILDINGS, lighthouse: 26 } };
    expect(advanceFleets(send("wreck-1", rich), t1 + COLLECT_STAY).state.fleets[0]!.cargo).toEqual({ oil: 360, rope: 2 });
  });

  it("two fleets ending at the same moment end in the order they left", () => {
    // Harbor 1 and Old Tom: a hold of 715. The wreck holds 1,000 here.
    const s0 = { ...start(), buildings: { ...STARTING_BUILDINGS, harbor: 1 } };
    s0.world.wrecks["wreck-2"] = 1000;
    let s = send("wreck-2", s0);
    s = send("wreck-2", s);
    const r = advanceFleets(s, t + COLLECT_STAY);
    // The first one takes 715; the second one takes the 285 left, and the wreck waits to fill again.
    expect(r.state.fleets.map((f) => f.cargo.oil)).toEqual([715, 285]);
    expect(r.state.world.wrecks["wreck-2"]).toBe(0);
    expect(r.state.world.refill).toEqual({ "wreck-2": WRECK_REFILL });
  });

  it("a fleet that finds its wreck emptied by another one comes back with nothing, and the wait does not start again", () => {
    const s0 = { ...start(), buildings: { ...STARTING_BUILDINGS, harbor: 1 } };
    s0.world.wrecks["wreck-2"] = 300;
    const s = send("wreck-2", send("wreck-2", s0));
    const r = advanceFleets(s, t + COLLECT_STAY);
    expect(r.state.fleets.map((f) => f.cargo)).toEqual([{ oil: 300, rope: 2 }, {}]);
    expect(r.state.world.refill).toEqual({ "wreck-2": WRECK_REFILL });
  });
});
