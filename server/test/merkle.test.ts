import { fromHex, leafBytes, lighthouseFact, toHex, type ProofLeaf } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import vectors from "../../shared/test/fixtures/proofs-v1.json" with { type: "json" };
import { checkPath, leafHash, merklePath, merkleRoot, rootOf, sha256, type PathStep } from "../src/proofs/merkle.js";

const enc = (s: string) => new TextEncoder().encode(s);
const MILESTONES = [5, 10, 15, 20, 25, 30];
/** The inputs of the vectors, as their `about` says. */
const input = (i: number): ProofLeaf => ({
  salt: sha256(enc(`brinelight test salt ${i}`)).subarray(0, 16),
  wallet: vectors.wallet,
  fact: lighthouseFact(MILESTONES[i % 6]!),
  when: i % 2 === 0 ? "on" : "by",
  day: `2026-10-${String(10 + (i % 20)).padStart(2, "0")}`,
});
const leaves = (n: number) => Array.from({ length: n }, (_, i) => leafHash(input(i)));
const steps = (p: { side: string; hash: string }[]): PathStep[] => p.map((s) => ({ side: s.side as "left" | "right", hash: fromHex(s.hash)! }));
const flip = (b: Uint8Array, at = 0) => {
  const c = Uint8Array.from(b);
  c[at] = c[at]! ^ 1;
  return c;
};

describe("the Merkle tree of a seal", () => {
  it("the hand-worked example of docs/proofs.md", () => {
    const ex = vectors.example;
    expect(toHex(leafBytes(input(0))!)).toBe(ex.bytes);
    expect(toHex(leafHash(input(0)))).toBe(ex.leaf);
    // One leaf is its own root.
    expect(toHex(merkleRoot([leafHash(input(0))]))).toBe(ex.leaf);
  });

  it("gives the vectors' roots and paths, for 1, 2, 3, 7 and 1,000 leaves", () => {
    for (const t of vectors.trees) {
      const l = leaves(t.leaves);
      if (t.leafHashes) expect(l.map(toHex)).toEqual(t.leafHashes);
      expect(toHex(merkleRoot(l)), `${t.leaves} leaves`).toBe(t.root);
      for (const [i, p] of Object.entries(t.paths)) {
        expect(merklePath(l, Number(i)).map((s) => ({ side: s.side, hash: toHex(s.hash) })), `leaf ${i} of ${t.leaves}`).toEqual(p);
        expect(checkPath(l[Number(i)]!, steps(p), fromHex(t.root)!)).toBe(true);
      }
    }
  });

  it("two leaves: the root is sha256(0x01, left, right); three: the odd one goes up alone", () => {
    const [a, b, c] = leaves(3) as [Uint8Array, Uint8Array, Uint8Array];
    const node = (x: Uint8Array, y: Uint8Array) => sha256(Uint8Array.from([1, ...x, ...y]));
    expect(toHex(merkleRoot([a, b]))).toBe(toHex(node(a, b)));
    expect(toHex(merkleRoot([a, b, c]))).toBe(toHex(node(node(a, b), c)));
    // Never paired with itself: [a, b, c] and [a, b, c, c] give two roots.
    expect(toHex(merkleRoot([a, b, c, c]))).not.toBe(toHex(merkleRoot([a, b, c])));
  });

  it("every leaf of 1 to 40 leaves checks against the root with its own path", () => {
    for (let n = 1; n <= 40; n++) {
      const l = leaves(n);
      const root = merkleRoot(l);
      l.forEach((leaf, i) => expect(checkPath(leaf, merklePath(l, i), root), `leaf ${i} of ${n}`).toBe(true));
    }
  });

  it("changing one byte anywhere fails: salt, wallet, fact, when, day, path, root", () => {
    const l = leaves(7);
    const root = merkleRoot(l);
    const path = merklePath(l, 3);
    const ok = (leaf: ProofLeaf, p = path, r = root) => checkPath(leafHash(leaf), p, r);
    const base = input(3);
    expect(ok(base)).toBe(true);
    expect(ok({ ...base, salt: flip(base.salt) })).toBe(false);
    expect(ok({ ...base, wallet: base.wallet.slice(0, -1) + (base.wallet.endsWith("2") ? "3" : "2") })).toBe(false);
    expect(ok({ ...base, fact: "lighthouse:30" })).toBe(false);
    expect(ok({ ...base, when: base.when === "on" ? "by" : "on" })).toBe(false);
    expect(ok({ ...base, day: "2026-10-14" })).toBe(false);
    expect(ok(base, path.map((s, i) => (i === 1 ? { ...s, hash: flip(s.hash, 31) } : s)))).toBe(false);
    expect(ok(base, path.map((s, i) => (i === 0 ? { ...s, side: s.side === "left" ? "right" : "left" } : s)))).toBe(false);
    expect(ok(base, path.slice(1))).toBe(false);
    expect(ok(base, path, flip(root, 5))).toBe(false);
    // Another leaf's path.
    expect(ok(base, merklePath(l, 2))).toBe(false);
  });

  it("a node can never pass for a leaf: its path checks only from a leaf's bytes", () => {
    const l = leaves(4);
    const root = merkleRoot(l);
    const inner = sha256(Uint8Array.from([1, ...l[0]!, ...l[1]!]));
    // The inner node does lead to the root with the last step...
    expect(checkPath(inner, merklePath(l, 0).slice(1), root)).toBe(true);
    // ...but a leaf is only ever made from leafBytes, which start with 0x00: no leaf's bytes give that hash.
    expect(leafBytes(input(0))![0]).toBe(0);
  });

  it("refuses what is not a tree: no leaves, a leaf that is not a hash, a step that is not a hash, a leaf out of the format", () => {
    expect(() => merkleRoot([])).toThrow();
    expect(() => merkleRoot([new Uint8Array(31)])).toThrow();
    expect(() => merklePath(leaves(3), 3)).toThrow();
    const l = leaves(2);
    expect(checkPath(l[0]!, [{ side: "right", hash: new Uint8Array(31) }], merkleRoot(l))).toBe(false);
    expect(() => leafHash({ ...input(0), day: "2026-02-30" })).toThrow();
  });

  it("the same leaves always give the same root, and another order another root", () => {
    const l = leaves(5);
    expect(toHex(merkleRoot(l))).toBe(toHex(merkleRoot([...l])));
    expect(toHex(merkleRoot([...l].reverse()))).not.toBe(toHex(merkleRoot(l)));
    expect(toHex(rootOf(l[0]!, []))).toBe(toHex(l[0]!));
  });
});
