import { describe, expect, it } from "vitest";
import {
  RAFT_BUILD_TIME,
  RAFT_MAX_HP,
  RAFT_SLOTS,
  advance,
  applyAction,
  dockRaft,
  newPlayerState,
  parseAction,
  parseState,
  raftCap,
  raftCost,
  repairCost,
  type PlayerState,
  type YardJob,
} from "../src/index.js";

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const ID = "3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e4f";
const INNER = RAFT_SLOTS.filter((s) => s.ring === 3).map((s) => s.key);
const OUTER = RAFT_SLOTS.filter((s) => s.ring === 4).map((s) => s.key);

/** A city whose Lighthouse lights the first ring of rafts, with enough to pay for several. */
const lit = (lighthouse = 4): PlayerState => {
  const s = newPlayerState();
  return { ...s, buildings: { ...s.buildings, lighthouse }, stock: { oil: 9000, fish: 9000, wood: 9000, rope: 50 } };
};

describe("rafts around the island", () => {
  it("a raft is paid at once and built by the shipyard in RAFT_BUILD_TIME", () => {
    const s = lit();
    const r = dockRaft(s, INNER[0]!);
    if (!r.ok) throw new Error(r.reason);
    const cost = raftCost(0);
    expect(r.state.yard).toEqual({ slot: INNER[0], kind: "raft", left: RAFT_BUILD_TIME, duration: RAFT_BUILD_TIME });
    expect(r.state.stock.wood).toBe(s.stock.wood - cost.wood!);
    expect(r.state.stock.rope).toBe(s.stock.rope - cost.rope!);
    expect(r.state.rafts).toEqual({});
  });

  it("its end is an event of advance: the raft is moored, new, and the shipyard is free", () => {
    const r = dockRaft(lit(), INNER[0]!);
    if (!r.ok) throw new Error(r.reason);
    expect(advance(r.state, RAFT_BUILD_TIME - 1).yard?.left).toBeCloseTo(1, 9);
    const done = advance(r.state, RAFT_BUILD_TIME + 3600);
    expect(done.rafts).toEqual({ [INNER[0]!]: { hp: RAFT_MAX_HP, building: null, level: 0 } });
    expect(done.yard).toBeNull();
    // The next raft costs more, as the rules say.
    const next = dockRaft(done, INNER[1]!);
    if (!next.ok) throw new Error(next.reason);
    expect(done.stock.wood - next.state.stock.wood).toBe(raftCost(1).wood);
  });

  it("is refused with the rule's reason: slot taken, not lit yet, beyond the Lighthouse's limit, shipyard busy, resources", () => {
    const one = advance((dockRaft(lit(), INNER[0]!) as { state: PlayerState }).state, RAFT_BUILD_TIME);
    expect(dockRaft(one, INNER[0]!)).toEqual({ ok: false, reason: "A raft is already moored here" });
    expect(dockRaft(lit(), OUTER[0]!)).toEqual({ ok: false, reason: "The Lighthouse's light doesn't reach this far yet" });
    expect(dockRaft(lit(8), OUTER[0]!).ok).toBe(true);
    expect(dockRaft(lit(3), INNER[0]!)).toEqual({ ok: false, reason: "Upgrade the Lighthouse to moor more rafts" });
    const full = { ...lit(), rafts: Object.fromEntries(INNER.slice(0, raftCap(4)).map((k) => [k, { hp: RAFT_MAX_HP, building: null, level: 0 }])) };
    expect(dockRaft(full, INNER[raftCap(4)]!)).toEqual({ ok: false, reason: "Upgrade the Lighthouse to moor more rafts" });
    const busy = (dockRaft(lit(), INNER[0]!) as { state: PlayerState }).state;
    expect(dockRaft(busy, INNER[1]!)).toEqual({ ok: false, reason: "The shipyard is busy" });
    expect(dockRaft({ ...lit(), stock: { oil: 0, fish: 0, wood: 0, rope: 0 } }, INNER[0]!)).toEqual({ ok: false, reason: "Not enough resources" });
    expect(dockRaft(lit(), "0,0")).toEqual({ ok: false, reason: "Unknown slot" });
  });

  it("RAFT_MAX_HP is the new raft's sturdiness and what a repair goes back to", () => {
    expect(RAFT_MAX_HP).toBe(100);
    expect(repairCost({ "3,0": { hp: RAFT_MAX_HP, building: null, level: 0 } }, 5)).toEqual({ oil: 0, wood: 0 });
    expect(repairCost({ "3,0": { hp: 40, building: null, level: 0 } }, 5)).toEqual({ oil: (RAFT_MAX_HP - 40) * 2 * 5, wood: RAFT_MAX_HP - 40 });
  });

  it("an action: applyAction gives the same city as the rule; parseAction reads only known slots", () => {
    const s = lit();
    expect(applyAction(s, { id: ID, type: "dockRaft", slot: INNER[0]! })).toEqual(dockRaft(s, INNER[0]!));
    expect(parseAction({ id: ID, type: "dockRaft", slot: INNER[0] })).toEqual({ id: ID, type: "dockRaft", slot: INNER[0] });
    for (const slot of ["0,0", "1,-3", "toString", "", "9,9", 3]) expect(parseAction({ id: ID, type: "dockRaft", slot }), String(slot)).toBeNull();
  });
});

describe("parseState: the shipyard", () => {
  const started = (dockRaft(lit(), INNER[0]!) as { state: PlayerState }).state;
  const job = started.yard as Extract<YardJob, { slot: string }>;

  it("reads none, or a raft being built", () => {
    expect(parseState(json(newPlayerState()))?.yard).toBeNull();
    expect(parseState(json(started))).toEqual(started);
    expect(parseState(json({ ...started, yard: { ...job, left: -1 } }))?.yard?.left).toBe(0);
  });

  const bad: [string, unknown][] = [
    ["a city without the field", (({ yard: _y, ...rest }) => rest)(started)],
    ["an unknown slot", { ...started, yard: { ...job, slot: "0,0" } }],
    ["a slot that already has a raft", { ...started, rafts: { [job.slot]: { hp: RAFT_MAX_HP, building: null, level: 0 } } }],
    ["another kind of work", { ...started, yard: { ...job, kind: "install" } }],
    ["an extra field", { ...started, yard: { ...job, building: "watchtower" } }],
    ["a duration of 0", { ...started, yard: { ...job, duration: 0 } }],
    [`a raft above ${RAFT_MAX_HP} sturdiness`, { ...started, rafts: { [INNER[3]!]: { hp: RAFT_MAX_HP + 1, building: null, level: 0 } } }],
  ];
  for (const [name, city] of bad) {
    it(`refuses ${name}`, () => {
      expect(parseState(json(city))).toBeNull();
    });
  }
});
