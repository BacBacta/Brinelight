import { describe, expect, it } from "vitest";
import {
  CAPTAINS,
  CAPTAIN_MAX_LEVEL,
  CAPTAIN_MAX_STARS,
  DAY,
  FRAGMENTS_PER_STAR,
  LOGBOOK,
  SEA_SITES,
  XP_DEFEAT,
  XP_WIN_BASE,
  XP_WIN_PER_LEVEL,
  addStar,
  advance,
  applyAction,
  combatXp,
  logbook,
  newPlayerState,
  parseAction,
  parseState,
  pirateLoot,
  power,
  sail,
  setLead,
  skillFactor,
  unlockCaptain,
  xpNeeded,
  type CaptainId,
  type PlayerState,
} from "../src/index.js";

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const ID = "3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e4f";
const ok = (r: { ok: true; state: PlayerState } | { ok: false; reason: string }): PlayerState => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
/** A strong army, sure to win at camp-1 at its starting level. */
const strong = (): PlayerState => ({ ...newPlayerState(), troops: { boarders: 200, harpooners: 200, crossbowmen: 200 } });
/** A weak army, sure to lose. */
const weak = (): PlayerState => ({ ...newPlayerState(), troops: { boarders: 3, harpooners: 1, crossbowmen: 1 } });
const fought = (s: PlayerState, site = "camp-1") => advance(ok(sail(s, site)), DAY);

describe("the balance values, from the prototype", () => {
  it("experience, levels, skill, Logbook, shards and stars", () => {
    expect([XP_WIN_BASE, XP_WIN_PER_LEVEL, XP_DEFEAT]).toEqual([20, 10, 10]);
    expect(combatXp(true, 1)).toBe(30);
    expect(combatXp(true, 4)).toBe(60);
    expect(combatXp(false, 4)).toBe(10);
    expect([1, 2, 19].map(xpNeeded)).toEqual([80, 160, 1520]);
    expect(CAPTAIN_MAX_LEVEL).toBe(20);
    expect(skillFactor(1)).toBe(1);
    expect(skillFactor(6)).toBeCloseTo(1.2, 9);
    expect(LOGBOOK).toEqual({ pearls: 50, xp: 40 });
    expect(FRAGMENTS_PER_STAR).toBe(10);
    expect(CAPTAIN_MAX_STARS).toBe(5);
    expect(pirateLoot(3).fragments).toBe(3);
  });

  it("each pirate camp gives the shards of one fixed captain, the rarer the stronger the camp", () => {
    const camps = SEA_SITES.filter((s) => s.kind === "camp").map((s) => [s.id, s.level, s.captain]);
    expect(camps).toEqual([
      ["camp-1", 1, "sel"],
      ["camp-2", 2, "tom"],
      ["camp-3", 3, "bran"],
      ["camp-4", 4, "isa"],
      ["camp-5", 5, "mira"],
      ["camp-6", 6, "nera"],
    ]);
    expect(new Set(camps.map((c) => c[2])).size).toBe(Object.keys(CAPTAINS).length);
  });
});

