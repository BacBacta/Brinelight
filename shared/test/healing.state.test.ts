import { describe, expect, it } from "vitest";
import {
  DAY,
  HEAL_COST,
  HOSPITAL_BEDS,
  TIME_SCALE,
  advance,
  applyAction,
  emptyTroops,
  heal,
  healCost,
  healTime,
  hospitalCapacity,
  newPlayerState,
  parseAction,
  parseState,
  sail,
  totalTroops,
  woundedSaved,
  type PlayerState,
  type Troops,
} from "../src/index.js";

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const ID = "3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e4f";
const hurt = (boarders: number, harpooners: number, crossbowmen: number): Troops => ({ boarders, harpooners, crossbowmen });

/** A city with its Infirmary built, wounded in its beds, and enough fish to heal them. */
const withWounded = (wounded = hurt(10, 6, 4), infirmary = 1): PlayerState => {
  const s = newPlayerState();
  return { ...s, buildings: { ...s.buildings, infirmary }, wounded, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 } };
};
const healing = (s: PlayerState): PlayerState => {
  const r = heal(s);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
/** A fleet sent with all the troops to a camp, followed minute by minute until it is home: its losses saved lie in the Infirmary. */
const afterBattle = (s: PlayerState): PlayerState => {
  const r = sail(s, "camp-1");
  if (!r.ok) throw new Error(r.reason);
  let t = r.state;
  for (let i = 0; i < 8 * 60 && t.fleets.length > 0; i++) t = advance(t, 60); // 8 hours at most
  if (t.fleets.length > 0) throw new Error("the fleet never came back");
  return t;
};

describe("the balance values, from the prototype", () => {
  it("2 fish per wounded, (n × 0.12 + 2) prototype seconds; beds and saved share unchanged", () => {
    expect(HEAL_COST).toEqual({ fish: 2 });
    expect(healCost(60)).toEqual({ fish: 120 });
    expect(healTime(10)).toBeCloseTo(3.2 * TIME_SCALE, 9);
    expect([10, 30, 60, 300].map((n) => Math.round(healTime(n)))).toEqual([1152, 2016, 3312, 13680]);
    expect(HOSPITAL_BEDS).toBe(60);
    expect([0, 1, 3].map(woundedSaved)).toEqual([0.5, 0.6, 0.8]);
  });
});

describe("healing at the Infirmary", () => {
  it("heals every wounded at once, paid at once: they leave the beds", () => {
    const s = withWounded();
    const r = heal(s);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.healing).toEqual({ wounded: hurt(10, 6, 4), left: healTime(20), duration: healTime(20) });
    expect(r.state.wounded).toEqual(emptyTroops());
    expect(r.state.stock.fish).toBe(s.stock.fish - 40);
    expect(r.state.stock.wood).toBe(s.stock.wood);
    expect(r.state.troops).toEqual(s.troops);
  });

  it("is refused in this order: no Infirmary, no wounded, a healing already underway, not enough fish", () => {
    const none = { ...withWounded(), buildings: newPlayerState().buildings };
    expect(heal(none)).toEqual({ ok: false, reason: "Build the Infirmary first" });
    expect(heal({ ...none, wounded: emptyTroops() })).toEqual({ ok: false, reason: "Build the Infirmary first" });
    expect(heal(withWounded(emptyTroops()))).toEqual({ ok: false, reason: "No wounded to heal" });
    const busy = { ...healing(withWounded()), wounded: hurt(1, 0, 0) };
    expect(heal(busy)).toEqual({ ok: false, reason: "Healing is already underway" });
    expect(heal({ ...busy, wounded: emptyTroops() })).toEqual({ ok: false, reason: "No wounded to heal" });
    const poor = { ...withWounded(), stock: { oil: 5000, fish: 39, wood: 5000, rope: 3 } };
    expect(heal(poor)).toEqual({ ok: false, reason: "Not enough resources" });
    expect(heal({ ...poor, stock: { ...poor.stock, fish: 40 } }).ok).toBe(true);
  });

  it("ends as an event of advance: the healed soldiers join the troops in the city", () => {
    const s = healing(withWounded());
    const d = healTime(20);
    expect(advance(s, d - 1).healing?.left).toBeCloseTo(1, 9);
    expect(advance(s, d - 1).troops).toEqual(s.troops);
    const done = advance(s, d);
    expect(done.troops).toEqual({ boarders: s.troops.boarders + 10, harpooners: s.troops.harpooners + 6, crossbowmen: s.troops.crossbowmen + 4 });
    expect(done.healing).toBeNull();
    expect(done.wounded).toEqual(emptyTroops());
  });

  it("the soldiers come back at the exact moment, in one step or in a thousand, during a long time away", () => {
    const s = healing(withWounded(hurt(40, 10, 10)));
    const away = 2 * DAY;
    const once = advance(s, away);
    let many = s;
    for (let i = 0; i < 1000; i++) many = advance(many, away / 1000);
    expect(many.troops).toEqual(once.troops);
    expect(many.stock.fish).toBeCloseTo(once.stock.fish, 6);
    expect(totalTroops(once.troops)).toBe(totalTroops(s.troops) + 60);
  });

  it("a fleet at sea never gets the healed soldiers: they wait in the city", () => {
    const s = withWounded();
    const away = sail(s, "camp-1");
    if (!away.ok) throw new Error(away.reason);
    const h = healing(away.state);
    const without = advance({ ...h, healing: null }, healTime(20));
    const done = advance(h, healTime(20));
    expect(done.fleets).toEqual(without.fleets);
    expect(done.troops).toEqual({ boarders: without.troops.boarders + 10, harpooners: without.troops.harpooners + 6, crossbowmen: without.troops.crossbowmen + 4 });
  });

  it("from battle to ranks: losses saved in the Infirmary are healed and fight again", () => {
    const back = afterBattle(withWounded(emptyTroops()));
    const saved = totalTroops(back.wounded);
    expect(saved).toBeGreaterThan(0);
    expect(back.fleets).toEqual([]);
    const done = advance(healing(back), healTime(saved));
    expect(totalTroops(done.troops)).toBe(totalTroops(back.troops) + saved);
    expect(done.wounded).toEqual(emptyTroops());
  });

  it("during a healing, new wounded take the free beds: only the wounded not being healed count", () => {
    // The Infirmary's 300 beds are full, then emptied by the healing: the next battle can save its wounded again.
    const full = withWounded(hurt(150, 100, 50), 5);
    expect(totalTroops(afterBattle(full).wounded)).toBe(hospitalCapacity(5));
    const h = healing(full);
    const back = afterBattle(h);
    expect(back.healing).not.toBeNull();
    expect(totalTroops(back.wounded)).toBeGreaterThan(0);
    // Those new wounded are not part of the healing under way: they stay in their beds when it ends.
    const done = advance(back, back.healing!.left);
    expect(done.wounded).toEqual(back.wounded);
    expect(done.healing).toBeNull();
  });

  it("an action: applyAction gives the same city as the rule; parseAction takes no field", () => {
    const s = withWounded();
    expect(applyAction(s, { id: ID, type: "heal" })).toEqual(heal(s));
    expect(parseAction({ id: ID, type: "heal" })).toEqual({ id: ID, type: "heal" });
    for (const extra of [{ count: 500 }, { wounded: hurt(1, 1, 1) }, { troop: "boarders" }]) expect(parseAction({ id: ID, type: "heal", ...extra })).toBeNull();
  });
});

