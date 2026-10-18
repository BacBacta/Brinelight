import { describe, expect, it } from "vitest";
import {
  HOUR,
  HUNT_DURATION,
  HUNT_SHARDS,
  HUNT_XP,
  LEVIATHAN_SITE,
  advance,
  applyAction,
  distance,
  emptyTroops,
  fleetCheck,
  huntAt,
  huntAttack,
  huntPearls,
  huntShare,
  leadOf,
  leviathanHealth,
  newPlayerState,
  parseAction,
  parseState,
  sail,
  seaSite,
  strengths,
  travelTime,
  type PlayerState,
} from "../src/index.js";

/** 18 October 2026, 00:00 UTC: the hunts of that day start at 13:00 and 19:00. */
const MIDNIGHT = 1_792_281_600;
const at = (h: number, m = 0) => MIDNIGHT + h * HOUR + m * 60;
const ID = "00000000-0000-4000-8000-000000000003";
const ok = (r: { ok: true; state: PlayerState } | { ok: false; reason: string }): PlayerState => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
const SITE = seaSite(LEVIATHAN_SITE)!;
/** A city at `clock` with `boarders` soldiers, its lead captain Old Tom at level 1, and no Infirmary. */
const city = (clock: number, boarders = 100): PlayerState => {
  const s = newPlayerState(clock);
  return { ...s, troops: { boarders, harpooners: 0, crossbowmen: 0 } };
};
const trip = (s: PlayerState) => travelTime(SITE, s.techs, leadOf(s.lead, s.captains));
const reportOf = (s: PlayerState) => s.reports.at(-1)!;

describe("the Leviathan's calendar", () => {
  it("rises at 13:00 and 19:00 UTC for 2 hours, the same for every city", () => {
    expect(huntAt(at(12, 59))).toEqual({ on: false, start: at(13), end: at(15) });
    expect(huntAt(at(13))).toEqual({ on: true, start: at(13), end: at(15) });
    expect(huntAt(at(14, 59))).toEqual({ on: true, start: at(13), end: at(15) });
    expect(huntAt(at(15))).toEqual({ on: false, start: at(19), end: at(21) });
    expect(huntAt(at(20, 30))).toEqual({ on: true, start: at(19), end: at(21) });
    expect(huntAt(at(21))).toEqual({ on: false, start: at(24 + 13), end: at(24 + 15) });
    expect(HUNT_DURATION).toBe(2 * HOUR);
  });

  it("rises by the Great Lighthouse, 17 map units from your city", () => {
    expect(SITE.kind).toBe("leviathan");
    expect(distance(SITE)).toBeCloseTo(17, 0);
    expect(Math.hypot(SITE.x, SITE.z)).toBeLessThan(7);
  });
});

describe("the Leviathan's health, damage and rewards", () => {
  it("4,000 at level 1, then ×1.5 a level", () => {
    expect([1, 2, 3, 4].map(leviathanHealth)).toEqual([4000, 6000, 9000, 13500]);
  });

  it("a fleet deals its attack, as against a camp, every hour on site: no troop of the triangle to counter", () => {
    const fleet = { troops: { boarders: 100, harpooners: 0, crossbowmen: 0 }, veterans: emptyTroops(), lead: null, techs: {}, watchtowers: 0 };
    expect(huntAttack(fleet)).toBe(100);
    // A veteran counts as 1.8 soldiers, Blades +6 % a level, a Watchtower +5 % a level.
    expect(huntAttack({ ...fleet, veterans: { boarders: 10, harpooners: 0, crossbowmen: 0 } })).toBeCloseTo(118);
    expect(huntAttack({ ...fleet, techs: { blades: 2 }, watchtowers: 1 })).toBeCloseTo(100 * 1.12 * 1.05);
    // The lead captain's bonus, exactly as against a camp with no troop to counter.
    const lead = leadOf("bran", { bran: { level: 10 } });
    expect(huntAttack({ ...fleet, lead })).toBeCloseTo(strengths({ troops: fleet.troops, enemy: emptyTroops(), captain: { cls: "boarders", rarity: lead!.rarity, level: 10 } }).attack);
  });

  it("10 + 90 × your share of its health in Pearls; the share never above 1", () => {
    expect(huntPearls(0)).toBe(10);
    expect(huntPearls(0.5)).toBe(55);
    expect(huntPearls(1)).toBe(100);
    expect(huntShare(1000, 1)).toBe(0.25);
    expect(huntShare(99_999, 1)).toBe(1);
    expect(huntPearls(huntShare(1000, 2))).toBe(25);
  });
});

