/**
 * The notary's key (week 9, task 3; protected). Read once at start from a file Docker Compose mounts read-only in the
 * server's container (a "secret", `deploy/secrets/`), kept only inside a Node key object: never in an environment
 * variable, a setting, a log line, an error or an answer.
 *
 * One file per network, so a devnet key can never sign on mainnet, nor a mainnet key on devnet:
 *   SOLANA_CLUSTER=devnet  → /run/secrets/notary-devnet.key is read (and the other only to check they differ).
 *   SOLANA_CLUSTER=mainnet → /run/secrets/notary-mainnet.key is read (likewise).
 *   No SOLANA_CLUSTER       → the notary is off and the server seals nothing.
 * A key is 64 bytes in base58 (the 32-byte seed, then the 32-byte public key), as `deploy/notary-key.sh` writes it.
 * An empty file is no key.
 */
import { createPrivateKey, createPublicKey, sign, type KeyObject } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isCluster, type Cluster } from "@brinelight/shared";
import { base58Decode, base58Encode } from "../auth/base58.js";
import { memoMessage, signedTransaction } from "./transaction.js";

/** The key files, in the folder where Docker Compose mounts the secrets. */
export const KEY_FILES: Record<Cluster, string> = { devnet: "notary-devnet.key", mainnet: "notary-mainnet.key" };
export const SECRETS_DIR = "/run/secrets";
/** The variables of an older setup: never read, and a key there stops the notary (it must not live in the environment). */
const OLD_VARIABLES = ["NOTARY_KEY_DEVNET", "NOTARY_KEY_MAINNET"];

/** DER header of an Ed25519 private key (PKCS #8); the 32-byte seed follows it. */
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

/**
 * The notary as the server holds it: its network, its public address, and one thing it can sign: a seal, the Memo
 * transaction of `transaction.ts`, built here from a blockhash and a memo. No other bytes can be signed with the key.
 */
export type NotaryKey = {
  readonly cluster: Cluster;
  readonly address: string;
  readonly publicKey: Uint8Array;
  signSeal(blockhash: Uint8Array, memo: string): { signature: Uint8Array; tx: Uint8Array };
};

export type LoadedNotary = { status: "on"; key: NotaryKey } | { status: "off"; reason: string };

/** The public key of a seed, as Node derives it. */
function publicKeyOf(privateKey: KeyObject): Uint8Array {
  const jwk = createPublicKey(privateKey).export({ format: "jwk" });
  return new Uint8Array(Buffer.from(jwk.x!, "base64url"));
}

/** The private key object of a 64-byte key, or null when it is not one (the seed and the public key must agree). */
function keyObjectOf(text: string): { privateKey: KeyObject; publicKey: Uint8Array } | null {
  const bytes = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(text) ? base58Decode(text) : null;
  if (!bytes || bytes.length !== 64) return null;
  try {
    const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, bytes.subarray(0, 32)]), format: "der", type: "pkcs8" });
    const publicKey = publicKeyOf(privateKey);
    return Buffer.from(publicKey).equals(Buffer.from(bytes.subarray(32))) ? { privateKey, publicKey } : null;
  } catch {
    return null;
  } finally {
    bytes.fill(0);
  }
}

/** A key file's text: empty when it is missing or empty; null when it exists but cannot be read (its owner, its mode). */
function readKeyFile(dir: string, file: string): string | null {
  try {
    return readFileSync(join(dir, file), "utf8").trim();
  } catch (err) {
    return (err as { code?: string }).code === "ENOENT" ? "" : null;
  }
}

/**
 * Reads the notary: SOLANA_CLUSTER from the environment, the key from its file. The reasons given name a file or a
 * variable, never a key. Throws only on a SOLANA_CLUSTER that is neither devnet nor mainnet: a typo there must stop
 * the server, not seal on a network nobody chose.
 */
export function loadNotary(env: Record<string, string | undefined> = process.env, dir = SECRETS_DIR): LoadedNotary {
  const inEnvironment = OLD_VARIABLES.filter((v) => env[v]?.trim());
  for (const v of OLD_VARIABLES) delete env[v];
  const clusterText = env.SOLANA_CLUSTER?.trim() ?? "";
  if (!clusterText) return { status: "off", reason: "No SOLANA_CLUSTER: the notary is off" };
  if (!isCluster(clusterText)) throw new Error("SOLANA_CLUSTER must be devnet or mainnet");
  if (inEnvironment.length) return { status: "off", reason: `${inEnvironment.join(" and ")} found in the environment: a key never goes there, only in deploy/secrets (docs/deploy.md)` };
  const cluster: Cluster = clusterText;
  const file = KEY_FILES[cluster];
  const text = readKeyFile(dir, file);
  if (text === null) return { status: "off", reason: `${file} cannot be read by the server: it must belong to the user 1000 (docs/deploy.md)` };
  if (!text) return { status: "off", reason: `No key in ${file}: the notary is off` };
  const own = keyObjectOf(text);
  if (!own) return { status: "off", reason: `${file} does not hold a notary key (64 bytes in base58, its public key last)` };
  // The other network's key must be another key: one key on both would sign on both.
  const otherFile = KEY_FILES[cluster === "devnet" ? "mainnet" : "devnet"];
  const otherText = readKeyFile(dir, otherFile);
  const other = otherText ? keyObjectOf(otherText) : null;
  if (other && Buffer.from(other.publicKey).equals(Buffer.from(own.publicKey))) {
    return { status: "off", reason: `${KEY_FILES.devnet} and ${KEY_FILES.mainnet} hold the same key: each network needs its own` };
  }
  const { privateKey, publicKey } = own;
  const key: NotaryKey = {
    cluster,
    address: base58Encode(publicKey),
    publicKey,
    signSeal: (blockhash, memo) => {
      const message = memoMessage(publicKey, blockhash, memo);
      const signature = new Uint8Array(sign(null, message, privateKey));
      return { signature, tx: signedTransaction(message, signature) };
    },
  };
  // Nothing enumerable holds the key: printing the object shows its network and address only.
  return { status: "on", key: Object.freeze(key) };
}
