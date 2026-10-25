import { describe, expect, it } from "vitest";
import {
  ARRIVALS_BASE,
  ARRIVALS_PER_LEVEL,
  HOUR,
  MORALE_FED,
  MORALE_HUNGRY,
  MORALE_MIST_HELD,
  MORALE_MIST_MISSED,
  RESCUE_CAMP,
  RESCUE_WRECK,
  SEA_SITES,
  advance,
  eventsBetween,
  applyAction,
  arrivalsPerHour,
  moraleAfterHour,
  moraleAfterMist,
  netRates,
  newPlayerState,
  populationHour,
  rescuedBy,
  survivorRoom,
  survivorCap,
  type Fleet,
  type PlayerState,
} from "../src/index.js";

/** A city at a Lighthouse level, its Shelters at a level, with fish or without. */
function city(lighthouse: number, shelters: number, fish = 10_000): PlayerState {
  const s = newPlayerState(0);
  return { ...s, buildings: { ...s.buildings, lighthouse, shelters, fishery: lighthouse }, stock: { ...s.stock, fish } };
}
const hours = (s: PlayerState, n: number) => advance(s, n * HOUR);

describe("the population: the values (owner's decision, 24 October)", () => {
  it("0.1 + 0.02 × the Lighthouse's level survivors an hour, × the morale / 84; a morale of 84 when fed, 40 without fish", () => {
    expect([ARRIVALS_BASE, ARRIVALS_PER_LEVEL, MORALE_FED, MORALE_HUNGRY]).toEqual([0.1, 0.02, 84, 40]);
    expect(arrivalsPerHour(10, 84)).toBeCloseTo(0.3);
    expect(arrivalsPerHour(30, 84)).toBeCloseTo(0.7);
    expect(arrivalsPerHour(10, 42)).toBeCloseTo(0.15);
  });

  it("the morale moves a point an hour toward its target, never past it; +2 for a Mist held, −5 for one not held, between 0 and 100", () => {
    expect([MORALE_MIST_HELD, MORALE_MIST_MISSED]).toEqual([2, 5]);
    expect(moraleAfterHour(84, false)).toBe(83);
    expect(moraleAfterHour(40.5, false)).toBe(40);
    expect(moraleAfterHour(60, true)).toBe(61);
    expect(moraleAfterHour(86, true)).toBe(85);
    expect(moraleAfterMist(84, true)).toBe(86);
    expect(moraleAfterMist(84, false)).toBe(79);
    expect(moraleAfterMist(3, false)).toBe(0);
    expect(moraleAfterMist(99, true)).toBe(100);
  });

  it("the room is the Shelters' only: 6 + 4 a level", () => {
    expect(survivorRoom(city(10, 4).buildings)).toBe(survivorCap(4));
    expect(survivorRoom(city(30, 30).buildings)).toBe(126);
  });
});

describe("an hour of the population", () => {
  it("with fish and room, survivors come: a whole one each time the hour's arrivals add up to one", () => {
    let p = { survivors: 10, morale: 84, coming: 0 };
    for (let h = 0; h < 4; h++) p = populationHour(p, { lighthouse: 10, room: 30, fed: true });
    // 0.3 an hour: one survivor after 4 hours, 0.2 on the way.
    expect(p.survivors).toBe(11);
    expect(p.coming).toBeCloseTo(0.2);
  });

  it("never more than the room; with no room, no one waits on the way", () => {
    let p = { survivors: 29, morale: 84, coming: 0.9 };
    for (let h = 0; h < 10; h++) p = populationHour(p, { lighthouse: 30, room: 30, fed: true });
    expect(p.survivors).toBe(30);
    expect(p.coming).toBe(0);
  });

  it("without fish, no one comes and the morale falls; no one dies or leaves", () => {
    let p = { survivors: 30, morale: 84, coming: 0.5 };
    for (let h = 0; h < 10; h++) p = populationHour(p, { lighthouse: 30, room: 100, fed: false });
    expect(p).toEqual({ survivors: 30, morale: 74, coming: 0.5 });
  });

  it("a fleet home brings 1 survivor from a wreck it salvaged, 2 from a camp it beat; nothing from an empty wreck, an isle or a defeat", () => {
    const wreck = SEA_SITES.find((s) => s.kind === "wreck")!.id;
    const isle = SEA_SITES.find((s) => s.kind === "isle")!.id;
    const camp = SEA_SITES.find((s) => s.kind === "camp")!.id;
    const fleet = (f: Partial<Fleet>) => ({ kind: "collect", site: wreck, cargo: {}, pearls: 0, ...f }) as Fleet;
    expect([RESCUE_WRECK, RESCUE_CAMP]).toEqual([1, 2]);
    expect(rescuedBy(fleet({ cargo: { oil: 40, rope: 1 } }))).toBe(1);
    expect(rescuedBy(fleet({}))).toBe(0);
    expect(rescuedBy(fleet({ site: isle, cargo: { wood: 500 } }))).toBe(0);
    expect(rescuedBy(fleet({ kind: "attack", site: camp, cargo: { oil: 10 }, pearls: 5 }))).toBe(2);
    expect(rescuedBy(fleet({ kind: "attack", site: camp }))).toBe(0);
  });
});