describe("sending a fleet to the Leviathan", () => {
  it("refuses: not at sea, already dived, too late to get there, fewer than 5 troops, every fleet at sea", () => {
    expect(fleetCheck(city(at(12)), LEVIATHAN_SITE)).toEqual({ ok: false, reason: "The Leviathan is not at sea. Wait for it to rise." });
    const killed = { ...city(at(14)), leviathan: { level: 2, hunt: at(13), damage: 4000, over: true } };
    expect(fleetCheck(killed, LEVIATHAN_SITE)).toEqual({ ok: false, reason: "The Leviathan has dived. Wait for it to rise again." });
    const late = city(at(15) - trip(city(0)));
    expect(fleetCheck(late, LEVIATHAN_SITE)).toEqual({ ok: false, reason: "Your fleet would get there after the Leviathan dives" });
    expect(fleetCheck(city(at(15) - trip(city(0)) - 1), LEVIATHAN_SITE)).toEqual({ ok: true });
    expect(fleetCheck(city(at(13), 4), LEVIATHAN_SITE)).toEqual({ ok: false, reason: "You do not have enough troops" });
    const busy = { ...city(at(13)), fleets: ok(sail(city(at(10)), "wreck-1")).fleets };
    expect(fleetCheck(busy, LEVIATHAN_SITE)).toEqual({ ok: false, reason: "Build the Harbor to send more fleets" });
  });

  it("the Mist never hides it: at 13:00 the Mist of 12:00 is on, with the Lighthouse dark", () => {
    const s = { ...city(at(13)), mist: { stoke: false, dark: true, held: 0, missed: 0, damaged: 0 } };
    expect(fleetCheck(s, "camp-1").ok).toBe(false);
    expect(fleetCheck(s, LEVIATHAN_SITE)).toEqual({ ok: true });
  });

  it("all your troops and veterans sail, as for a camp", () => {
    const s = { ...city(at(13)), veterans: { boarders: 0, harpooners: 4, crossbowmen: 0 } };
    const sent = ok(sail(s, LEVIATHAN_SITE));
    expect(sent.troops).toEqual(emptyTroops());
    expect(sent.veterans).toEqual(emptyTroops());
    expect(sent.fleets).toHaveLength(1);
    expect(sent.fleets[0]).toMatchObject({ site: LEVIATHAN_SITE, kind: "hunt", phase: "out", troops: s.troops, veterans: s.veterans });
  });
});

