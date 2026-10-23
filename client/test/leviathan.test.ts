import { describe, expect, it } from "vitest";
import { COLLECT_STAY, HARVEST_REFILL, HOUR, LEVIATHAN_SITE, WRECK_REFILL, advance, newPlayerState, sail, seaSite, travelTime, type PlayerState } from "@brinelight/shared";
import { fleetLabel } from "../src/city/queue.js";
import { formatTimeLeft } from "../src/city/format.js";
import { harvestText, huntReportHtml, lastFleetText, reportHtml, wreckOilText } from "../src/sea/sheet.js";
import { leviathanText } from "../src/ui/values.js";

/** 18 October 2026, 00:00 UTC: the hunts of that day start at 13:00 and 19:00. */
const MIDNIGHT = 1_792_281_600;
const at = (h: number, m = 0) => MIDNIGHT + h * HOUR + m * 60;
const ok = (r: { ok: true; state: PlayerState } | { ok: false; reason: string }): PlayerState => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
const hunt = (boarders: number) => {
  const s = newPlayerState(at(13));
  return advance(ok(sail({ ...s, troops: { boarders, harpooners: 0, crossbowmen: 0 } }, LEVIATHAN_SITE)), 2 * HOUR);
};

describe("the Leviathan on the sea map", () => {
  it("its label: when it rises, how long its hunt has left, and when it rises again once it dived for you", () => {
    expect(leviathanText(newPlayerState(at(10, 30)))).toBe("Leviathan in 2 h 30");
    expect(leviathanText(newPlayerState(at(13, 50)))).toBe("Leviathan · 1 h 10 left");
    expect(leviathanText(newPlayerState(at(15)))).toBe("Leviathan in 4 h 00");
    expect(leviathanText(newPlayerState(at(21, 15)))).toBe("Leviathan in 15 h 45");
    // Killed at 14:00: it is gone for you until 19:00.
    const killed = { ...newPlayerState(at(14)), leviathan: { level: 2, hunt: at(13), damage: 4000, over: true } };
    expect(leviathanText(killed)).toBe("Leviathan in 5 h 00");
  });
});

describe("the hunt's report", () => {
  it("dived: your damage and share, the Pearls, the captain's experience; no shards and no troop lost", () => {
    const r = hunt(100).reports[0]!;
    const html = huntReportHtml(r);
    expect(html).toContain("It dived · Leviathan level 1");
    expect(html).toContain(`${r.hunt!.damage} of 4,000 (4 %)`);
    expect(html).toContain(`+${r.loot!.pearls}`);
    expect(html).toContain("Old Tom · +30 XP");
    expect(html).not.toContain("<span>Shards</span>");
    expect(html).toContain("your fleet brings every troop home");
  });

  it("killed: 100 Pearls and 3 shards for the captain who led", () => {
    const r = hunt(5000).reports[0]!;
    const html = huntReportHtml(r);
    expect(html).toContain("Killed · Leviathan level 1");
    expect(html).toContain("4,000 of 4,000 (100 %)");
    expect(html).toContain("<span>Pearls</span><span>+100</span>");
    expect(html).toContain("+3 for Old Tom");
    expect(html).toContain("It comes back one level stronger.");
    // A camp's report stays a combat report.
    expect(reportHtml(r)).toContain("Victory");
  });
});

describe("your last free fleet", () => {
  it("the Leviathan's sheet warns when the fleet you would send is your last free one, with how long the wrecks wait", () => {
    // Harbor 0: one fleet, so it is the last one.
    const s = newPlayerState(at(13));
    expect(s.buildings.harbor).toBe(0);
    expect(lastFleetText(s, 2 * HOUR)).toBe("This is your last free fleet: your wrecks will wait 2 h 00.");
    expect(lastFleetText(s, 2 * HOUR + 10 * 60)).toBe("This is your last free fleet: your wrecks will wait 2 h 10.");
    // Harbor 1: two fleets. With none at sea, one is left for the wrecks; with one at sea, the other is the last.
    const two = { ...s, buildings: { ...s.buildings, harbor: 1 } };
    expect(lastFleetText(two, 2 * HOUR)).toBe("");
    // A fleet sent to a wreck at 09:00, out of the Mist (at 13:00 the Mist hides the wrecks).
    const out = { ...two, fleets: ok(sail({ ...two, clock: at(9) }, "wreck-1")).fleets };
    expect(lastFleetText(out, 2 * HOUR)).toContain("This is your last free fleet");
  });
});

describe("an emptied wreck", () => {
  it("its sheet says when it fills again", () => {
    const s = newPlayerState(at(9));
    expect(wreckOilText(s, "wreck-1", 1)).toBe("240");
    const t = travelTime(seaSite("wreck-1")!, s.techs, { id: "tom", rarity: "officer", level: 1 });
    const emptied = advance(ok(sail(s, "wreck-1")), t + COLLECT_STAY);
    expect(emptied.world.wrecks["wreck-1"]).toBe(0);
    expect(wreckOilText(emptied, "wreck-1", 1)).toBe("Empty · fills again in 2 h 00");
    expect(wreckOilText(advance(emptied, 30 * 60), "wreck-1", 1)).toBe("Empty · fills again in 1 h 30");
    expect(wreckOilText(advance(emptied, WRECK_REFILL), "wreck-1", 1)).toBe("240");
  });
});

describe("an isle and a shoal", () => {
  it("full until a fleet harvests them; once emptied, the sheet says when they fill again", () => {
    // Lighthouse 2: an isle of 600 holds 660, more than a fleet's hold brings back at once.
    const s = newPlayerState(at(9));
    expect(harvestText(s, "isle-1", 1)).toBe("660");
    let t = s;
    while ((t.world.harvest["isle-1"] ?? 660) > 0) {
      const out = travelTime(seaSite("isle-1")!, t.techs, t.lead ? { id: t.lead, rarity: "officer", level: 1 } : null);
      t = advance(ok(sail(t, "isle-1")), 2 * out + COLLECT_STAY);
      expect(harvestText(t, "isle-1", 1)).not.toBe("660");
    }
    expect(harvestText(t, "isle-1", 1)).toBe(`Bare · grows back in ${formatTimeLeft(t.world.refill["isle-1"]!)}`);
    expect(harvestText(advance(t, HARVEST_REFILL), "isle-1", 1)).toBe("660");
    const shoal = { ...s, world: { ...s.world, harvest: { "fish-1": 0 }, refill: { "fish-1": HOUR } } };
    expect(harvestText(shoal, "fish-1", 1)).toBe("Empty · the fish come back in 1 h 00");
  });

  it("a fleet on its way home says what it brings back", () => {
    const s = newPlayerState(at(9));
    const sent = ok(sail(s, "isle-1"));
    expect(fleetLabel(sent.fleets[0]!)).toBe("Fleet · Wooded Isle");
    const back = { ...sent.fleets[0]!, phase: "back" as const, cargo: { wood: 300 } };
    expect(fleetLabel(back)).toBe("Fleet · home · 300 wood");
    expect(fleetLabel({ ...back, cargo: { oil: 240, rope: 2 } })).toBe("Fleet · home · 240 oil");
    expect(fleetLabel({ ...back, cargo: {} })).toBe("Fleet · home");
  });
});
