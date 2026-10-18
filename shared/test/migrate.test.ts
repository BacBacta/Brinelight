import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CITY_SHAPE, DAY, MIN_CITY_SHAPE, advance, emptyTroops, migrateCity, newPlayerState, parseState, readReport, startingLeviathan, startingMist, upgradeShape, type PlayerState } from "../src/index.js";

/** The city of week 4, made by the week 4 rules and stored as it is (see fixtures/README.md). */
const week4 = (): Record<string, unknown> => JSON.parse(readFileSync(new URL("./fixtures/city-week4.json", import.meta.url), "utf8"));
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
/** The time the stored city was last saved, as the server gives it (18 October 2026, 08:00 UTC). */
const SAVED = { clock: 1_792_310_400 };

describe("the shapes", () => {
  it("shape 7 is today's, shape 4 the oldest stored", () => {
    expect(CITY_SHAPE).toBe(7);
    expect(MIN_CITY_SHAPE).toBe(4);
  });

  it("today's parseState refuses the city of week 4 as it is: it lacks the fields of week 5", () => {
    expect(parseState(week4())).toBeNull();
  });
});

describe("from shape 4 to today's", () => {
  it("adds exactly the fields of weeks 5 and 7, and changes nothing else", () => {
    const raw = week4();
    const city = migrateCity(raw, 4, SAVED)!;
    expect(city).not.toBeNull();
    expect(city.training).toBeNull();
    expect(city.healing).toBeNull();
    expect(city.veterans).toEqual(emptyTroops());
    expect(city.shards).toEqual({});
    // Week 7: the city's clock starts at its last save, and the order to stoke is on.
    expect(city.clock).toBe(SAVED.clock);
    expect(city.mist).toEqual(startingMist());
    expect(city.mist.stoke).toBe(true);
    // And the Leviathan at level 1, never hunted.
    expect(city.leviathan).toEqual(startingLeviathan());
    // Everything the city had is there, unchanged; the fleets only gain their veterans.
    const { training: _t, healing: _h, veterans: _v, shards: _s, clock: _c, mist: _m, leviathan: _l, fleets, ...rest } = city;
    const { fleets: rawFleets, ...rawRest } = raw;
    expect(rest).toEqual(rawRest);
    expect(fleets).toEqual((rawFleets as object[]).map((f) => ({ ...f, veterans: emptyTroops() })));
  });

  it("keeps the fleet at sea and the reports: the fleet comes home with its troops", () => {
    const raw = week4() as { fleets: { site: string; phase: string; left: number; troops: object }[]; reports: object[] };
    const city = migrateCity(raw, 4, SAVED)!;
    expect(city.fleets).toHaveLength(1);
    expect(city.fleets[0]).toMatchObject({ site: "camp-2", phase: "out", left: raw.fleets[0]!.left, troops: raw.fleets[0]!.troops });
    expect(city.reports).toEqual(raw.reports);
    expect(city.reports.map((r) => [r.id, r.win, r.read])).toEqual([
      ["r1", true, true],
      ["r2", false, false],
    ]);
    // A report from before week 5 has no veterans, no Infirmary at the time, no captain's experience: it is read as it is.
    expect(city.reports[1]).not.toHaveProperty("infirmary");
    expect(city.reports[1]).not.toHaveProperty("captainXp");
    const later = advance(city, DAY);
    expect(later.fleets).toEqual([]);
    expect(later.reports).toHaveLength(3);
    expect(later.reports[2]!.site).toBe("camp-2");
    expect(readReport(later, "r2").reports[1]!.read).toBe(true);
  });

  it("keeps the shipyard's work, the research, the queue and the wounded", () => {
    const raw = week4() as Record<string, unknown>;
    const city = migrateCity(raw, 4, SAVED)!;
    expect(city.yard).toEqual(raw.yard);
    expect(city.yard?.kind).toBe("raft");
    expect(city.research).toEqual(raw.research);
    expect(city.queue).toEqual(raw.queue);
    expect(city.wounded).toEqual(raw.wounded);
  });

  it("running it again changes nothing; a city already in today's shape is read as it is", () => {
    const once = upgradeShape(week4(), 4, SAVED);
    expect(upgradeShape(once, 4, SAVED)).toEqual(once);
    expect(upgradeShape(once, 4, { clock: 0 })).toEqual(once);
    const today: PlayerState = {
      ...newPlayerState(1_800_000_000),
      shards: { sel: 3 },
      veterans: { boarders: 10, harpooners: 0, crossbowmen: 0 },
      mist: { stoke: false, dark: true, held: 4, missed: 2, damaged: 3 },
      leviathan: { level: 3, hunt: 1_799_989_200, damage: 1200, over: true },
    };
    expect(migrateCity(json(today), CITY_SHAPE, SAVED)).toEqual(today);
    // A field already there is never replaced, even when the city says it is older.
    expect(migrateCity(json(today), 4, SAVED)).toEqual(today);
    expect(migrateCity(json(today), 5, SAVED)).toEqual(today);
    expect(migrateCity(json(today), 6, SAVED)).toEqual(today);
  });

  it("from shape 5: only the clock and the Mist are added", () => {
    const { clock: _c, mist: _m, ...week5 } = json(newPlayerState());
    const city = migrateCity(week5, 5, SAVED)!;
    expect(city).toEqual({ ...newPlayerState(SAVED.clock) });
    // Today's parseState refuses a city without its clock or its Mist.
    expect(parseState(week5)).toBeNull();
  });

  it("from shape 6: only the Leviathan is added, at level 1 and never hunted", () => {
    const { leviathan: _l, ...shape6 } = json(newPlayerState(SAVED.clock));
    expect(migrateCity(shape6, 6, SAVED)).toEqual(newPlayerState(SAVED.clock));
    expect(parseState(shape6)).toBeNull();
  });

  it("never adds a field to a fleet that has it", () => {
    const raw = week4() as { fleets: Record<string, unknown>[] };
    raw.fleets[0]!.veterans = { boarders: 2, harpooners: 0, crossbowmen: 0 };
    expect(migrateCity(raw, 4, SAVED)!.fleets[0]!.veterans).toEqual({ boarders: 2, harpooners: 0, crossbowmen: 0 });
  });
});

describe("cities that cannot be read", () => {
  it("a shape older than 4, newer than 7, or not a whole number", () => {
    for (const shape of [0, 3, 8, 99, 4.5, NaN]) expect(migrateCity(week4(), shape, SAVED), String(shape)).toBeNull();
  });

  it("a city of shape 4 with a field parseState refuses, once the missing fields are added", () => {
    expect(migrateCity({ ...week4(), pearls: "lots" }, 4, SAVED)).toBeNull();
    expect(migrateCity({ ...week4(), fleets: "none" }, 4, SAVED)).toBeNull();
    expect(migrateCity({ ...week4(), mist: { stoke: "yes" } }, 4, SAVED)).toBeNull();
    expect(migrateCity({ ...week4(), leviathan: { level: 0 } }, 4, SAVED)).toBeNull();
  });

  it("anything but an object", () => {
    for (const raw of [null, [], "city", 4]) expect(migrateCity(raw, 4, SAVED)).toBeNull();
  });
});
