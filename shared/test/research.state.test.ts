import { describe, expect, it } from "vitest";
import {
  HOUR,
  TECHS,
  advance,
  applyAction,
  newPlayerState,
  observatoryRequired,
  parseAction,
  parseState,
  research,
  storeCap,
  techCost,
  techTime,
  type PlayerState,
} from "../src/index.js";

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const ID = "3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e4f";

/** A city with its Observatory built, and enough to pay for a few research levels. */
const withObservatory = (level = 1): PlayerState => {
  const s = newPlayerState();
  return { ...s, buildings: { ...s.buildings, observatory: level }, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 } };
};

describe("research at the Observatory", () => {
  it("starts with the cost and time of the shared rules, paid at once", () => {
    const s = withObservatory();
    const r = research(s, "refining");
    if (!r.ok) throw new Error(r.reason);
    const cost = techCost("refining", 0);
    expect(r.state.research).toEqual({ id: "refining", left: techTime("refining", 0), duration: techTime("refining", 0) });
    expect(r.state.stock.wood).toBe(s.stock.wood - cost.wood!);
    expect(r.state.stock.oil).toBe(s.stock.oil - cost.oil!);
    expect(r.state.techs).toEqual({});
  });

  it("is refused with the rule's reason: one at a time, the Observatory's level, the maximum, the resources", () => {
    const started = research(withObservatory(), "refining");
    if (!started.ok) throw new Error(started.reason);
    expect(research(started.state, "nets")).toEqual({ ok: false, reason: "Research is already in progress" });
    expect(research(newPlayerState(), "refining")).toEqual({ ok: false, reason: `Observatory level ${observatoryRequired("refining", 0)} required` });
    expect(research({ ...withObservatory(), techs: { veterans: TECHS.veterans.max } }, "veterans")).toEqual({ ok: false, reason: "This research is at max level" });
    expect(research({ ...withObservatory(), stock: { oil: 0, fish: 0, wood: 0, rope: 0 } }, "refining")).toEqual({ ok: false, reason: "Not enough resources" });
  });

  it("ends as an event of advance: the level goes up, and the research is free again", () => {
    const r = research(withObservatory(), "refining");
    if (!r.ok) throw new Error(r.reason);
    const d = techTime("refining", 0);
    expect(advance(r.state, d - 1).research?.left).toBeCloseTo(1, 9);
    const done = advance(r.state, d);
    expect(done.techs).toEqual({ refining: 1 });
    expect(done.research).toBeNull();
  });

  it("production changes at the exact moment a research ends, even during a long absence", () => {
    const r = research(withObservatory(), "refining");
    if (!r.ok) throw new Error(r.reason);
    const d = techTime("refining", 0);
    const away = 2 * 24 * HOUR;
    const once = advance(r.state, away);
    // Cut by hand at the end of the research: the same city.
    const byHand = advance(advance(r.state, d), away - d);
    expect(once.stock.oil).toBeCloseTo(byHand.stock.oil, 6);
    // Neither the old rate all along, nor the new rate all along.
    const never = advance({ ...r.state, research: null }, away);
    const always = advance({ ...r.state, research: null, techs: { refining: 1 } }, away);
    expect(once.stock.oil).toBeGreaterThan(never.stock.oil);
    expect(once.stock.oil).toBeLessThan(always.stock.oil);
    // In one step or in a thousand.
    let s = r.state;
    for (let i = 0; i < 1000; i++) s = advance(s, away / 1000);
    expect(s.stock.oil).toBeCloseTo(once.stock.oil, 6);
    expect(s.techs).toEqual(once.techs);
  });

  it("Sealed Warehouses raise the storage from the moment they are done", () => {
    const s = { ...withObservatory(observatoryRequired("warehouses", 0)), techs: {} };
    const r = research(s, "warehouses");
    if (!r.ok) throw new Error(r.reason);
    const done = advance(r.state, techTime("warehouses", 0));
    expect(storeCap(done.buildings.lighthouse, done.techs)).toBeGreaterThan(storeCap(s.buildings.lighthouse, s.techs));
  });

  it("an action: applyAction gives the same city as the rule; parseAction reads only known research", () => {
    const s = withObservatory();
    expect(applyAction(s, { id: ID, type: "research", tech: "nets" })).toEqual(research(s, "nets"));
    expect(parseAction({ id: ID, type: "research", tech: "nets" })).toEqual({ id: ID, type: "research", tech: "nets" });
    for (const tech of ["teleport", "toString", "constructor", "", 3, null]) expect(parseAction({ id: ID, type: "research", tech }), String(tech)).toBeNull();
    expect(parseAction({ id: ID, type: "research", tech: "nets", level: 3 })).toBeNull();
  });
});

describe("parseState: the research in progress", () => {
  const started = (() => {
    const r = research(withObservatory(), "refining");
    if (!r.ok) throw new Error(r.reason);
    return r.state;
  })();

  it("reads none, or a research in progress", () => {
    expect(parseState(json(newPlayerState()))?.research).toBeNull();
    expect(parseState(json(started))).toEqual(started);
  });

  it("brings the time left back within its duration, as for the build queue", () => {
    const job = started.research!;
    expect(parseState(json({ ...started, research: { ...job, left: job.duration * 3 } }))?.research?.left).toBe(job.duration);
    expect(parseState(json({ ...started, research: { ...job, left: -5 } }))?.research?.left).toBe(0);
  });

  const job = started.research!;
  const bad: [string, unknown][] = [
    ["a city without the field", (({ research: _r, ...rest }) => rest)(started)],
    ["an unknown research", { ...started, research: { ...job, id: "teleport" } }],
    ["a research inherited from Object", { ...started, research: { ...job, id: "toString" } }],
    ["a research already at its maximum", { ...started, techs: { refining: TECHS.refining.max }, research: job }],
    ["a duration of 0", { ...started, research: { ...job, duration: 0 } }],
    ["an extra field", { ...started, research: { ...job, level: 2 } }],
    ["a list", { ...started, research: [job] }],
  ];
  for (const [name, city] of bad) {
    it(`refuses ${name}`, () => {
      expect(parseState(json(city))).toBeNull();
    });
  }
});
