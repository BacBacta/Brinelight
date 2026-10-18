import { describe, expect, it } from "vitest";
import { HOUR, LEVIATHAN_SITE, advance, newPlayerState, sail, type PlayerState } from "@brinelight/shared";
import { huntReportHtml, reportHtml } from "../src/sea/sheet.js";
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
