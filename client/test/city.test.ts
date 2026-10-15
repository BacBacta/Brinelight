import { BUILDING_IDS } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { formatDuration, formatTimeLeft } from "../src/city/format.js";
import { PLOTS, buildingModel, hasTower } from "../src/city/plots.js";
import { progress, suggestedUpgrades } from "../src/city/suggest.js";
import { newPlayerState, upgrade } from "../src/state/state.js";

describe("plots and models (prototype values)", () => {
  it("every building has its own plot", () => {
    const keys = BUILDING_IDS.map((id) => PLOTS[id].join(","));
    expect(new Set(keys).size).toBe(9);
    expect(PLOTS.lighthouse).toEqual([0, 0]);
    expect(PLOTS.refinery).toEqual([1, -1]);
  });

  it("models from phare.glb, blue look", () => {
    expect(buildingModel("refinery", 1)).toBe("building_blacksmith_blue");
    expect(buildingModel("shelters", 3)).toBe("building_home_A_blue");
    expect(buildingModel("shelters", 4)).toBe("building_home_B_blue");
  });

  it("a small tower from level 5, never on the Observatory", () => {
    expect(hasTower("refinery", 4)).toBe(false);
    expect(hasTower("refinery", 5)).toBe(true);
    expect(hasTower("observatory", 9)).toBe(false);
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
