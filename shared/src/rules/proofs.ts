/**
 * The format of the proofs sealed on Solana (week 9, `docs/proofs.md`). Pure: only the bytes that are hashed and the
 * text of the memo. The hashing (SHA-256) is done by the server with Node's `crypto` and by the client with Web Crypto,
 * on these same bytes.
 *
 * A leaf ties one fact of a player's game to their wallet with a random salt: once hashed, nothing in it can be read
 * or guessed without the salt, which only the player gets. A fact is `<kind>:<value>`: a new kind (the titles of
 * Guardians of the Great Lighthouse, the seasons of the Tides) needs no new version.
 */

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