describe("experience and shards in combat", () => {
  it("a victory: 20 + 10 × the camp's level to the captain who sailed, the camp's level in shards to its captain", () => {
    const back = fought(strong());
    const r = back.reports[0]!;
    expect(r.win).toBe(true);
    expect(r.captainXp).toEqual({ id: "tom", xp: 30, levels: 0 });
    expect(back.captains.tom).toEqual({ level: 1, xp: 30, stars: 1 });
    expect(r.shards).toEqual({ id: "sel", count: 1 });
    expect(back.shards).toEqual({ sel: 1 });
    // The camp went up a level: the next victory there gives more of both.
    const again = fought(back);
    expect(again.reports[1]!.captainXp).toEqual({ id: "tom", xp: 40, levels: 0 });
    expect(again.shards).toEqual({ sel: 3 });
  });

  it("a defeat: 10 experience, and no shard", () => {
    const back = fought(weak());
    const r = back.reports[0]!;
    expect(r.win).toBe(false);
    expect(r.captainXp).toEqual({ id: "tom", xp: 10, levels: 0 });
    expect(r.shards).toBeUndefined();
    expect(back.shards).toEqual({});
  });

  it("experience goes to the captain who sailed, even if another one leads now; the fleet keeps the level it left with", () => {
    const s: PlayerState = { ...strong(), captains: { tom: { level: 1, xp: 70, stars: 1 }, sel: { level: 4, xp: 0, stars: 1 } } };
    const away = ok(sail(s, "camp-1"));
    expect(away.fleets[0]!.lead).toEqual({ id: "tom", rarity: "officer", level: 1 });
    const switched = ok(setLead(away, "sel"));
    const back = advance(switched, DAY);
    // 70 + 30: Old Tom reaches level 2 with 20 left over; Sel gains nothing.
    expect(back.captains.tom).toEqual({ level: 2, xp: 20, stars: 1 });
    expect(back.captains.sel).toEqual({ level: 4, xp: 0, stars: 1 });
    expect(back.reports[0]!.captainXp).toEqual({ id: "tom", xp: 30, levels: 1 });
    expect(back.lead).toBe("sel");
  });

  it("a fleet with no captain gives experience to no one; the camp's shards still come", () => {
    const back = fought({ ...strong(), lead: null });
    expect(back.reports[0]!.captainXp).toBeUndefined();
    expect(back.captains).toEqual(newPlayerState().captains);
    expect(back.shards).toEqual({ sel: 1 });
  });

  it("shards come for a captain you do not own, and keep coming beyond 5 stars", () => {
    const max: PlayerState = { ...strong(), captains: { ...strong().captains, tom: { level: 1, xp: 0, stars: CAPTAIN_MAX_STARS } } };
    expect(fought(max, "camp-2").shards).toEqual({ tom: 2 });
  });
});

describe("the lead captain", () => {
  it("any captain you own can lead; one you do not own is refused", () => {
    const s: PlayerState = { ...newPlayerState(), captains: { ...newPlayerState().captains, mira: { level: 2, xp: 0, stars: 1 } } };
    expect(ok(setLead(s, "mira")).lead).toBe("mira");
    expect(setLead(s, "nera")).toEqual({ ok: false, reason: "Recruit this captain first" });
    // The one already leading: nothing changes.
    expect(setLead(s, "tom")).toEqual({ ok: true, state: s });
  });
});

describe("the Logbook", () => {
  it("+40 XP to the lead captain for 50 Pearls, with its level-ups", () => {
    const s: PlayerState = { ...newPlayerState(), captains: { tom: { level: 1, xp: 60, stars: 1 } } };
    const t = ok(logbook(s));
    expect(t.pearls).toBe(s.pearls - 50);
    expect(t.captains.tom).toEqual({ level: 2, xp: 20, stars: 1 });
  });

  it("is refused in this order: no lead captain, the lead at max level, not enough Pearls", () => {
    const broke = { ...newPlayerState(), pearls: 49 };
    expect(logbook({ ...broke, lead: null })).toEqual({ ok: false, reason: "Choose a lead captain first" });
    expect(logbook({ ...broke, captains: { tom: { level: CAPTAIN_MAX_LEVEL, xp: 0, stars: 1 } } })).toEqual({ ok: false, reason: "Your lead captain is at max level" });
    expect(logbook(broke)).toEqual({ ok: false, reason: "Not enough Pearls" });
    expect(logbook({ ...broke, pearls: 50 }).ok).toBe(true);
  });
});

describe("shards: unlocking a captain, adding a star", () => {
  const withShards = (shards: Partial<Record<CaptainId, number>>, captains = newPlayerState().captains): PlayerState => ({ ...newPlayerState(), shards, captains });

  it("10 shards unlock a captain at level 1, with 1 star; the rest stays", () => {
    const t = ok(unlockCaptain(withShards({ sel: 13 }), "sel"));
    expect(t.captains.sel).toEqual({ level: 1, xp: 0, stars: 1 });
    expect(t.shards).toEqual({ sel: 3 });
    expect(unlockCaptain(withShards({ sel: 9 }), "sel")).toEqual({ ok: false, reason: "You need 10 shards" });
    expect(unlockCaptain(withShards({ tom: 40 }), "tom")).toEqual({ ok: false, reason: "You already have this captain" });
  });

  it("10 shards add a star, up to 5; refused in this order: not owned, max stars, not enough shards", () => {
    const t = ok(addStar(withShards({ tom: 10 }), "tom"));
    expect(t.captains.tom).toEqual({ level: 1, xp: 0, stars: 2 });
    expect(t.shards).toEqual({ tom: 0 });
    expect(addStar(withShards({}), "sel")).toEqual({ ok: false, reason: "Recruit this captain first" });
    expect(addStar(withShards({}, { tom: { level: 1, xp: 0, stars: 5 } }), "tom")).toEqual({ ok: false, reason: "Max stars" });
    expect(addStar(withShards({ tom: 9 }), "tom")).toEqual({ ok: false, reason: "You need 10 shards" });
  });

  it("a star counts in your Power, as in the prototype", () => {
    const p = (s: PlayerState) => power({ ...s, captains: Object.entries(s.captains).map(([id, c]) => ({ rarity: CAPTAINS[id as CaptainId].rarity, ...c! })) });
    const s = withShards({ tom: 10 });
    expect(p(ok(addStar(s, "tom"))) - p(s)).toBe(150);
  });
});

