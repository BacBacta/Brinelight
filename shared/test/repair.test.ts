import { describe, expect, it } from "vitest";
import {
  HOUR,
  MIST_RAFT_DAMAGE,
  RAFT_MAX_HP,
  RAFT_MIN_HP,
  RAFT_SLOTS,
  REPAIR_OIL,
  advance,
  applyAction,
  canRepair,
  canUpgradeRaft,
  damagedRafts,
  eventsBetween,
  newPlayerState,
  parseAction,
  parseState,
  raftEffect,
  repairCost,
  repairRafts,
  repairTime,
  stoke,
  type PlayerState,
  type Rafts,
} from "../src/index.js";

const ID = "00000000-0000-4000-8000-000000000002";
const [A, B, C] = RAFT_SLOTS.filter((s) => s.ring === 3).map((s) => s.key) as [string, string, string];
const ok = (r: { ok: true; state: PlayerState } | { ok: false; reason: string }): PlayerState => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
/** A city at Lighthouse 10 with three rafts: one sound, one after a Mist not held, one after three. */
const worn = (): PlayerState => {
  const s = newPlayerState();
  const rafts: Rafts = {
    [A]: { hp: RAFT_MAX_HP, building: "greenhouse", level: 2 },
    [B]: { hp: RAFT_MAX_HP - MIST_RAFT_DAMAGE, building: "watchtower", level: 1 },
    [C]: { hp: RAFT_MIN_HP, building: "greenhouse", level: 1 },
  };
  return { ...s, buildings: { ...s.buildings, lighthouse: 10 }, rafts, stock: { oil: 20_000, fish: 5000, wood: 5000, rope: 10 } };
};

