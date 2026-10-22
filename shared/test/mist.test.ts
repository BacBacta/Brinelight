import { describe, expect, it } from "vitest";
import {
  HOUR,
  MIST_DURATION,
  MIST_HELD_PEARLS,
  MIST_RAFT_DAMAGE,
  MIST_WARNING,
  RAFT_MIN_HP,
  advance,
  applyAction,
  distance,
  lightReach,
  mistAt,
  mistWarned,
  netRates,
  newPlayerState,
  parseAction,
  parseState,
  raftEffect,
  sail,
  seaSite,
  stoke,
  untilMistChange,
  type PlayerState,
} from "../src/index.js";

/** 18 October 2026, 00:00 UTC: the Mists of that day start at 04:00, 12:00 and 20:00. */
const MIDNIGHT = 1_792_281_600;
const at = (h: number, m = 0, sec = 0) => MIDNIGHT + h * HOUR + m * 60 + sec;
const ID = "00000000-0000-4000-8000-000000000001";
const ok = (r: { ok: true; state: PlayerState } | { ok: false; reason: string }): PlayerState => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
/** A city whose clock is `clock`, with the order to stoke on or off. */
const city = (clock: number, stoked = true): PlayerState => {
  const s = newPlayerState(clock);
  return { ...s, mist: { ...s.mist, stoke: stoked } };
};

describe("the Mist's calendar (fixed UTC hours, provisional)", () => {
  it("three Mists a day, 2 hours each, at 04:00, 12:00 and 20:00 UTC", () => {
    expect(MIST_DURATION).toBe(2 * HOUR);
    for (const h of [4, 12, 20]) {
      expect(mistAt(at(h) - 1, "s1").on, `${h}:00 minus 1 s`).toBe(false);
      expect(mistAt(at(h), "s1")).toEqual({ on: true, start: at(h), end: at(h + 2) });
      expect(mistAt(at(h + 2) - 1, "s1").on).toBe(true);
      expect(mistAt(at(h + 2), "s1").on, `${h + 2}:00`).toBe(false);
    }
  });

  it("the next Mist: later today, or tomorrow at 04:00", () => {
    expect(mistAt(at(0), "s1")).toEqual({ on: false, start: at(4), end: at(6) });
    expect(mistAt(at(7), "s1")).toEqual({ on: false, start: at(12), end: at(14) });
    expect(mistAt(at(22), "s1")).toEqual({ on: false, start: at(28), end: at(30) });
    expect(untilMistChange(at(22), "s1")).toBe(6 * HOUR);
    expect(untilMistChange(at(21, 30), "s1")).toBe(30 * 60);
  });

  it("the city is warned one hour before, until the Mist starts", () => {
    expect(MIST_WARNING).toBe(HOUR);
    expect(mistWarned(at(3) - 1, "s1")).toBe(false);
    expect(mistWarned(at(3), "s1")).toBe(true);
    expect(mistWarned(at(4) - 1, "s1")).toBe(true);
    expect(mistWarned(at(4), "s1")).toBe(false);
  });
});

describe("what the Mist hides, and what pushes it back", () => {
  it("the light reaches 15 + 2 a Lighthouse level, 10 more when stoked", () => {
    expect(lightReach(2, false)).toBe(19);
    expect(lightReach(2, true)).toBe(29);
    expect(lightReach(10, false)).toBe(35);
    expect(lightReach(15, false)).toBe(45);
  });

  it("in the Mist, a fleet only sails within the light; the reason says what to do", () => {
    // camp-5 is 21.7 from your city, wreck-8 15.2, wreck-1 31.1.
    expect(distance(seaSite("camp-5")!)).toBeCloseTo(21.7, 1);
    const lit = city(at(4, 30));
    expect(sail(lit, "camp-5").ok).toBe(true);
    expect(sail(lit, "wreck-1")).toEqual({ ok: false, reason: "The Mist hides this place. Wait for it to lift." });
    const dark = city(at(4, 30), false);
    expect(sail(dark, "wreck-8").ok).toBe(true);
    expect(sail(dark, "camp-5")).toEqual({ ok: false, reason: "The Mist hides this place. Stoke the Lighthouse or wait for it to lift." });
    // In calm weather, the whole sea.
    expect(sail(city(at(7), false), "wreck-1").ok).toBe(true);
  });

  it("a fleet already at sea carries on through the Mist", () => {
    const s = ok(sail(city(at(3, 50), false), "wreck-1"));
    const later = advance(s, 6 * HOUR);
    expect(later.fleets).toEqual([]);
    expect(later.stock.oil).toBeGreaterThan(advance({ ...s, fleets: [] }, 6 * HOUR).stock.oil);
  });
});

