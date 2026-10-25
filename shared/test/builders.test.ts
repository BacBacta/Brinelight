import { describe, expect, it } from "vitest";
import {
  BUILDERS,
  BUILDERS_BUSY,
  BUILDER_AT,
  HOUR,
  YARD_BUSY,
  advance,
  applyAction,
  builders,
  canUpgrade,
  eventsBetween,
  newPlayerState,
  parseState,
  STARTING_BUILDINGS,
  type PlayerState,
  type UpgradeJob,
} from "../src/index.js";

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const rich = { oil: 1e9, fish: 1e9, wood: 1e9, rope: 0 };
const job = (id: UpgradeJob["id"]): UpgradeJob => ({ id, left: 10 * HOUR, duration: 10 * HOUR });
/** A city at the Lighthouse 20, with plenty of everything and this many survivors. */
const city = (survivors: number, queue: UpgradeJob[] = []): PlayerState => {
  const s = newPlayerState(0);
  const buildings = { ...s.buildings, lighthouse: 20, shelters: 20, refinery: 10, fishery: 10, lumberyard: 10, barracks: 10, harbor: 10 };
  return { ...s, buildings, stock: rich, survivors, queue };
};

describe("the builders: two, a third at 100 survivors, a fourth at 250 (owner's decision, 25 October)", () => {
  it("the values", () => {
    expect(BUILDERS).toBe(2);
    expect(BUILDER_AT).toEqual([100, 250]);
    expect([0, 8, 99, 100, 249, 250, 786].map(builders)).toEqual([2, 2, 2, 3, 3, 4, 4]);
  });

  it("one sentence when they are all busy, the shipyard's: \"Your builders are busy.\"", () => {
    expect(BUILDERS_BUSY).toBe("Your builders are busy.");
    expect(YARD_BUSY).toBe(BUILDERS_BUSY);
    const ctx = (survivors: number, queue: UpgradeJob["id"][]) => ({ buildings: { ...STARTING_BUILDINGS, lighthouse: 20 }, stock: rich, pearls: 0, survivors, queue });
    expect(canUpgrade("barracks", ctx(99, ["refinery", "fishery"]))).toEqual({ ok: false, reason: BUILDERS_BUSY });
    expect(canUpgrade("barracks", ctx(100, ["refinery", "fishery"]))).toEqual({ ok: true });
    expect(canUpgrade("barracks", ctx(100, ["refinery", "fishery", "lumberyard"]))).toEqual({ ok: false, reason: BUILDERS_BUSY });
    expect(canUpgrade("barracks", ctx(250, ["refinery", "fishery", "lumberyard"]))).toEqual({ ok: true });
    expect(canUpgrade("barracks", ctx(786, ["refinery", "fishery", "lumberyard", "harbor"]))).toEqual({ ok: false, reason: BUILDERS_BUSY });
  });

  it("a city with 100 survivors starts a third upgrade, never a fourth", () => {
    const s = city(100, [job("refinery"), job("fishery")]);
    const r = applyAction(s, { id: "a", type: "upgrade", building: "lumberyard" });
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.queue.map((j) => j.id)).toEqual(["refinery", "fishery", "lumberyard"]);
    expect(applyAction(r.state, { id: "b", type: "upgrade", building: "barracks" })).toEqual({ ok: false, reason: BUILDERS_BUSY });
  });

  it("a builder who came never goes: the survivors never leave", () => {
    // The survivors only grow (rules/population.ts); a city without fish keeps them all, and its builders.
    const s = { ...city(250), stock: { ...rich, fish: 0 } };
    const later = advance(s, 48 * HOUR);
    expect(later.survivors).toBeGreaterThanOrEqual(250);
    expect(builders(later.survivors)).toBe(4);
  });

  it("is told when a builder joins: the number of builders now", () => {
    const before = city(99);
    expect(eventsBetween(before, { ...before, survivors: 100 })).toContainEqual({ kind: "builder", count: 3 });
    expect(eventsBetween(before, { ...before, survivors: 251 })).toEqual(expect.arrayContaining([{ kind: "builder", count: 4 }]));
    expect(eventsBetween(city(100), city(101)).some((e) => e.kind === "builder")).toBe(false);
  });
});

describe("a city's queue, read back", () => {
  it("keeps as many jobs as the city's builders, the first ones", () => {
    const four = [job("refinery"), job("fishery"), job("lumberyard"), job("barracks")];
    const room = (s: PlayerState) => ({ ...s, buildings: { ...s.buildings, shelters: 30 } });
    const read = (survivors: number) => parseState(json(room(city(survivors, four))))?.queue.map((j) => j.id);
    expect(read(99)).toEqual(["refinery", "fishery"]);
    expect(read(100)).toEqual(["refinery", "fishery", "lumberyard"]);
    expect(read(120)).toEqual(["refinery", "fishery", "lumberyard"]);
  });
});
