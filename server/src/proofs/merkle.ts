/**
 * The Merkle tree of a night's seal (week 9, `docs/proofs.md`): SHA-256 with Node's `crypto`, on the bytes of
 * `leafBytes` and `nodeBytes` (shared). The leaves keep their order; an odd node goes up alone, never paired with
 * itself, so two different lists of leaves never give the same root.
 */
import { createHash } from "node:crypto";
import { HASH_BYTES, leafBytes, nodeBytes, type ProofLeaf } from "@brinelight/shared";

/** One step of a path: the sibling's hash, and on which side of the node it sits. */
export type PathStep = { side: "left" | "right"; hash: Uint8Array };

export const sha256 = (bytes: Uint8Array): Uint8Array => new Uint8Array(createHash("sha256").update(bytes).digest());

/** A leaf's hash. Throws on a leaf that does not follow the format: the server never records one. */
export function leafHash(leaf: ProofLeaf): Uint8Array {
  const bytes = leafBytes(leaf);
  if (!bytes) throw new Error("This proof's leaf does not follow the format");
  return sha256(bytes);
}

const node = (left: Uint8Array, right: Uint8Array): Uint8Array => sha256(nodeBytes(left, right));

/** Every level of the tree, from the leaves up to the root. */
function levels(leaves: readonly Uint8Array[]): Uint8Array[][] {
  if (leaves.length === 0) throw new Error("A tree needs one leaf at least");
  if (leaves.some((l) => l.length !== HASH_BYTES)) throw new Error("A leaf is a hash of 32 bytes");
  const out: Uint8Array[][] = [[...leaves]];
  while (out[out.length - 1]!.length > 1) {
    const below = out[out.length - 1]!;
    const up: Uint8Array[] = [];
    for (let i = 0; i < below.length; i += 2) up.push(i + 1 < below.length ? node(below[i]!, below[i + 1]!) : below[i]!);
    out.push(up);
  }
  return out;
}

/** The root of the leaves, in their order. One leaf is its own root. */
export const merkleRoot = (leaves: readonly Uint8Array[]): Uint8Array => levels(leaves).at(-1)![0]!;

/** The path from the leaf at `index` to the root: the siblings met on the way up. */
export function merklePath(leaves: readonly Uint8Array[], index: number): PathStep[] {
  if (!Number.isInteger(index) || index < 0 || index >= leaves.length) throw new Error("No leaf at this index");
  const path: PathStep[] = [];
  let i = index;
  for (const level of levels(leaves).slice(0, -1)) {
    const sibling = i ^ 1;
    if (sibling < level.length) path.push({ side: i % 2 === 0 ? "right" : "left", hash: level[sibling]! });
    i >>= 1;
  }
  return path;
}

/** The root a leaf and its path lead to. */
export const rootOf = (leaf: Uint8Array, path: readonly PathStep[]): Uint8Array =>
  path.reduce((h, step) => (step.side === "left" ? node(step.hash, h) : node(h, step.hash)), leaf);

/** Does this leaf, with this path, lead to this root? A step that is not a hash of 32 bytes is a no. */
export function checkPath(leaf: Uint8Array, path: readonly PathStep[], root: Uint8Array): boolean {
  if (leaf.length !== HASH_BYTES || root.length !== HASH_BYTES || path.some((s) => s.hash.length !== HASH_BYTES)) return false;
  return Buffer.from(rootOf(leaf, path)).equals(Buffer.from(root));
}
