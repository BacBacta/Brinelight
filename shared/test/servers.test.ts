import { describe, expect, it } from "vitest";
import { DAY, DEFAULT_SERVER, HOUR, MIST_DURATION, SERVERS, calendarOf, dailyWindow, dayOf, huntAt, isServerId, mistAt, newPlayerState, untilReset } from "../src/index.js";

/** 18 October 2026, 00:00 UTC. */
const MIDNIGHT = 1_792_281_600;
const at = (h: number, m = 0) => MIDNIGHT + h * HOUR + m * 60;

describe("the servers' calendars", () => {
  it("s1 keeps the hours of week 7: the Mist at 04:00, 12:00 and 20:00, the Leviathan at 13:00 and 19:00, the reset at 00:00 UTC", () => {
    expect(SERVERS.s1).toEqual({ mistHours: [4, 12, 20], huntHours: [13, 19], resetHour: 0 });
    expect(DEFAULT_SERVER).toBe("s1");
    expect(newPlayerState(at(9)).server).toBe("s1");
  });

  it("on s1, three Mists a day of 2 hours each, as before: the same number, the same length", () => {
    let mists = 0;
    let misty = 0;
    for (let t = at(0); t < at(24); t += 60) {
      const w = mistAt(t, "s1");
      if (w.on) misty += 60;
      if (w.on && w.start === t) mists++;
    }
    expect(mists).toBe(3);
    expect(misty).toBe(3 * MIST_DURATION);
  });

  it("each server's Mists and hunts come from its own hours", () => {
    for (const id of Object.keys(SERVERS) as (keyof typeof SERVERS)[]) {
      const cal = calendarOf(id);
      for (const h of cal.mistHours) expect(mistAt(at(h), id)).toMatchObject({ on: true, start: at(h) });
      for (const h of cal.huntHours) expect(huntAt(at(h), id)).toMatchObject({ on: true, start: at(h) });
    }
    // Another calendar, other windows: the same rule, other hours.
    expect(dailyWindow(at(12), [5, 17], 2 * HOUR)).toEqual({ on: false, start: at(17), end: at(19) });
    expect(dailyWindow(at(12), SERVERS.s1.mistHours, MIST_DURATION)).toEqual({ on: true, start: at(12), end: at(14) });
  });

  it("the day of the daily tasks starts at the server's reset hour: 00:00 UTC on s1", () => {
    expect(dayOf(at(23, 59), "s1")).toBe(dayOf(at(0), "s1"));
    expect(dayOf(at(24), "s1")).toBe(dayOf(at(0), "s1") + 1);
    expect(untilReset(at(23), "s1")).toBe(HOUR);
    expect(untilReset(at(0), "s1")).toBe(DAY);
  });

  it("only a known server is one: never a name from the object's prototype", () => {
    expect(isServerId("s1")).toBe(true);
    for (const v of ["s2", "", "toString", "__proto__", 1, null, undefined]) expect(isServerId(v), String(v)).toBe(false);
  });
});
