import { describe, expect, it } from "vitest";
import { dockRaft, newPlayerState, RAFT_SLOTS, type PlayerState } from "@brinelight/shared";
import { raftSheetHtml, yardName } from "../src/city/raftSheet.js";
import { eventText } from "../src/ui/celebrate.js";
import { levelText } from "../src/city/labels.js";
import { LAND_FROM, LAND_TOLD_KEY, landNewsDue, landShown, raftWords } from "../src/city/words.js";
import { memoryStore } from "../src/demo.js";

const rich = (lighthouse: number): PlayerState => {
  const s = newPlayerState();
  return { ...s, buildings: { ...s.buildings, lighthouse }, stock: { oil: 1e6, fish: 1e6, wood: 1e6, rope: 100 } };
};
const slot = RAFT_SLOTS.find((s) => s.ring === 3)!.key;

describe("the rafts' words: land from the Lighthouse 5 with ?blender, rafts before (owner)", () => {
  it("land only with the look made in Blender and the Lighthouse at 5 or more", () => {
    expect(LAND_FROM).toBe(5);
    expect(landShown(4, true)).toBe(false);
    expect(landShown(5, true)).toBe(true);
    expect(landShown(30, false)).toBe(false);
  });

  it("the sheets: a free plot to win, an empty plot, the dike, draining", () => {
    const free = raftSheetHtml(rich(6), slot, 1, true)!;
    expect(free.title).toBe("Free plot");
    expect(free.body).toContain("Win this plot from the sea");
    expect(free.body).toContain("Fill it in");
    expect(free.body).toContain("Plots");
    const r = dockRaft(rich(6), slot);
    if (!r.ok) throw new Error(r.reason);
    expect(yardName(r.state, true)).toBe("Dike works · new plot");
    expect(yardName(r.state, false)).toBe("Shipyard · raft");
    const done = { ...r.state, yard: null, rafts: { [slot]: { hp: 40, building: null, level: 0 } } };
    const empty = raftSheetHtml(done, slot, 1, true)!;
    expect(empty.title).toBe("Plot");
    expect(empty.body).toContain("An empty plot. Put a building on it. You can build each type twice.");
    expect(empty.body).toContain("Dike");
    expect(empty.body).toContain("flooded, half efficiency");
    expect(empty.body).toContain("Drain the flooded plot");
    // The old words before the Lighthouse 5 and with the old look.
    expect(raftSheetHtml(done, slot, 1, false)!.body).toContain("A free raft.");
  });

  it("the celebrations", () => {
    expect(eventText({ kind: "raft", slot }, true)).toBe("New land won from the sea");
    expect(eventText({ kind: "raft", slot })).toBe("A new raft is moored");
    expect(eventText({ kind: "repaired", count: 3 }, true)).toBe("3 plots drained");
    expect(eventText({ kind: "mistMissed", count: 1, rafts: 2 }, true)).toBe("Your Lighthouse went dark in the Mist · 2 plots flooded");
    expect(raftWords(true).mist).toContain("the sea floods your new land");
  });

  it("\"Your rafts are now land\": told once per city, when its rafts show as land and it has some", () => {
    const store = memoryStore();
    expect(landNewsDue(store, "device", 3, false)).toBe(false);
    expect(landNewsDue(store, "device", 0, true)).toBe(false);
    expect(landNewsDue(store, "device", 3, true)).toBe(true);
    expect(landNewsDue(store, "device", 4, true)).toBe(false);
    expect(landNewsDue(store, "account:abc", 1, true)).toBe(true);
    expect(JSON.parse(store.getItem(LAND_TOLD_KEY)!)).toEqual(["device", "account:abc"]);
  });

  it("a building's label at work shows the level being built: \"29 → 30\"", () => {
    expect(levelText(29, true)).toBe("29 → 30");
    expect(levelText(29, false)).toBe("29");
  });
});
