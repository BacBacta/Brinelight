/**
 * The population study's rules (docs/studies/population.md): the pure values of `population.ts`, and how
 * `population-rules.ts` plays them on a city. A study only: nothing here is in `shared/`.
 */
import { describe, expect, it } from "vitest";
import { RAFT_SLOTS, survivorCap, type PlayerState } from "@brinelight/shared";
import { START, arrivalsPerHour, buildersFor, houseCost, houseMaxLevel, moraleAfter, moraleAfterMists, room } from "./population.js";
import * as R from "./population-rules.js";

describe("the population study's values", () => {
  it("survivors come faster at a higher Lighthouse and a higher morale, and never without fish", () => {
    expect(arrivalsPerHour(START, 10, START.morale.fed, true)).toBeCloseTo(0.3);
    expect(arrivalsPerHour(START, 30, START.morale.fed, true)).toBeCloseTo(0.7);
    expect(arrivalsPerHour(START, 10, 42, true)).toBeCloseTo(0.15);
    expect(arrivalsPerHour(START, 30, 100, false)).toBe(0);
  });

  it("the morale moves toward its target, never past it; the Mists move it at once, between 0 and 100", () => {
    expect(moraleAfter(START, 84, false, 10)).toBe(74);
    expect(moraleAfter(START, 84, false, 100)).toBe(START.morale.hungry);
    expect(moraleAfter(START, 50, true, 100)).toBe(START.morale.fed);
    expect(moraleAfterMists(START, 84, 1, 0)).toBe(86);
    expect(moraleAfterMists(START, 3, 0, 1)).toBe(0);
    expect(moraleAfterMists(START, 99, 3, 0)).toBe(100);
  });

  it("the room: the Shelters' and four a House level; the builders: two, then one more at each threshold", () => {
    expect(room(START, 4, 0)).toBe(survivorCap(4));
    expect(room(START, 30, 165)).toBe(126 + 660);
    const p = { ...START, builders: [100, 250] };
    expect([buildersFor(START, 999), buildersFor(p, 99), buildersFor(p, 100), buildersFor(p, 250)]).toEqual([2, 2, 3, 4]);
  });

  it("a House: 600 wood and 300 fish, ×3 a level; one level more every 7 Lighthouse levels, 5 at most", () => {
    expect(houseCost(START, 0)).toEqual({ wood: 600, fish: 300 });
    expect(houseCost(START, 4)).toEqual({ wood: 48600, fish: 24300 });
    expect([1, 6, 7, 14, 21, 27, 28, 30].map((l) => houseMaxLevel(START, l))).toEqual([1, 1, 2, 3, 4, 4, 5, 5]);
  });
});

describe("the population study's rules, on a city", () => {
  const city = (): PlayerState => {
    R.begin(START);
    const s = R.newPlayerState(0);
    const rafts = Object.fromEntries(RAFT_SLOTS.slice(0, 14).map((x) => [x.key, { hp: 100, building: R.HOUSE as never, level: 5 }]));
    return { ...s, survivors: 300, rafts, buildings: { ...s.buildings, lighthouse: 10, shelters: 30 } };
  };
  const hours = (s: PlayerState, n: number) => {
    for (let h = 0; h < n; h++) s = R.advance(s, 3600);
    return s;
  };

  it("out of fish, no one comes and the morale falls; no one dies or leaves", () => {
    const s = hours({ ...city(), buildings: { ...city().buildings, fishery: 1 }, stock: { ...city().stock, fish: 0 } }, 48);
    expect(s.survivors).toBe(300);
    expect(s.stock.fish).toBe(0);
    // Toward 40, a point an hour; the Mists the Lighthouse held still add 2 each.
    expect(s.morale).toBeGreaterThanOrEqual(START.morale.hungry);
    expect(s.morale).toBeLessThan(START.morale.fed - 30);
  });

  it("with fish and room, survivors come and eat: never more than the room", () => {
    const fed = city();
    const s = hours({ ...fed, buildings: { ...fed.buildings, fishery: 20 }, stock: { ...fed.stock, fish: 100_000 } }, 24 * 30);
    expect(s.survivors).toBe(R.roomOf(s));
    expect(R.roomOf(s)).toBe(126 + 14 * 20);
    expect(s.stock.fish).toBeLessThan(100_000 + 14 * 25 * 24 * 30);
  });

  it("survivors who eat half the rules' fish (the House study's options 5 and 6) leave half of it in the stock", () => {
    const fed = { ...city(), buildings: { ...city().buildings, fishery: 0 }, stock: { ...city().stock, fish: 10_000 } };
    R.begin(START);
    const full = R.advance(fed, 3600);
    R.begin({ ...START, eats: 0.5 });
    const half = R.advance(fed, 3600);
    expect(10_000 - half.stock.fish).toBeCloseTo((10_000 - full.stock.fish) / 2, 0);
  });

  it("a House goes past the raft buildings' level 3, up to what the Lighthouse allows", () => {
    R.begin(START);
    let s = R.newPlayerState(0);
    const slot = RAFT_SLOTS[0]!.key;
    s = { ...s, rafts: { [slot]: { hp: 100, building: R.HOUSE as never, level: 3 } }, buildings: { ...s.buildings, lighthouse: 21 }, stock: { ...s.stock, wood: 1e6, fish: 1e6 } };
    const up = R.applyAction(s, { id: "a1", type: "upgradeRaft", slot });
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    const done = R.advance(up.state, 24 * 3600);
    expect(done.rafts[slot]!.level).toBe(4);
    expect(R.applyAction(done, { id: "a2", type: "upgradeRaft", slot })).toEqual({ ok: false, reason: "Upgrade the Lighthouse first" });
  });
});