describe("in the Mist", () => {
  it("stoked: production stays full, the Lighthouse burns 1.5 times its oil; not stoked: production −30 %", () => {
    const lit = advance(city(at(4)), MIST_DURATION);
    const dark = advance(city(at(4), false), MIST_DURATION);
    const s = city(at(4));
    const full = netRates(s, { mist: true, stoked: true });
    const cut = netRates(s, { mist: true, stoked: false });
    for (const k of ["oil", "fish", "wood"] as const) {
      expect(lit.stock[k], k).toBeCloseTo(s.stock[k] + full[k] * 2);
      expect(dark.stock[k], k).toBeCloseTo(s.stock[k] + cut[k] * 2);
    }
    expect(cut.wood).toBeCloseTo(netRates(s).wood * 0.7);
  });

  it("held to its end: +30 Pearls, the rafts untouched", () => {
    const s = { ...city(at(3)), rafts: { "3,0": { hp: 100, building: "greenhouse" as const, level: 1 } } };
    const after = advance(s, 4 * HOUR);
    expect(after.mist).toMatchObject({ held: 1, missed: 0, dark: false });
    expect(after.pearls).toBe(s.pearls + MIST_HELD_PEARLS);
    expect(after.rafts["3,0"]!.hp).toBe(100);
  });

  it("not held: each raft loses 35, never below 25, and is never stopped", () => {
    const rafts = { "3,0": { hp: 100, building: "greenhouse" as const, level: 2 }, "0,3": { hp: 50, building: null, level: 0 }, "-3,0": { hp: 25, building: null, level: 0 } };
    const s = { ...city(at(3), false), rafts };
    const after = advance(s, 4 * HOUR);
    expect(after.mist).toMatchObject({ held: 0, missed: 1, damaged: 2, dark: false });
    expect(after.pearls).toBe(s.pearls);
    expect(after.rafts["3,0"]!.hp).toBe(100 - MIST_RAFT_DAMAGE);
    expect(after.rafts["0,3"]!.hp).toBe(RAFT_MIN_HP);
    expect(after.rafts["-3,0"]!.hp).toBe(RAFT_MIN_HP);
    // Four Mists later the raft is at its floor, and its building still runs, at half.
    const worn = advance(after, 32 * HOUR);
    expect(worn.rafts["3,0"]!.hp).toBe(RAFT_MIN_HP);
    expect(raftEffect(worn.rafts, "greenhouse")).toBe(1);
  });

  it("out of oil in the middle: the Lighthouse goes dark from that moment, and the Mist is not held", () => {
    const s0 = city(at(4));
    // At Lighthouse 6 with one Refinery, a stoked Lighthouse burns more oil than it makes: 11.5 an hour, so 10 oil last 52 minutes.
    const s = { ...s0, buildings: { ...s0.buildings, lighthouse: 6 }, stock: { ...s0.stock, oil: 10 } };
    const burn = -netRates(s, { mist: true, stoked: true }).oil;
    expect(burn).toBeGreaterThan(0);
    const empty = (10 / burn) * HOUR;
    const before = advance(s, empty - 1);
    expect(before.mist.dark).toBe(false);
    const after = advance(s, empty + 1);
    expect(after.mist.dark).toBe(true);
    // From then on the city works at 70 %, and the Mist ends not held.
    const end = advance(s, MIST_DURATION);
    const lit = netRates(s, { mist: true, stoked: true }).wood;
    const cut = netRates(s, { mist: true, stoked: false }).wood;
    expect(end.stock.wood).toBeCloseTo(s.stock.wood + (lit * empty + cut * (MIST_DURATION - empty)) / HOUR);
    expect(advance(s, MIST_DURATION + 1).mist).toMatchObject({ held: 0, missed: 1, dark: false });
  });

  it("a Mist that starts with no oil: dark from its start", () => {
    const s0 = city(at(3, 59));
    // No Refinery: the oil stays at 0.
    const s = { ...s0, buildings: { ...s0.buildings, refinery: 0 }, stock: { ...s0.stock, oil: 0 } };
    expect(advance(s, 59).mist.dark).toBe(false);
    expect(advance(s, 61).mist.dark).toBe(true);
  });
});