describe("a hunt", () => {
  it("not killed: damage for the time on site, Pearls by your share, experience for the captain, every troop home", () => {
    const s = city(at(13));
    const t = trip(s);
    const sent = ok(sail(s, LEVIATHAN_SITE));
    const attack = huntAttack(sent.fleets[0]!);
    // At sea until 15:00: no reward yet.
    const during = advance(sent, 2 * HOUR - 1);
    expect(during.reports).toHaveLength(0);
    expect(during.leviathan.damage).toBeCloseTo((attack * (2 * HOUR - 1 - t)) / HOUR);
    // 15:00: the Leviathan dives.
    const dived = advance(sent, 2 * HOUR);
    const damage = (attack * (2 * HOUR - t)) / HOUR;
    expect(damage).toBeLessThan(4000);
    expect(dived.leviathan).toEqual({ level: 1, hunt: at(13), damage: expect.closeTo(damage, 6), over: true });
    const pearls = huntPearls(damage / 4000);
    expect(dived.pearls - during.pearls).toBe(pearls);
    expect(reportOf(dived)).toMatchObject({
      site: LEVIATHAN_SITE,
      level: 1,
      win: false,
      defense: 4000,
      sent: s.troops,
      losses: emptyTroops(),
      wounded: emptyTroops(),
      loot: { oil: 0, wood: 0, pearls, rope: 0 },
      captainXp: { id: "tom", xp: HUNT_XP, levels: 0 },
      hunt: { health: 4000 },
    });
    expect(reportOf(dived).shards).toBeUndefined();
    expect(dived.captains.tom!.xp).toBe(s.captains.tom!.xp + HUNT_XP);
    // The fleet sails home with every troop.
    expect(dived.fleets[0]).toMatchObject({ phase: "back", left: t });
    const home = advance(dived, t);
    expect(home.fleets).toHaveLength(0);
    expect(home.troops).toEqual(s.troops);
    // Once dived, no other fleet for this hunt; the next one at 19:00.
    expect(fleetCheck(home, LEVIATHAN_SITE).ok).toBe(false);
  });

  it("killed: 100 Pearls, 3 shards of the captain who led, its level up, the fleet home at once", () => {
    const s = city(at(13), 5000);
    const t = trip(s);
    const sent = ok(sail(s, LEVIATHAN_SITE));
    // 5,000 an hour: 4,000 health takes 48 minutes on site.
    const kill = t + (4000 / 5000) * HOUR;
    const before = advance(sent, kill - 1);
    expect(before.leviathan.over).toBe(false);
    const killed = advance(sent, kill + 1);
    expect(killed.leviathan).toEqual({ level: 2, hunt: at(13), damage: 4000, over: true });
    expect(killed.pearls - before.pearls).toBe(100);
    expect(killed.shards.tom).toBe((s.shards.tom ?? 0) + HUNT_SHARDS);
    expect(reportOf(killed)).toMatchObject({ win: true, shards: { id: "tom", count: HUNT_SHARDS }, hunt: { damage: 4000, health: 4000, share: 1 } });
    expect(killed.fleets[0]).toMatchObject({ phase: "back" });
    expect(killed.fleets[0]!.left).toBeCloseTo(t - 1);
    expect(fleetCheck({ ...killed, troops: { boarders: 50, harpooners: 0, crossbowmen: 0 }, fleets: [] }, LEVIATHAN_SITE)).toEqual({
      ok: false,
      reason: "The Leviathan has dived. Wait for it to rise again.",
    });
    // The next hunt: level 2, 6,000 health.
    const next = advance(killed, at(19) - at(13) - kill);
    expect(next.leviathan.level).toBe(2);
    const again = advance(ok(sail(next, LEVIATHAN_SITE)), HUNT_DURATION);
    expect(reportOf(again)).toMatchObject({ level: 2, defense: 6000 });
    expect(again.leviathan).toMatchObject({ level: 3, hunt: at(19) });
  });

  it("a fleet sent in the middle of the hunt deals damage only for the time it is there", () => {
    const s = city(at(14));
    const t = trip(s);
    const done = advance(ok(sail(s, LEVIATHAN_SITE)), HOUR);
    expect(done.leviathan.damage).toBeCloseTo((100 * (HOUR - t)) / HOUR);
    expect(reportOf(done).hunt!.damage).toBe(Math.round((100 * (HOUR - t)) / HOUR));
  });

  it("a city that did not take part gets nothing, and its Leviathan stays as it was", () => {
    const s = city(at(12));
    const after = advance(s, 4 * HOUR);
    expect(after.reports).toHaveLength(0);
    expect(after.leviathan).toEqual(s.leviathan);
  });

  it("one long advance equals many short ones", () => {
    for (const boarders of [100, 5000]) {
      const sent = ok(sail(city(at(13), boarders), LEVIATHAN_SITE));
      const once = advance(sent, 3 * HOUR);
      let many = sent;
      for (let i = 0; i < 180; i++) many = advance(many, 60);
      expect(many.leviathan.level).toBe(once.leviathan.level);
      expect(many.leviathan.damage).toBeCloseTo(once.leviathan.damage, 6);
      expect(many.pearls).toBe(once.pearls);
      expect(many.troops).toEqual(once.troops);
      expect(many.reports).toEqual(once.reports);
    }
  });
});

describe("the Leviathan in the city", () => {
  it("a new city: level 1, never hunted", () => {
    expect(newPlayerState().leviathan).toEqual({ level: 1, hunt: 0, damage: 0, over: false });
  });

  it("parseState keeps a fleet at the Leviathan and a hunt's report, and refuses a bad Leviathan", () => {
    const sent = ok(sail(city(at(13)), LEVIATHAN_SITE));
    const json = (x: unknown) => JSON.parse(JSON.stringify(x));
    expect(parseState(json(advance(sent, HOUR)))).toEqual(advance(sent, HOUR));
    const dived = advance(sent, 2 * HOUR);
    expect(parseState(json(dived))).toEqual(dived);
    for (const leviathan of [{ level: 0, hunt: 0, damage: 0, over: false }, { level: 1, hunt: -1, damage: 0, over: false }, { level: 1, hunt: 0, damage: -1, over: false }, { level: 1, hunt: 0, damage: 0 }, { level: 1, hunt: 0, damage: 0, over: false, pearls: 9 }]) {
      expect(parseState({ ...json(dived), leviathan }), JSON.stringify(leviathan)).toBeNull();
    }
    const report = json(dived).reports[0];
    expect(parseState({ ...json(dived), reports: [{ ...report, hunt: { ...report.hunt, share: 2 } }] })).toBeNull();
    expect(parseState({ ...json(dived), reports: [{ ...report, hunt: { ...report.hunt, pearls: 500 } }] })).toBeNull();
  });

  it("the action is `sail` to the Leviathan: the site only, never a damage or a reward", () => {
    expect(parseAction({ id: ID, type: "sail", site: LEVIATHAN_SITE })).toEqual({ id: ID, type: "sail", site: LEVIATHAN_SITE });
    expect(parseAction({ id: ID, type: "sail", site: LEVIATHAN_SITE, damage: 4000 })).toBeNull();
    expect(applyAction(city(at(13)), { id: ID, type: "sail", site: LEVIATHAN_SITE })).toEqual(sail(city(at(13)), LEVIATHAN_SITE));
  });
});
