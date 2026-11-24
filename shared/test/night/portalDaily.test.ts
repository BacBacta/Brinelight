import { describe, expect, it } from "vitest";
import { RECRUIT_ODDS } from "../../src/rules/captains.js";
import { CITY_SHAPE, newCity, parseCity, type PortalCity } from "../../src/rules/night/city.js";
import { DAILY_CHESTS, PORTAL_TASKS, RECRUIT_SHARDS, dailyAfterNight, dailyAfterUpgrade, dailyNow, dailyPointsOf, openDailyChest, recruitDaily, recruitDraw } from "../../src/rules/night/daily.js";
import { newNight } from "../../src/rules/night/state.js";

const DAY = 86_400;
const t0 = 20_000 * DAY + 3600;

describe("the portal's daily tasks", () => {
  it("five tasks worth 100 points; chests at 30, 60 and 100", () => {
    expect(PORTAL_TASKS.reduce((p, t) => p + t.points, 0)).toBe(100);
    expect(DAILY_CHESTS.map((c) => c.points)).toEqual([30, 60, 100]);
  });

  it("a Night counts: played, won, the boats burned, the waves held", () => {
    const won = { ...newNight(1, 1), phase: "won" as const, wave: 5, burned: 40 };
    const c = dailyAfterNight(newCity(), won, t0);
    expect(c.daily.counts).toMatchObject({ nights: 1, wins: 1, burned: 40, waves: 5 });
    expect(dailyAfterUpgrade(c, t0).daily.counts.upgrades).toBe(1);
  });

  it("a new day starts them all again, at midnight UTC", () => {
    const c = dailyAfterUpgrade(newCity(), t0);
    expect(dailyNow(c, t0 + 3600).daily.counts.upgrades).toBe(1);
    expect(dailyNow(c, t0 + DAY).daily.counts.upgrades).toBe(0);
  });

  it("a chest opens once its points are reached, once a day", () => {
    let c: PortalCity = newCity();
    expect(openDailyChest(c, t0, 30)).toEqual({ ok: false, reason: "You need 30 points today to open this chest." });
    c = dailyAfterUpgrade(dailyAfterNight(c, { ...newNight(1, 1), phase: "won", wave: 5, burned: 0 }, t0), t0);
    expect(dailyPointsOf(c)).toBe(40);
    const r = openDailyChest(c, t0, 30);
    expect(r.ok && r.city.stock.wood).toBe(c.stock.wood + DAILY_CHESTS[0]!.reward.wood);
    expect(r.ok && openDailyChest(r.city, t0, 30)).toEqual({ ok: false, reason: "You already opened this chest today." });
  });
});

describe("the free daily recruitment", () => {
  it("its rarity from the published odds, read never changed: a roll from the day's seed", () => {
    expect(RECRUIT_ODDS).toEqual({ admiral: 5, commander: 25, officer: 70 });
    const days = Array.from({ length: 2000 }, (_, i) => recruitDraw(i));
    const share = (r: string) => days.filter((d) => d.rarity === r).length / days.length;
    expect(share("admiral")).toBeGreaterThan(0.02);
    expect(share("admiral")).toBeLessThan(0.08);
    expect(share("officer")).toBeGreaterThan(0.64);
    expect(recruitDraw(123)).toEqual(recruitDraw(123));
  });

  it("free, once a day: shards for a captain of the rarity drawn", () => {
    const r = recruitDaily(newCity(), t0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const got = r.city.captains.shards[r.captain];
    expect(got).toBe(RECRUIT_SHARDS[r.rarity]);
    expect(recruitDaily(r.city, t0)).toEqual({ ok: false, reason: "You already recruited today. Come back tomorrow." });
    expect(recruitDaily(r.city, t0 + DAY).ok).toBe(true);
  });

  it("the city keeps its day; one saved before starts it fresh", () => {
    const v5 = { ...newCity(), v: 5 } as Record<string, unknown>;
    delete v5.daily;
    expect(parseCity(v5)).toEqual({ ...newCity(), v: CITY_SHAPE });
  });
});
