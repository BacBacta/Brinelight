import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CITY_SHAPE, DAY, MIN_CITY_SHAPE, advance, emptyTroops, migrateCity, newPlayerState, parseState, readReport, upgradeShape, type PlayerState } from "../src/index.js";

/** The city of week 4, made by the week 4 rules and stored as it is (see fixtures/README.md). */
const week4 = (): Record<string, unknown> => JSON.parse(readFileSync(new URL("./fixtures/city-week4.json", import.meta.url), "utf8"));
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe("the shapes", () => {
  it("shape 5 is today's, shape 4 the oldest stored", () => {
    expect(CITY_SHAPE).toBe(5);
    expect(MIN_CITY_SHAPE).toBe(4);
  });

  it("today's parseState refuses the city of week 4 as it is: it lacks the fields of week 5", () => {
    expect(parseState(week4())).toBeNull();
  });
});

describe("from shape 4 to shape 5", () => {
  it("adds exactly the fields of week 5, and changes nothing else", () => {
    const raw = week4();
    const city = migrateCity(raw, 4)!;
    expect(city).not.toBeNull();
    expect(city.training).toBeNull();
    expect(city.healing).toBeNull();
    expect(city.veterans).toEqual(emptyTroops());
    expect(city.shards).toEqual({});
    // Everything the city had is there, unchanged; the fleets only gain their veterans.
    const { training: _t, healing: _h, veterans: _v, shards: _s, fleets, ...rest } = city;
    const { fleets: rawFleets, ...rawRest } = raw;
    expect(rest).toEqual(rawRest);
    expect(fleets).toEqual((rawFleets as object[]).map((f) => ({ ...f, veterans: emptyTroops() })));
  });

  it("keeps the fleet at sea and the reports: the fleet comes home with its troops", () => {
    const raw = week4() as { fleets: { site: string; phase: string; left: number; troops: object }[]; reports: object[] };
    const city = migrateCity(raw, 4)!;
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
    const city = migrateCity(raw, 4)!;
    expect(city.yard).toEqual(raw.yard);
    expect(city.yard?.kind).toBe("raft");
    expect(city.research).toEqual(raw.research);
    expect(city.queue).toEqual(raw.queue);
    expect(city.wounded).toEqual(raw.wounded);
  });

  it("running it again changes nothing; a city already in shape 5 is read as it is", () => {
    const once = upgradeShape(week4(), 4);
    expect(upgradeShape(once, 4)).toEqual(once);
    const today: PlayerState = { ...newPlayerState(), shards: { sel: 3 }, veterans: { boarders: 10, harpooners: 0, crossbowmen: 0 } };
    expect(migrateCity(json(today), CITY_SHAPE)).toEqual(today);
    // A field already there is never replaced, even when the city says it is older.
    expect(migrateCity(json(today), 4)).toEqual(today);
  });

  it("never adds a field to a fleet that has it", () => {
    const raw = week4() as { fleets: Record<string, unknown>[] };
    raw.fleets[0]!.veterans = { boarders: 2, harpooners: 0, crossbowmen: 0 };
    expect(migrateCity(raw, 4)!.fleets[0]!.veterans).toEqual({ boarders: 2, harpooners: 0, crossbowmen: 0 });
  });
});

describe("cities that cannot be read", () => {
  it("a shape older than 4, newer than 5, or not a whole number", () => {
    for (const shape of [0, 3, 6, 99, 4.5, NaN]) expect(migrateCity(week4(), shape), String(shape)).toBeNull();
  });

  it("a city of shape 4 with a field parseState refuses, once the missing fields are added", () => {
    expect(migrateCity({ ...week4(), pearls: "lots" }, 4)).toBeNull();
    expect(migrateCity({ ...week4(), fleets: "none" }, 4)).toBeNull();
  });

  it("anything but an object", () => {
    for (const raw of [null, [], "city", 4]) expect(migrateCity(raw, 4)).toBeNull();
  });
});
