import { describe, expect, it } from "vitest";
import { nextFloat, nextInt, pickDistinct, seedRng, type Rng } from "../../src/rules/night/random.js";

/** n draws from a seed, the state carried from one to the next. */
const draws = (seed: number, n: number): number[] => {
  let r: Rng = seedRng(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const [v, next] = nextFloat(r);
    out.push(v);
    r = next;
  }
  return out;
};

describe("the Night's seeded generator (mulberry32)", () => {
  it("the same seed gives the same sequence; another seed, another", () => {
    expect(draws(42, 50)).toEqual(draws(42, 50));
    expect(draws(42, 50)).not.toEqual(draws(43, 50));
  });

  it("never changes: a Night replayed from its seed must draw what it drew (these values are the algorithm's)", () => {
    // mulberry32's own first three values for the seed 1.
    expect(draws(1, 3)).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  });

  it("carries its state: nothing global, a state drawn twice gives the same value twice", () => {
    const r = seedRng(7);
    expect(nextFloat(r)[0]).toBe(nextFloat(r)[0]);
    expect(nextFloat(r)[1]).not.toBe(r);
  });

  it("any number is a seed (negative, fractional, beyond 32 bits): a whole 32-bit state", () => {
    for (const seed of [0, -1, 2.5, 2 ** 40 + 3, Number.MAX_SAFE_INTEGER]) {
      const r = seedRng(seed);
      expect(Number.isInteger(r) && r >= 0 && r < 2 ** 32, String(seed)).toBe(true);
    }
  });

  it("draws in [0, 1), spread evenly over 100,000 draws (10 bins, each within 3 % of 10,000)", () => {
    const bins = new Array<number>(10).fill(0);
    for (const v of draws(2026, 100_000)) {
      expect(v >= 0 && v < 1).toBe(true);
      bins[Math.floor(v * 10)]!++;
    }
    for (const b of bins) expect(Math.abs(b - 10_000)).toBeLessThan(300);
  });

  it("a whole number below n, every value reached", () => {
    let r = seedRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const [v, next] = nextInt(r, 6);
      expect(Number.isInteger(v) && v >= 0 && v < 6).toBe(true);
      seen.add(v);
      r = next;
    }
    expect(seen.size).toBe(6);
    expect(() => nextInt(r, 0)).toThrow();
    expect(() => nextInt(r, 2.5)).toThrow();
  });

  it("3 among N: 3 different items, the same for the same state, the list untouched", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
    let r = seedRng(11);
    for (let i = 0; i < 500; i++) {
      const [picked, next] = pickDistinct(r, items, 3);
      expect(new Set(picked).size).toBe(3);
      expect(picked.every((p) => items.includes(p))).toBe(true);
      expect(pickDistinct(r, items, 3)[0]).toEqual(picked);
      r = next;
    }
    expect(items).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(pickDistinct(r, items, 8)[0].slice().sort()).toEqual([...items]);
    expect(() => pickDistinct(r, items, 9)).toThrow();
  });
});
