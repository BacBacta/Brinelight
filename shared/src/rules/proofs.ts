/**
 * The format of the proofs sealed on Solana (week 9, `docs/proofs.md`). Pure: only the bytes that are hashed and the
 * text of the memo. The hashing (SHA-256) is done by the server with Node's `crypto` and by the client with Web Crypto,
 * on these same bytes.
 *
 * A leaf ties one fact of a player's game to their wallet with a random salt: once hashed, nothing in it can be read
 * or guessed without the salt, which only the player gets. A fact is `<kind>:<value>`: a new kind (the titles of
 * Guardians of the Great Lighthouse, the seasons of the Tides) needs no new version.
 */

import { isCluster, type Cluster } from "./notary.js";

/** The text every leaf and every memo starts with. A new version would be a new format, checked apart. */
export const PROOF_VERSION = "brinelight proof v1";

/** The Lighthouse levels that are proved (owner's answer 1, 22 October). */
export const LIGHTHOUSE_MILESTONES = [5, 10, 15, 20, 25, 30] as const;

export const SALT_BYTES = 16;
export const HASH_BYTES = 32;

/** The first byte of a leaf and of a node: a leaf can never pass for a node, nor a node for a leaf. */
export const LEAF_PREFIX = 0x00;
export const NODE_PREFIX = 0x01;

/** `on`: the day it happened. `by`: on that day at the latest (a milestone passed before the notary). */
export type ProofWhen = "on" | "by";

/** What a leaf holds, before it is hashed. */
export type ProofLeaf = { salt: Uint8Array; wallet: string; fact: string; when: ProofWhen; day: string };

const FACT = /^[a-z][a-z0-9-]{0,23}:[a-z0-9-]{1,32}$/;
const WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HEX = /^(?:[0-9a-f]{2})*$/;

/** A fact: a kind and a value, in lowercase letters, digits and dashes (`lighthouse:10`). */
export const isFact = (v: unknown): v is string => typeof v === "string" && FACT.test(v);

/** A Solana address as text (base58, 32 to 44 characters). Only its form: the server holds the real one. */
export const isWalletText = (v: unknown): v is string => typeof v === "string" && WALLET.test(v);

export const isProofWhen = (v: unknown): v is ProofWhen => v === "on" || v === "by";

