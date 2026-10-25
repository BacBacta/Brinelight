import { describe, expect, it } from "vitest";
import {
  COLLECT_STAY,
  HARVEST_GROWTH,
  HARVEST_REFILL,
  HOUR,
  SEA_SITES,
  STARTING_BUILDINGS,
  WRECK_REFILL,
  advanceFleets,
  emptyTroops,
  harvestAmount,
  holdCapacity,
  migrateCity,
  netRates,
  newPlayerState,
  parseState,
  producerLevel,
  sail,
  seaSite,
  sendFleet,
  startingLeviathan,
  startingSeaWorld,
  storeCap,
  travelTime,
  type SeaState,
} from "../src/index.js";

/** E (owner's choice, 23 October; docs/studies/resources.md): the producers follow the costs, and the sea gives wood and fish. */

const city = (lighthouse = 6, harbor = 4): SeaState => ({
  buildings: { ...STARTING_BUILDINGS, lighthouse, harbor },
  troops: emptyTroops(),
  veterans: emptyTroops(),
  stock: { oil: 0, fish: 0, wood: 0, rope: 0 },
  pearls: 0,
  wounded: emptyTroops(),
  techs: {},
  rafts: {},
  lead: null,
  captains: {},
  shards: {},
  fleets: [],
  world: startingSeaWorld(),
  clock: 0,
  server: "s1",
  leviathan: startingLeviathan(),
});