describe("repairing the rafts", () => {
  it("costs 2 oil per missing point, whatever the Lighthouse's level, and no wood; every damaged raft at once", () => {
    expect(REPAIR_OIL).toBe(2);
    // 35 + 75 = 110 points missing.
    expect(damagedRafts(worn().rafts)).toEqual([B, C].sort((x, y) => RAFT_SLOTS.findIndex((s) => s.key === x) - RAFT_SLOTS.findIndex((s) => s.key === y)));
    expect(repairCost(worn().rafts)).toEqual({ oil: 220 });
    // One Mist not held on one raft: 70 oil, at Lighthouse 10 as at Lighthouse 30.
    expect(repairCost({ [A]: { hp: 65, building: null, level: 0 } })).toEqual({ oil: 70 });
    const at30 = { ...worn(), buildings: { ...worn().buildings, lighthouse: 30 } };
    expect(ok(repairRafts(at30)).stock).toEqual({ ...at30.stock, oil: at30.stock.oil - 220 });
  });

  it("takes 6 minutes of shipyard per 35 missing points", () => {
    expect(repairTime({ [A]: { hp: 65, building: null, level: 0 } })).toBe(6 * 60);
    expect(repairTime(worn().rafts)).toBeCloseTo((110 / 35) * 6 * 60, 6);
    const ten: Rafts = Object.fromEntries(RAFT_SLOTS.slice(0, 10).map((s) => [s.key, { hp: 65, building: null, level: 0 }]));
    expect(repairTime(ten)).toBe(HOUR);
  });

  it("pays at once, then every repaired raft is back to full sturdiness and full efficiency", () => {
    const s = worn();
    const started = ok(repairRafts(s));
    expect(started.stock.oil).toBe(s.stock.oil - 220);
    expect(started.stock.wood).toBe(s.stock.wood);
    expect(started.yard).toEqual({ kind: "repair", slots: damagedRafts(s.rafts), left: repairTime(s.rafts), duration: repairTime(s.rafts) });
    expect(raftEffect(started.rafts, "greenhouse")).toBe(2 + 0.5);
    const done = advance(started, repairTime(s.rafts));
    expect(done.yard).toBeNull();
    expect(Object.values(done.rafts).map((r) => r.hp)).toEqual([RAFT_MAX_HP, RAFT_MAX_HP, RAFT_MAX_HP]);
    expect(raftEffect(done.rafts, "greenhouse")).toBe(3);
    expect(eventsBetween(started, done)).toContainEqual({ kind: "repaired", count: 2 });
  });

  it("refuses: nothing to repair, the shipyard busy, not enough resources", () => {
    const sound = { ...worn(), rafts: { [A]: worn().rafts[A]! } };
    expect(repairRafts(sound)).toEqual({ ok: false, reason: "Nothing needs mending" });
    const busy = ok(repairRafts(worn()));
    expect(repairRafts(busy)).toEqual({ ok: false, reason: "Your builders on the shore are busy" });
    expect(repairRafts({ ...worn(), stock: { oil: 219, fish: 0, wood: 0, rope: 0 } })).toEqual({ ok: false, reason: "Not enough resources" });
    expect(repairRafts({ ...worn(), stock: { oil: 220, fish: 0, wood: 0, rope: 0 } }).ok).toBe(true);
    expect(canRepair({ rafts: worn().rafts, stock: worn().stock, yard: null })).toEqual({ ok: true });
  });

  it("a raft below 60 cannot be upgraded until it is repaired", () => {
    const s = worn();
    expect(canUpgradeRaft({ rafts: s.rafts, slot: C, lighthouse: s.buildings.lighthouse, stock: s.stock, yard: null })).toEqual({ ok: false, reason: "Mend this first" });
    expect(canUpgradeRaft({ rafts: s.rafts, slot: B, lighthouse: s.buildings.lighthouse, stock: s.stock, yard: null }).ok).toBe(true);
    const repaired = advance(ok(repairRafts(s)), HOUR);
    expect(canUpgradeRaft({ rafts: repaired.rafts, slot: C, lighthouse: repaired.buildings.lighthouse, stock: repaired.stock, yard: null }).ok).toBe(true);
  });

  it("a Mist not held while the rafts are repaired is mended with them", () => {
    // 05:50 UTC: the Mist lifts at 06:00, the order taken back, during the repair.
    const s = { ...worn(), clock: 5 * HOUR + 50 * 60 };
    const repairing = ok(repairRafts(ok(stoke(s, false))));
    const after = advance(repairing, HOUR);
    expect(after.mist.missed).toBe(1);
    // The rafts under repair end at full sturdiness; the sound one, not under repair, took the Mist's damage.
    expect([after.rafts[B]!.hp, after.rafts[C]!.hp]).toEqual([RAFT_MAX_HP, RAFT_MAX_HP]);
    expect(after.rafts[A]!.hp).toBe(RAFT_MAX_HP - MIST_RAFT_DAMAGE);
  });

  it("an action with no field; parseState keeps a repair of rafts the city has, and refuses any other", () => {
    expect(parseAction({ id: ID, type: "repairRafts" })).toEqual({ id: ID, type: "repairRafts" });
    expect(parseAction({ id: ID, type: "repairRafts", oil: 0 })).toBeNull();
    expect(parseAction({ id: ID, type: "repairRafts", slots: [A] })).toBeNull();
    expect(applyAction(worn(), { id: ID, type: "repairRafts" })).toEqual(repairRafts(worn()));
    const started = JSON.parse(JSON.stringify(ok(repairRafts(worn()))));
    expect(parseState(started)).toEqual(ok(repairRafts(worn())));
    const job = started.yard;
    for (const yard of [
      { ...job, slots: [] },
      { ...job, slots: [B, B] },
      { ...job, slots: ["0,0"] },
      { ...job, slots: "all" },
      { ...job, slot: B },
      { ...job, duration: 0 },
    ]) expect(parseState({ ...started, yard }), JSON.stringify(yard)).toBeNull();
    // A raft no longer there: refused, never repaired for free.
    const { [B]: _gone, ...fewer } = started.rafts;
    expect(parseState({ ...started, rafts: fewer })).toBeNull();
  });
});
