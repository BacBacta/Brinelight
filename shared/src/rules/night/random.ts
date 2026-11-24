/**
 * The Night's seeded generator (Hold the Light, docs/design/hold-the-light.md): mulberry32, a 32-bit generator small
 * enough to live in the rules. Its state is a number you carry from one draw to the next, never a global, so that a
 * Night replayed from its seed and its inputs draws exactly what it drew. Free and verifiable: never paid.
 */

/** A generator's state: a whole number from 0 to 2³² − 1. */
export type Rng = number;

/** The state a seed starts from. Any number is a seed; it is brought to 32 bits. */
export const seedRng = (seed: number): Rng => (Math.trunc(seed) % 2 ** 32 >>> 0);

/** A number in [0, 1), and the state after it. */
export function nextFloat(r: Rng): [number, Rng] {
  const a = (r + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 2 ** 32, a >>> 0];
}

/** A whole number from 0 to n − 1, and the state after it. */
export function nextInt(r: Rng, n: number): [number, Rng] {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`nextInt needs a whole number of choices, not ${n}`);
  const [f, next] = nextFloat(r);
  return [Math.floor(f * n), next];
}

/** k different items of the list, in the order drawn, and the state after them. The list is not changed. */
export function pickDistinct<T>(r: Rng, items: readonly T[], k: number): [T[], Rng] {
  if (!Number.isInteger(k) || k < 0 || k > items.length) throw new RangeError(`Cannot pick ${k} of ${items.length}`);
  const pool = items.slice();
  const picked: T[] = [];
  let state = r;
  for (let i = 0; i < k; i++) {
    const [j, next] = nextInt(state, pool.length - i);
    state = next;
    const at = i + j;
    [pool[i], pool[at]] = [pool[at]!, pool[i]!];
    picked.push(pool[i]!);
  }
  return [picked, state];
}