const send = (id: string, s: SeaState): SeaState => {
  const r = sendFleet(id, s);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
/** A fleet's whole trip: out, its stay, and home. */
const roundTrip = (id: string, s: SeaState) => {
  const sent = send(id, s);
  const f = sent.fleets.at(-1)!;
  return advanceFleets(sent, 2 * f.travel + COLLECT_STAY).state;
};

describe("A: the producers follow the costs", () => {
  it("a producer of level L makes what level L + min(L, 5) made: double up to 5, then five levels ahead", () => {
    expect([0, 1, 2, 5, 6, 10, 15, 20, 30].map(producerLevel)).toEqual([0, 2, 4, 10, 11, 15, 20, 25, 35]);
  });

  it("the Lumberyard, the Refinery and the Fishery alike: 42 wood, 11 oil and 14 fish an hour a raised level", () => {
    const at = (level: number) =>
      netRates({ buildings: { ...STARTING_BUILDINGS, lighthouse: 0, refinery: level, fishery: level, lumberyard: level }, techs: {}, rafts: {}, survivors: 0, morale: 0 });
    const close = (r: { oil: number; fish: number; wood: number }, oil: number, fish: number, wood: number) => {
      expect(r.oil).toBeCloseTo(oil);
      expect(r.fish).toBeCloseTo(fish);
      expect(r.wood).toBeCloseTo(wood);
    };
    close(at(1), 22, 28, 84);
    close(at(5), 110, 140, 420);
    close(at(10), 165, 210, 630);
    // What the Lighthouse burns and the survivors eat do not change.
    const burn = netRates({ buildings: { ...STARTING_BUILDINGS, lighthouse: 4, refinery: 0, fishery: 0, lumberyard: 0 }, techs: {}, rafts: {}, survivors: 10, morale: 0 });
    expect(burn.oil).toBeCloseTo(-10);
    expect(burn.fish).toBeCloseTo(-2);
  });
});

describe("C: the Wooded Isles and Fish Shoals, harvested by the fleets", () => {
  const isle = seaSite("isle-1")!;
  const shoal = seaSite("fish-1")!;

  it("5 isles and 6 shoals on the map; one holds its amount, 10 % more a Lighthouse level, and fills again 8 hours after it is emptied", () => {
    expect(SEA_SITES.filter((s) => s.kind === "isle")).toHaveLength(5);
    expect(SEA_SITES.filter((s) => s.kind === "fish")).toHaveLength(6);
    expect(HARVEST_GROWTH).toBe(0.1);
    expect(HARVEST_REFILL).toBe(8 * HOUR);
    expect(harvestAmount(isle, 1)).toBe(600);
    expect(harvestAmount(isle, 11)).toBe(1200);
    expect(harvestAmount(shoal, 6)).toBe(630);
  });

  it("a fleet sails there with no troops, and brings back wood from an isle, fish from a shoal: no rope", () => {
    const s = city(6, 4);
    const hold = holdCapacity(4, {}, null);
    expect(hold).toBe(1300);
    const wood = roundTrip("isle-1", s);
    expect(wood.stock).toEqual({ oil: 0, fish: 0, wood: harvestAmount(isle, 6), rope: 0 });
    expect(wood.troops).toEqual(emptyTroops());
    const fish = roundTrip("fish-1", s);
    expect(fish.stock).toEqual({ oil: 0, fish: harvestAmount(shoal, 6), wood: 0, rope: 0 });
  });

  it("an isle bigger than the hold keeps the rest for the next fleet, and only once emptied it waits", () => {
    const s = city(30, 0);
    const amount = harvestAmount(isle, 30);
    const hold = holdCapacity(0, {}, null);
    expect(amount).toBeGreaterThan(hold);
    const once = roundTrip("isle-1", s);
    expect(once.stock.wood).toBe(hold);
    expect(once.world.harvest["isle-1"]).toBe(amount - hold);
    expect(once.world.refill["isle-1"]).toBeUndefined();
    let t = once;
    while ((t.world.harvest["isle-1"] ?? amount) > 0) t = roundTrip("isle-1", t);
    expect(t.stock.wood).toBe(amount);
    const wait = t.world.refill["isle-1"]!;
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(HARVEST_REFILL);
    expect(sendFleet("isle-1", t)).toEqual({ ok: false, reason: "This isle is bare. Wait for it to grow back." });
    // Filled again: full, at the Lighthouse's level of its next harvest.
    const later = advanceFleets(t, wait).state;
    expect(later.world.harvest["isle-1"]).toBeUndefined();
    expect(later.world.refill["isle-1"]).toBeUndefined();
    expect(sendFleet("isle-1", later).ok).toBe(true);
  });

  it("an emptied shoal says so; the wrecks keep their oil, their rope and their 2 hours", () => {
    const s = { ...city(6, 0), world: { ...startingSeaWorld(), harvest: { "fish-1": 0 }, refill: { "fish-1": HOUR } } };
    expect(sendFleet("fish-1", s)).toEqual({ ok: false, reason: "This shoal is empty. Wait for the fish to come back." });
    const wreck = roundTrip("wreck-1", city(6, 0));
    expect(wreck.stock).toEqual({ oil: 240, fish: 0, wood: 0, rope: 2 });
    expect(wreck.world.refill["wreck-1"]).toBeLessThanOrEqual(WRECK_REFILL);
  });

  it("in the Mist, only within the Lighthouse's light; what a fleet brings back fills the storage and no more", () => {
    const far = SEA_SITES.filter((x) => x.kind === "isle").sort((a, b) => travelTime(b, {}, null) - travelTime(a, {}, null))[0]!;
    expect(sendFleet(far.id, city(6), { reach: 1, lit: false })).toEqual({ ok: false, reason: "The Mist hides this place. Stoke the Lighthouse or wait for it to lift." });
    const full = { ...city(6, 4), stock: { oil: 0, fish: 0, wood: storeCap(6) - 100, rope: 0 } };
    expect(roundTrip("isle-1", full).stock.wood).toBe(storeCap(6));
  });

  it("the city keeps what is left on each isle and shoal; a bad value drops the city, as a bad wreck", () => {
    const s = newPlayerState();
    expect(s.world.harvest).toEqual({});
    const world = { ...s.world, harvest: { "isle-1": 120, "fish-2": 0 }, refill: { "fish-2": HOUR } };
    const kept = { ...s, world };
    expect(parseState(JSON.parse(JSON.stringify(kept)))).toEqual(kept);
    for (const bad of [
      { harvest: { "wreck-1": 10 } },
      { harvest: { "isle-1": -1 } },
      { harvest: { "isle-1": "lots" } },
      { harvest: { "fish-2": 0 }, refill: {} },
      { harvest: { "fish-2": 0 }, refill: { "fish-2": HARVEST_REFILL + 1 } },
      { harvest: { "isle-1": 10 }, refill: { "isle-1": HOUR } },
      { harvest: undefined },
    ]) {
      expect(parseState(JSON.parse(JSON.stringify({ ...s, world: { ...s.world, ...bad } }))), JSON.stringify(bad)).toBeNull();
    }
    // A fleet to an isle or a shoal is read back with the city.
    const sailing = sail(s, "isle-1");
    if (!sailing.ok) throw new Error(sailing.reason);
    expect(parseState(JSON.parse(JSON.stringify(sailing.state)))?.fleets).toEqual(sailing.state.fleets);
  });

  it("a city stored before the isles opened: every isle and shoal full", () => {
    const { harvest: _h, ...world } = newPlayerState(8 * HOUR).world;
    const old = { ...JSON.parse(JSON.stringify(newPlayerState(8 * HOUR))), world };
    expect(migrateCity(old, 11, { clock: 8 * HOUR })).toEqual(newPlayerState(8 * HOUR));
  });
});