describe("the population in the city", () => {
  it("a new city's 8 survivors fill the Shelters' room (10) and no more; they eat 0.6 fish an hour each", () => {
    const s = newPlayerState(0);
    expect([s.survivors, s.coming]).toEqual([8, 0]);
    const later = hours(s, 48);
    expect(later.survivors).toBe(survivorRoom(s.buildings));
    const eat = (c: PlayerState) => netRates({ ...c, survivors: 0 }).fish - netRates(c).fish;
    expect(eat(later)).toBeCloseTo(later.survivors * 0.6);
  });

  it("is applied on the clock's whole hours: the same city whatever the moments it is computed", () => {
    const s = { ...city(12, 10), clock: 1234 };
    const once = advance(s, 7.5 * HOUR);
    const twice = advance(advance(s, 3.3 * HOUR), 4.2 * HOUR);
    const parts = [0.4, 1.1, 2.0, 0.6, 3.4].reduce((c, h) => advance(c, h * HOUR), s);
    for (const c of [twice, parts]) {
      expect(c.survivors).toBe(once.survivors);
      expect(c.morale).toBeCloseTo(once.morale, 9);
      expect(c.coming).toBeCloseTo(once.coming, 9);
    }
    expect(once.survivors).toBeGreaterThan(s.survivors);
  });

  it("out of fish, no one comes and the morale falls toward 40; when fish comes back, so do the survivors", () => {
    const hungry = { ...city(12, 10, 0), buildings: { ...city(12, 10).buildings, fishery: 0 }, survivors: 20 };
    const after = hours(hungry, 30);
    expect(after.survivors).toBe(20);
    expect(after.stock.fish).toBe(0);
    expect(after.morale).toBeLessThan(MORALE_FED - 20);
    expect(after.morale).toBeGreaterThanOrEqual(MORALE_HUNGRY);
    const fed = hours({ ...after, buildings: { ...after.buildings, fishery: 12 } }, 30);
    expect(fed.survivors).toBeGreaterThan(20);
    expect(fed.morale).toBeGreaterThan(after.morale);
  });

  it("the Mists move the morale: +2 for one held, −5 for one not held", () => {
    // The first Mist of s1 comes at 04:00 and lifts at 06:00.
    const s = { ...city(12, 10), stock: { ...city(12, 10).stock, oil: 10_000 } };
    const held = advance(s, 6 * HOUR + 60);
    const dark = advance({ ...s, mist: { ...s.mist, stoke: false } }, 6 * HOUR + 60);
    expect(held.mist.held).toBe(1);
    expect(dark.mist.missed).toBe(1);
    expect(held.morale - dark.morale).toBe(MORALE_MIST_HELD + MORALE_MIST_MISSED);
  });

  it("a fleet back from a wreck brings a survivor home, when there is room", () => {
    const s = { ...city(12, 10), survivors: 20 };
    const wreck = SEA_SITES.find((x) => x.kind === "wreck")!.id;
    const sent = applyAction(s, { id: "a1", type: "sail", site: wreck });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    const away = hours(sent.state, 12);
    const stayed = hours(s, 12);
    expect(away.fleets).toHaveLength(0);
    expect(away.survivors - stayed.survivors).toBe(RESCUE_WRECK);
  });
});

describe("the survivors who came, told", () => {
  it("one event with how many came; none when no one came", () => {
    const s = newPlayerState(0);
    const later = advance(s, 24 * HOUR);
    expect(eventsBetween(s, later)).toContainEqual({ kind: "survivors", count: later.survivors - s.survivors });
    expect(eventsBetween(later, later).some((e) => e.kind === "survivors")).toBe(false);
  });
});