describe("parseState: the healing in progress", () => {
  const city = healing(withWounded());
  const job = city.healing!;

  it("reads none, or a healing in progress", () => {
    expect(parseState(json(newPlayerState()))?.healing).toBeNull();
    expect(parseState(json(city))).toEqual(city);
  });

  it("brings the time left back within its duration, as for the build queue", () => {
    expect(parseState(json({ ...city, healing: { ...job, left: job.duration * 3 } }))?.healing?.left).toBe(job.duration);
    expect(parseState(json({ ...city, healing: { ...job, left: -5 } }))?.healing?.left).toBe(0);
  });

  const bad: [string, unknown][] = [
    ["a city without the field", (({ healing: _h, ...rest }) => rest)(city)],
    ["no wounded", { ...city, healing: { ...job, wounded: emptyTroops() } }],
    ["part of a wounded", { ...city, healing: { ...job, wounded: hurt(1.5, 0, 0) } }],
    ["negative wounded", { ...city, healing: { ...job, wounded: hurt(-1, 5, 0) } }],
    ["a troop type missing", { ...city, healing: { ...job, wounded: { boarders: 3, harpooners: 1 } } }],
    ["an unknown troop type", { ...city, healing: { ...job, wounded: { ...job.wounded, archers: 2 } } }],
    ["more wounded than the Infirmary's beds", { ...city, healing: { ...job, wounded: hurt(61, 0, 0) } }],
    ["a healing without an Infirmary", { ...city, buildings: newPlayerState().buildings }],
    ["a duration of 0", { ...city, healing: { ...job, duration: 0 } }],
    ["an extra field", { ...city, healing: { ...job, kind: "heal" } }],
    ["a list", { ...city, healing: [job] }],
  ];
  for (const [name, c] of bad) {
    it(`refuses ${name}`, () => {
      expect(parseState(json(c))).toBeNull();
    });
  }
});