const leap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const monthDays = (y: number, m: number): number => (m === 2 ? (leap(y) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31);

/** A real UTC day written `YYYY-MM-DD`. */
export function isProofDay(v: unknown): v is string {
  if (typeof v !== "string" || !DAY.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number) as [number, number, number];
  return m >= 1 && m <= 12 && d >= 1 && d <= monthDays(y, m);
}

/** The UTC day of a time in seconds since 1970 (the days counted from 1 March of year 0, to keep leap days last). */
export function proofDay(seconds: number): string {
  const z = Math.floor(seconds / 86_400) + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${String(y).padStart(4, "0")}-${two(m)}-${two(d)}`;
}

/** The fact of a Lighthouse milestone. */
export const lighthouseFact = (level: number): string => `lighthouse:${level}`;

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));
/** One field: its length on one byte, then its text. A field can never spill into the next one. */
const field = (text: string): number[] => [text.length, ...ascii(text)];

/** The bytes of a leaf, hashed with SHA-256 to make it. Null when a field does not follow the format. */
export function leafBytes(leaf: ProofLeaf): Uint8Array | null {
  const { salt, wallet, fact, when, day } = leaf;
  if (!(salt instanceof Uint8Array) || salt.length !== SALT_BYTES) return null;
  if (!isWalletText(wallet) || !isFact(fact) || !isProofWhen(when) || !isProofDay(day)) return null;
  return Uint8Array.from([LEAF_PREFIX, ...ascii(PROOF_VERSION), ...salt, ...field(wallet), ...field(fact), ...field(when), ...field(day)]);
}

/** The bytes of a node, hashed with SHA-256 to make it: its two children, in the leaves' order. */
export function nodeBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  if (left.length !== HASH_BYTES || right.length !== HASH_BYTES) throw new Error("A node joins two hashes of 32 bytes");
  return Uint8Array.from([NODE_PREFIX, ...left, ...right]);
}

/** The memo of a night's seal: the version, the day sealed and the root in hex. */
export const sealMemo = (day: string, root: Uint8Array): string => {
  if (!isProofDay(day) || root.length !== HASH_BYTES) throw new Error("A seal needs a day and a root of 32 bytes");
  return `${PROOF_VERSION} ${day} ${toHex(root)}`;
};

/**
 * The memo of a test seal (`npm run notary:test-seal`, devnet only): marked "test", with a fixed root of 32 zero bytes.
 * It holds no player's data, is never a night's seal, and is never a proof: `parseSealMemo` refuses it.
 */
export const testSealMemo = (day: string): string => {
  if (!isProofDay(day)) throw new Error("A test seal needs a day");
  return `brinelight test v1 ${day} ${"00".repeat(HASH_BYTES)}`;
};

/** Reads a seal's memo, or null when it is not one. */
export function parseSealMemo(text: string): { day: string; root: Uint8Array } | null {
  const m = /^brinelight proof v1 (\d{4}-\d{2}-\d{2}) ([0-9a-f]{64})$/.exec(text);
  if (!m || !isProofDay(m[1])) return null;
  return { day: m[1]!, root: fromHex(m[2]!)! };
}

export const toHex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Lowercase hex to bytes, or null. */
export function fromHex(hex: string): Uint8Array | null {
  if (!HEX.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return out;
}

/** One step of a proof's path: the sibling's hash (hex), on the left or the right of the hash being built. */
export type ProofStep = { side: "left" | "right"; hash: string };

/** The night's seal a proof is in: the network, the day sealed, the root (hex), the transaction, the path to the root. */
export type SealedIn = { cluster: Cluster; day: string; root: string; signature: string; path: ProofStep[] };

/** A player's proof as the server gives it: what the leaf holds, the leaf (hex), and its seal once there is one. */
export type PlayerProof = { fact: string; when: ProofWhen; day: string; salt: string; wallet: string; leaf: string; seal: SealedIn | null };

/** A proof saved to a file: everything needed to check it alone, against the chain. */
export type ProofFile = { format: typeof PROOF_VERSION; fact: string; when: ProofWhen; day: string; salt: string; wallet: string; leaf: string; seal: SealedIn };

const HASH_HEX = /^[0-9a-f]{64}$/;
const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const onlyKeys = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).length === keys.length && keys.every((k) => Object.hasOwn(o, k));

/** The file of a sealed proof. */
export const proofFile = (p: PlayerProof & { seal: SealedIn }): ProofFile => ({
  format: PROOF_VERSION,
  fact: p.fact,
  when: p.when,
  day: p.day,
  salt: p.salt,
  wallet: p.wallet,
  leaf: p.leaf,
  seal: { cluster: p.seal.cluster, day: p.seal.day, root: p.seal.root, signature: p.seal.signature, path: p.seal.path.map((s) => ({ side: s.side, hash: s.hash })) },
});

/** Reads a proof file strictly: every field, in its format, and nothing else. Null otherwise. */
export function parseProofFile(v: unknown): ProofFile | null {
  if (!isObj(v) || !onlyKeys(v, ["format", "fact", "when", "day", "salt", "wallet", "leaf", "seal"])) return null;
  if (v.format !== PROOF_VERSION || !isFact(v.fact) || !isProofWhen(v.when) || !isProofDay(v.day)) return null;
  if (typeof v.salt !== "string" || !/^[0-9a-f]{32}$/.test(v.salt) || !isWalletText(v.wallet) || typeof v.leaf !== "string" || !HASH_HEX.test(v.leaf)) return null;
  const s = v.seal;
  if (!isObj(s) || !onlyKeys(s, ["cluster", "day", "root", "signature", "path"])) return null;
  if (!isCluster(s.cluster) || !isProofDay(s.day) || typeof s.root !== "string" || !HASH_HEX.test(s.root) || typeof s.signature !== "string" || !SIGNATURE.test(s.signature)) return null;
  if (!Array.isArray(s.path) || s.path.length > 64) return null;
  const path: ProofStep[] = [];
  for (const step of s.path) {
    if (!isObj(step) || !onlyKeys(step, ["side", "hash"]) || (step.side !== "left" && step.side !== "right") || typeof step.hash !== "string" || !HASH_HEX.test(step.hash)) return null;
    path.push({ side: step.side, hash: step.hash });
  }
  return { format: PROOF_VERSION, fact: v.fact, when: v.when, day: v.day, salt: v.salt, wallet: v.wallet, leaf: v.leaf, seal: { cluster: s.cluster, day: s.day, root: s.root, signature: s.signature, path } };
}

/** SHA-256, given by whoever checks: Web Crypto in the browser and in Node. */
export type Sha256 = (bytes: Uint8Array) => Promise<Uint8Array>;

/**
 * Checks a proof's hashes, with no network: its fields give its leaf, and its leaf with its path gives its seal's
 * root. Null when it holds; otherwise the reason, for the player. That the root is on chain, signed by the notary, is
 * checked apart (`npm run proof:check`, or the explorer).
 */
export async function checkProofHashes(p: Pick<PlayerProof, "fact" | "when" | "day" | "salt" | "wallet" | "leaf"> & { seal: Pick<SealedIn, "root" | "path"> }, sha256: Sha256): Promise<string | null> {
  const salt = fromHex(p.salt);
  const bytes = salt ? leafBytes({ salt, wallet: p.wallet, fact: p.fact, when: p.when, day: p.day }) : null;
  if (!bytes) return "This proof is not in the right format.";
  let hash = await sha256(bytes);
  if (toHex(hash) !== p.leaf) return "This proof's details do not match its leaf.";
  for (const step of p.seal.path) {
    const sibling = fromHex(step.hash);
    if (!sibling || sibling.length !== HASH_BYTES) return "This proof's path is not in the right format.";
    hash = await sha256(step.side === "left" ? nodeBytes(sibling, hash) : nodeBytes(hash, sibling));
  }
  return toHex(hash) === p.seal.root ? null : "This proof's path does not lead to the seal's root.";
}