describe("the captain actions", () => {
  it("applyAction gives the same city as the rule; parseAction reads a known captain only, and never a number", () => {
    const s: PlayerState = { ...newPlayerState(), shards: { sel: 10, tom: 10 } };
    expect(applyAction(s, { id: ID, type: "setLead", captain: "tom" })).toEqual(setLead(s, "tom"));
    expect(applyAction(s, { id: ID, type: "logbook" })).toEqual(logbook(s));
    expect(applyAction(s, { id: ID, type: "unlockCaptain", captain: "sel" })).toEqual(unlockCaptain(s, "sel"));
    expect(applyAction(s, { id: ID, type: "addStar", captain: "tom" })).toEqual(addStar(s, "tom"));
    for (const type of ["setLead", "unlockCaptain", "addStar"]) {
      expect(parseAction({ id: ID, type, captain: "mira" })).toEqual({ id: ID, type, captain: "mira" });
      for (const captain of ["blackbeard", "toString", "__proto__", "", 1, null]) expect(parseAction({ id: ID, type, captain }), `${type} ${String(captain)}`).toBeNull();
      expect(parseAction({ id: ID, type })).toBeNull();
      expect(parseAction({ id: ID, type, captain: "sel", shards: 10 })).toBeNull();
    }
    expect(parseAction({ id: ID, type: "logbook" })).toEqual({ id: ID, type: "logbook" });
    expect(parseAction({ id: ID, type: "logbook", xp: 400 })).toBeNull();
    expect(parseAction({ id: ID, type: "logbook", captain: "tom" })).toBeNull();
  });
});

describe("parseState: captains, shards and reports", () => {
  const back = fought(strong());

  it("reads shards, and reports with or without the captain's experience and shards", () => {
    expect(parseState(json(back))).toEqual(back);
    const { captainXp: _x, shards: _s, ...old } = back.reports[0]!;
    expect(parseState(json({ ...back, reports: [old] }))?.reports).toEqual([old]);
  });

  const s = newPlayerState();
  const bad: [string, unknown][] = [
    ["a city without shards", (({ shards: _s, ...rest }) => rest)(s)],
    ["shards of an unknown captain", { ...s, shards: { blackbeard: 3 } }],
    ["shards inherited from Object", { ...s, shards: { toString: 3 } }],
    ["shards in decimals", { ...s, shards: { sel: 2.5 } }],
    ["shards below 0", { ...s, shards: { sel: -1 } }],
    ["a captain above 5 stars", { ...s, captains: { tom: { level: 1, xp: 0, stars: 6 } } }],
    ["a captain with more experience than its level holds", { ...s, captains: { tom: { level: 2, xp: 160, stars: 1 } } }],
    ["a lead captain you do not own", { ...s, lead: "mira" }],
    ["a report's experience for an unknown captain", { ...back, reports: [{ ...back.reports[0]!, captainXp: { id: "blackbeard", xp: 30, levels: 0 } }] }],
    ["a report's experience in decimals", { ...back, reports: [{ ...back.reports[0]!, captainXp: { id: "tom", xp: 30.5, levels: 0 } }] }],
    ["a report with no shard in its shards", { ...back, reports: [{ ...back.reports[0]!, shards: { id: "sel", count: 0 } }] }],
  ];
  for (const [name, city] of bad) {
    it(`refuses ${name}`, () => {
      expect(parseState(json(city))).toBeNull();
    });
  }

  it("a captain at the highest level may hold any experience", () => {
    expect(parseState(json({ ...s, captains: { tom: { level: CAPTAIN_MAX_LEVEL, xp: 5000, stars: 1 } } }))).not.toBeNull();
  });
});