describe("the order to stoke", () => {
  it("is on for a new city, and stays until you change it", () => {
    expect(newPlayerState().mist.stoke).toBe(true);
    const off = ok(stoke(city(at(7)), false));
    expect(off.mist.stoke).toBe(false);
    expect(advance(off, 24 * HOUR).mist.stoke).toBe(false);
  });

  it("taken back during a Mist: dark until it lifts; given again, it waits for the next one", () => {
    const off = ok(stoke(city(at(4, 30)), false));
    expect(off.mist.dark).toBe(true);
    const on = ok(stoke(off, true));
    expect(on.mist).toMatchObject({ stoke: true, dark: true });
    // 04:00 not held; 12:00 held, the order on again.
    const next = advance(on, 10 * HOUR);
    expect(next.mist).toMatchObject({ held: 1, missed: 1, dark: false });
  });

  it("given outside a Mist, changes nothing until one comes", () => {
    const s = city(at(7), false);
    expect(ok(stoke(s, true)).mist).toEqual({ ...s.mist, stoke: true });
    expect(ok(stoke(s, false))).toBe(s);
  });

  it("an action that carries a boolean, and nothing else", () => {
    expect(parseAction({ id: ID, type: "stoke", on: false })).toEqual({ id: ID, type: "stoke", on: false });
    for (const on of ["true", 1, null, undefined]) expect(parseAction({ id: ID, type: "stoke", on }), String(on)).toBeNull();
    expect(parseAction({ id: ID, type: "stoke", on: true, oil: 500 })).toBeNull();
    expect(applyAction(city(at(4, 30)), { id: ID, type: "stoke", on: false })).toEqual(stoke(city(at(4, 30)), false));
  });
});

describe("the clock", () => {
  it("advance moves it on, and one long advance equals many short ones, across several Mists", () => {
    const s = { ...city(at(2)), rafts: { "3,0": { hp: 100, building: "greenhouse" as const, level: 1 } } };
    const long = advance(s, 30 * HOUR);
    expect(long.clock).toBe(at(32));
    let short = ok(stoke(s, false));
    short = advance(short, 7 * HOUR);
    short = ok(stoke(short, true));
    let step: PlayerState = s;
    for (let i = 0; i < 30 * 12; i++) step = advance(step, 300);
    expect(step.clock).toBe(long.clock);
    expect(step.mist).toEqual(long.mist);
    expect(step.pearls).toBe(long.pearls);
    for (const k of ["oil", "fish", "wood"] as const) expect(step.stock[k], k).toBeCloseTo(long.stock[k], 6);
    expect(long.mist).toMatchObject({ held: 4, missed: 0 });
    // The order taken back for the Mist of 04:00 (a Mist not held), then given again.
    expect(advance(short, 23 * HOUR).mist).toMatchObject({ held: 3, missed: 1 });
  });

  it("lands exactly on a Mist's start and end, even from a clock with fractions of a second", () => {
    const s = city(at(4) - 0.3);
    const a = advance(s, 0.3);
    expect(a.clock).toBe(at(4));
    expect(mistAt(a.clock, "s1").on).toBe(true);
    const b = advance(city(at(5, 59, 59.7)), 0.5);
    expect(b.clock).toBeCloseTo(at(6) + 0.2, 6);
    expect(b.mist.held).toBe(1);
  });

  it("parseState refuses a city without a clock, with a clock below 0, or with a Mist it does not know", () => {
    const s = JSON.parse(JSON.stringify(city(at(7))));
    expect(parseState(s)).toEqual(city(at(7)));
    expect(parseState({ ...s, clock: undefined })).toBeNull();
    expect(parseState({ ...s, clock: -1 })).toBeNull();
    expect(parseState({ ...s, clock: "now" })).toBeNull();
    expect(parseState({ ...s, mist: { ...s.mist, stoke: 1 } })).toBeNull();
    expect(parseState({ ...s, mist: { ...s.mist, held: 1.5 } })).toBeNull();
    expect(parseState({ ...s, mist: { ...s.mist, pearls: 30 } })).toBeNull();
  });
});
