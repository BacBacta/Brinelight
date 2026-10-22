import { describe, expect, it } from "vitest";
import { HOUR, newPlayerState, startingDaily, type PlayerState } from "@brinelight/shared";
import { dailyHtml, dailyStatus, questHtml, rewardHtml } from "../src/ui/daily.js";

/** 18 October 2026, 09:00 UTC. */
const NINE = 1_792_281_600 + 9 * HOUR;
const city = (): PlayerState => newPlayerState(NINE);

describe("the current objective", () => {
  it("its number, what to do and its reward; Claim only once the rules say it is done", () => {
    const s = city();
    const html = questHtml(s);
    expect(html).toContain("1/18");
    expect(html).toContain("Upgrade the Refinery to level 2");
    expect(html).toContain(">150</span>");
    expect(html).not.toContain("Claim");
    expect(questHtml({ ...s, buildings: { ...s.buildings, refinery: 2 } })).toContain('data-act="claimObjective">Claim</button>');
    expect(questHtml({ ...s, objective: 17 })).toContain("18/18");
    expect(questHtml({ ...s, objective: 18 })).toBe("");
  });

  it("a reward: an icon and an amount per resource, Pearls last", () => {
    const html = rewardHtml({ pearls: 300, oil: 400, rope: 2 });
    expect(html.indexOf("oil")).toBeLessThan(html.indexOf("cord"));
    expect(html.indexOf("cord")).toBeLessThan(html.indexOf("pearl"));
    expect(html).toContain(">300</span>");
    // What your lead captain gets, in words, after the resources.
    const lead = rewardHtml({ pearls: 200, shards: 1 });
    expect(lead).toContain("<span>+1 shard of your lead captain</span>");
    expect(lead.indexOf("pearl")).toBeLessThan(lead.indexOf("shard"));
    expect(rewardHtml({ xp: 40 })).toBe('<div class="cost"><span>+40 XP for your lead captain</span></div>');
  });
});

describe("the daily tasks", () => {
  const busy = (chests: (20 | 40 | 60 | 80 | 100)[] = []): PlayerState => ({
    ...city(),
    daily: { ...startingDaily(NINE, "s1"), counts: { upgrades: 3, gathers: 1, camps: 2, trains: 0, mists: 1, research: 0 }, chests },
  });

  it("the points, the five chests, the tasks with their progress", () => {
    const html = dailyHtml(busy());
    expect(html).toContain("70 / 100");
    expect(html).toContain("00:00 UTC");
    expect((html.match(/data-act="chest"/g) ?? []).length).toBe(5);
    expect(html).toContain('class="ch can" data-act="chest" data-chest="60"');
    // A chest you cannot open yet is grey but never disabled: tapped, it says why.
    expect(html).toContain('class="ch" data-act="chest" data-chest="80" aria-label="Chest 80, needs 80 points: tap to see why it is closed"');
    expect(html).not.toContain("aria-disabled");
    expect(html).toContain('aria-label="Open chest 60"');
    expect(html).toContain("Start 3 upgrades</b><small>3 / 3 · 30 points");
    expect(html).toContain("Gather at sea 3 times</b><small>1 / 3 · 20 points");
    // The next chest's reward: 1 rope; once it is opened, 40 XP for your lead captain.
    expect(html).toContain("Chest 20:</span>");
    expect(dailyHtml(busy([20]))).toContain("Chest 40:</span><div class=\"cost\"><span>+40 XP for your lead captain</span>");
  });

  it("a chest opened shows a check; the Tasks button shows the points and a dot while a chest waits", () => {
    expect(dailyHtml(busy([20, 40, 60]))).toContain('class="ch got" data-act="chest" data-chest="20"');
    expect(dailyStatus(busy())).toEqual({ points: 70, chest: true });
    expect(dailyStatus(busy([20, 40, 60]))).toEqual({ points: 70, chest: false });
    // After midnight UTC, yesterday's points are gone.
    expect(dailyStatus({ ...busy(), clock: NINE + 15 * HOUR })).toEqual({ points: 0, chest: false });
  });
});
