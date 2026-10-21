import { describe, expect, it } from "vitest";
import { RAFT_SLOTS, newPlayerState } from "@brinelight/shared";
import { SEA, ground, type At, type LandSlots } from "../src/city/land/field.js";
import { buildLand, coastLines } from "../src/city/land/mesh.js";
import { landSlotsOf } from "../src/city/land/index.js";
import { hexX, hexZ } from "../src/scene/island.js";

const at = (s: { q: number; r: number }): At => ({ x: hexX(s.q, s.r), z: hexZ(s.r) });
const ALL = RAFT_SLOTS.map(at);
/** The pier's three slots stay water whatever is taken (the rules keep them free). */
const PIER = [
  [1, -3],
  [1, -4],
  [2, -4],
].map(([q, r]) => at({ q: q!, r: r! }));

/** A land from a choice of slots: `won` by index into RAFT_SLOTS, some of them flooded, one free slot being filled. */
function landOf(won: number[], flooded: number[] = [], filling: number | null = null): LandSlots {
  const taken = new Set([...won, ...(filling === null ? [] : [filling])]);
  return {
    won: RAFT_SLOTS.map((_, i) => i).filter((i) => taken.has(i)).map((i) => ALL[i]!),
    flooded: flooded.map((i) => ALL[i]!),
    filling: filling === null ? null : ALL[filling]!,
    free: ALL.filter((_, i) => !taken.has(i)),
  };
}

/** A seeded random draw (never Math.random: the same cases on every run). */
function draws(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Every slot taken is land (a flooded one under the water, the landfill just above it), every free one water. */
function checkSlots(L: LandSlots, label: string) {
  const flooded = new Set(L.flooded);
  for (const s of L.won) {
    const y = ground(s.x, s.z, L).y;
    if (flooded.has(s)) expect(y, `${label}: flooded ${s.x},${s.z}`).toBeLessThan(SEA);
    else if (L.filling && s.x === L.filling.x && s.z === L.filling.z) expect(y, `${label}: landfill`).toBeGreaterThan(SEA);
    else expect(y, `${label}: land ${s.x},${s.z}`).toBeGreaterThan(SEA + 0.1);
  }
  for (const s of [...L.free, ...PIER]) expect(ground(s.x, s.z, L).y, `${label}: water ${s.x},${s.z}`).toBeLessThan(SEA);
}

/** Every piece of land above the sea holds the island's center or a slot taken: no stray islet anywhere. */
function checkNoStrayIslet(L: LandSlots, label: string) {
  const step = 0.25;
  const n = Math.round(21 / step) + 1;
  const above = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) above[j * n + i] = ground(-10.5 + i * step, -10.5 + j * step, L).y > SEA ? 1 : 0;
  const seen = new Uint8Array(n * n);
  // Held: near the island's center, or on a slot taken's own land (a flooded one keeps only its rim above the sea).
  const held = (k: number) => {
    const x = -10.5 + (k % n) * step;
    const z = -10.5 + Math.floor(k / n) * step;
    return Math.hypot(x, z) < 4.5 || L.won.some((s) => Math.hypot(x - s.x, z - s.z) <= 1.3);
  };
  for (let k = 0; k < n * n; k++) {
    if (!above[k] || seen[k]) continue;
    const stack = [k];
    seen[k] = 1;
    let anchored = false;
    while (stack.length) {
      const c = stack.pop()!;
      if (!anchored && held(c)) anchored = true;
      const i = c % n;
      for (const d of [i > 0 ? c - 1 : -1, i < n - 1 ? c + 1 : -1, c - n, c + n]) if (d >= 0 && d < n * n && above[d] && !seen[d]) (seen[d] = 1), stack.push(d);
    }
    expect(anchored, `${label}: a piece of land at cell ${k} holds no slot`).toBe(true);
  }
}

