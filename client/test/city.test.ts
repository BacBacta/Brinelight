import { BUILDING_IDS } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { formatDuration, formatTimeLeft } from "../src/city/format.js";
import { ERA_PLOTS } from "../src/city/plots.js";
import { buildBadge } from "../src/city/queue.js";
import { progress, suggestedUpgrades } from "../src/city/suggest.js";
import { newPlayerState, upgrade } from "@brinelight/shared";

describe("plots", () => {
  it("every building has its own plot, the Lighthouse in the middle", () => {
    const keys = BUILDING_IDS.map((id) => ERA_PLOTS[id].join(","));
    expect(new Set(keys).size).toBe(9);
    expect(ERA_PLOTS.lighthouse).toEqual([0, 0]);
  });
});

describe("suggested upgrades", () => {
  it("are the 2 cheapest you can start", () => {
    expect(suggestedUpgrades(newPlayerState())).toEqual(["lumberyard", "fishery"]);
  });

  it("are none when both builders are busy", () => {
    let s = newPlayerState();
    for (const id of ["lumberyard", "fishery"] as const) {
      const r = upgrade(s, id);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    expect(suggestedUpgrades(s)).toEqual([]);
  });
});

describe("formats", () => {
  it("time left as in the prototype", () => {
    expect(formatTimeLeft(45)).toBe("0:45");
    expect(formatTimeLeft(3240)).toBe("54:00");
    expect(formatTimeLeft(7800)).toBe("2 h 10");
  });

  it("durations on a sheet", () => {
    expect(formatDuration(3240)).toBe("54 min");
    expect(formatDuration(7800)).toBe("2 h 10 min");
  });

  it("from 48 hours on, in days and hours (owner, on the demo's Refinery 29 to 30: 46020 h)", () => {
    expect(formatTimeLeft(47 * 3600 + 59 * 60)).toBe("47 h 59");
    expect(formatTimeLeft(48 * 3600)).toBe("2 d 00 h");
    expect(formatTimeLeft(3 * 86400 + 4 * 3600 + 30 * 60)).toBe("3 d 04 h");
    expect(formatTimeLeft(46020 * 3600 + 15 * 60)).toBe("1917 d 12 h");
    expect(formatDuration(47 * 3600 + 59 * 60)).toBe("47 h 59 min");
    expect(formatDuration(43.4 * 86400)).toBe("43 d 09 h");
  });

  it("a duration sped up by DEV_SPEED (60) is shown in seconds", () => {
    expect(formatDuration(3240 / 60)).toBe("54 s");
    expect(formatDuration(7800 / 60)).toBe("2 min");
  });

  it("progress stays between 0 and 1", () => {
    expect(progress({ left: 3240, duration: 3240 })).toBe(0);
    expect(progress({ left: 1620, duration: 3240 })).toBe(0.5);
    expect(progress({ left: -5, duration: 3240 })).toBe(1);
  });
});

describe("builders' badge at sea", () => {
  it("is hidden when nothing is being built", () => {
    expect(buildBadge(newPlayerState())).toBeNull();
  });

  it("counts the upgrades in progress", () => {
    let s = newPlayerState();
    const one = upgrade(s, "fishery");
    if (!one.ok) throw new Error(one.reason);
    s = one.state;
    expect(buildBadge(s)).toEqual({ count: 1, label: "1 upgrade in progress. Back to the city" });
    const two = upgrade(s, "lumberyard");
    if (!two.ok) throw new Error(two.reason);
    expect(buildBadge(two.state)?.count).toBe(2);
    expect(buildBadge(two.state)?.label).toBe("2 upgrades in progress. Back to the city");
  });
});
