/**
 * The sea-hunt study's rules (docs/studies/sea-hunt.md): the pure values of `sea-hunt.ts`, and how `sea-hunt-rules.ts`
 * plays them on a city. A study only: nothing here is in `shared/`.
 */
import { describe, expect, it } from "vitest";
import { HOUR, fleetsMax, newPlayerState, type PlayerState } from "@brinelight/shared";
import { PROPOSALS, ZONES, amberForHouse, amberForUpgrade, escortOf, expeditionCargo, speedupCost } from "./sea-hunt.js";
import * as R from "./sea-hunt-rules.js";

const proposal = (id: string) => PROPOSALS.find((p) => p.id === id)!;
const gate = proposal("gate").hunt!.amber;

describe("the sea-hunt study's values", () => {
  it("three zones of 5, 8 and 12 hours: more Amber and more risk the farther, never the city", () => {
    expect(ZONES.map((z) => [z.hours, z.amber, z.loss])).toEqual([[5, 3, 0.03], [8, 5, 0.05], [12, 8, 0.1]]);
    expect(expeditionCargo(ZONES[2]!, 1)).toBe(1350);
    expect(expeditionCargo(ZONES[2]!, 21)).toBe(4050);
    expect(escortOf(ZONES[1]!, 20)).toBe(20);
  });

  it("the gate: Amber for the island's levels 16 to 30, never the Lighthouse's, and the House's 4 and 5", () => {
    expect([14, 15, 29].map((l) => amberForUpgrade(gate, "refinery", l))).toEqual([0, 2, 30]);
    expect(amberForUpgrade(gate, "lighthouse", 29)).toBe(0);
    expect([2, 3, 4].map((l) => amberForHouse(gate, l))).toEqual([0, 10, 20]);
  });

  it("an hour off a 10-hour job costs a tenth of its cost at price ×1", () => {
    expect(speedupCost({ wood: 1000, oil: 500 }, 10 * HOUR, HOUR, 1)).toEqual({ wood: 100, oil: 50 });
    expect(speedupCost({ wood: 1000 }, 10 * HOUR, HOUR, 2)).toEqual({ wood: 200 });
  });
});

describe("the sea-hunt study's rules on a city", () => {
  const city = (): PlayerState => {
    const s = newPlayerState(0);
    return { ...s, buildings: { ...s.buildings, lighthouse: 12, harbor: 6 }, troops: { ...s.troops, boarders: 100 } };
  };

  it("an expedition takes a fleet and its escort, and brings home its cargo, its Amber and what is left of the escort", () => {
    R.begin(proposal("base"));
    const s = city();
    const r = R.applyAction(s, { id: "x", type: "expedition", zone: "deeps", resource: "wood" } as never);
    if (!r.ok) throw new Error(r.reason);
    // Counted once the city it returned is played on (the simulator may still turn an action down).
    expect(R.study.away).toHaveLength(0);
    const sailed = R.advance(r.state, 0);
    expect(R.study.away).toHaveLength(1);
    // The simulator's count of the fleets it may send: the Harbor's, less the one away.
    expect(R.fleetsMax(6)).toBe(fleetsMax(6) - 1);
    expect(r.state.troops.boarders).toBe(88);
    const back = R.advance(sailed, 8 * HOUR);
    expect(R.study.away).toHaveLength(0);
    expect(back.stock.wood).toBeGreaterThanOrEqual(r.state.stock.wood + expeditionCargo(ZONES[1]!, 12));
    expect(back.troops.boarders).toBe(88 + 12 - Math.floor(12 * 0.05));
    expect(R.study.amber).toBe(5);
  });

  it("the gate refuses a level 16 without its Amber; a speed-up takes time off a job, paid, up to the day's cap", () => {
    R.begin(proposal("gate"));
    const s = { ...city(), buildings: { ...city().buildings, lighthouse: 20, refinery: 15 }, stock: { oil: 1e9, fish: 1e9, wood: 1e9, rope: 1e3 } };
    expect(R.applyAction(s, { id: "y", type: "upgrade", building: "refinery" })).toEqual({ ok: false, reason: "Not enough Amber" });
    R.begin(proposal("speed1"));
    const up = R.applyAction(s, { id: "z", type: "upgrade", building: "refinery" });
    if (!up.ok) throw new Error(up.reason);
    const left = up.state.queue[0]!.left;
    const fast = R.applyAction(up.state, { id: "w", type: "speedup", building: "refinery", seconds: 2 * HOUR } as never);
    if (!fast.ok) throw new Error(fast.reason);
    expect(fast.state.queue[0]!.left).toBe(left - HOUR);
    expect(fast.state.stock.wood).toBeLessThan(up.state.stock.wood);
    // Turned down by the simulator: the day's cap is untouched.
    expect(R.applyAction(up.state, { id: "u", type: "speedup", building: "refinery", seconds: HOUR } as never).ok).toBe(true);
    const again = R.applyAction(up.state, { id: "t", type: "speedup", building: "refinery", seconds: 2 * HOUR } as never);
    if (!again.ok) throw new Error(again.reason);
    expect(R.applyAction(again.state, { id: "v", type: "speedup", building: "refinery", seconds: 60 } as never)).toEqual({ ok: false, reason: "You reached today's cap" });
  });
});