describe("the land won on the sea (owner, step 2): one land whatever the slots taken", () => {
  it("random cities: every slot taken is land, every free slot water, the coast one closed line, the triangles in budget", () => {
    const rand = draws(7);
    for (let c = 0; c < 200; c++) {
      const p = rand();
      const won = RAFT_SLOTS.map((_, i) => i).filter(() => rand() < p);
      const flooded = won.filter(() => rand() < 0.15);
      const free = RAFT_SLOTS.map((_, i) => i).filter((i) => !won.includes(i));
      const filling = free.length && rand() < 0.5 ? free[Math.floor(rand() * free.length)]! : null;
      const L = landOf(won, flooded, filling);
      const label = `case ${c} (${won.length} won, ${flooded.length} flooded, filling ${filling})`;
      const mesh = buildLand(L);
      checkSlots(L, label);
      expect(coastLines(mesh.coast).closed, label).toBe(true);
      expect(mesh.triangles, label).toBeLessThanOrEqual(12_000);
    }
  });

  it("no stray islet: every piece of land holds the island or a slot taken (40 random cities)", () => {
    const rand = draws(11);
    for (let c = 0; c < 40; c++) {
      const p = rand();
      const won = RAFT_SLOTS.map((_, i) => i).filter(() => rand() < p);
      checkNoStrayIslet(landOf(won, won.filter(() => rand() < 0.2)), `case ${c}`);
    }
  });

  it("the extreme cases: none, all 39, one slot of ring 4 alone, a checkerboard, ring 3 with holes, one hole in a full city", () => {
    const ring3 = RAFT_SLOTS.map((s, i) => [s, i] as const).filter(([s]) => s.ring === 3).map(([, i]) => i);
    const ring4 = RAFT_SLOTS.map((s, i) => [s, i] as const).filter(([s]) => s.ring === 4).map(([, i]) => i);
    const every = RAFT_SLOTS.map((_, i) => i);
    const cases: [string, LandSlots][] = [
      ["none", landOf([])],
      ["all 39", landOf(every)],
      ["all 39, one flooded", landOf(every, [7])],
      ["38 and the last being filled", landOf(every.slice(0, 38), [], 38)],
      ["one of ring 4 alone", landOf([ring4[0]!])],
      ["a checkerboard", landOf(every.filter((i) => i % 2 === 0))],
      ["ring 3, every other one", landOf(ring3.filter((_, k) => k % 2 === 0))],
      ["a hole in a full city", landOf(every.filter((i) => i !== ring3[4]))],
    ];
    for (const [label, L] of cases) {
      const mesh = buildLand(L);
      checkSlots(L, label);
      checkNoStrayIslet(L, label);
      const lines = coastLines(mesh.coast);
      expect(lines.closed, label).toBe(true);
      expect(mesh.triangles, label).toBeLessThanOrEqual(12_000);
      // The dike stands only on the land won's coast: none without a slot taken.
      if (!L.won.length) expect(mesh.coast.some((s) => s.won), label).toBe(false);
      else expect(mesh.coast.some((s) => s.won), label).toBe(true);
    }
    // A hole in a full city: its own coast, all round it.
    expect(coastLines(buildLand(cases[7]![1]).coast).lines).toBeGreaterThanOrEqual(2);
  });

  it("a city's land: its rafts (a flooded one under 60), the slot the shipyard fills, the free ones", () => {
    const base = newPlayerState();
    const [a, b, c] = RAFT_SLOTS;
    const state = { ...base, rafts: { [a!.key]: { hp: 100, building: null, level: 0 }, [b!.key]: { hp: 40, building: null, level: 0 } }, yard: { slot: c!.key, kind: "raft" as const, left: 10, duration: 20 } };
    const L = landSlotsOf(state);
    expect(L.won).toHaveLength(3);
    expect(L.flooded).toEqual([at(b!)]);
    expect(L.filling).toEqual(at(c!));
    expect(L.free).toHaveLength(36);
  });
});
