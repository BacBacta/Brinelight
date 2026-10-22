/**
 * The notary's key (week 9, task 3; protected). Read once at start from the server's environment, kept only inside a
 * Node key object, and taken out of the environment at once: no setting, log line, error or answer can carry it.
 *
 * One variable per network, so a devnet key can never sign on mainnet, nor a mainnet key on devnet:
 *   SOLANA_CLUSTER=devnet  → NOTARY_KEY_DEVNET  is read; NOTARY_KEY_MAINNET is not.
 *   SOLANA_CLUSTER=mainnet → NOTARY_KEY_MAINNET is read; NOTARY_KEY_DEVNET is not.
 *   No SOLANA_CLUSTER       → the notary is off and the server seals nothing.
 * A key is 64 bytes in base58 (the 32-byte seed, then the 32-byte public key), as `deploy/notary-key.sh` writes it.
 */
import { createPrivateKey, createPublicKey, sign, type KeyObject } from "node:crypto";
import { isCluster, type Cluster } from "@brinelight/shared";
import { base58Decode, base58Encode } from "../auth/base58.js";
import { memoMessage, signedTransaction } from "./transaction.js";

export const KEY_VARIABLES: Record<Cluster, string> = { devnet: "NOTARY_KEY_DEVNET", mainnet: "NOTARY_KEY_MAINNET" };

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

/**
 * Reads the notary from the environment and removes both key variables from it, whatever happens. The reasons given
 * name a variable, never its value. Throws only on a SOLANA_CLUSTER that is neither devnet nor mainnet: a typo there
 * must stop the server, not seal on a network nobody chose.
 */
export function loadNotary(env: Record<string, string | undefined> = process.env): LoadedNotary {
  const texts = { devnet: env.NOTARY_KEY_DEVNET?.trim() ?? "", mainnet: env.NOTARY_KEY_MAINNET?.trim() ?? "" };
  delete env.NOTARY_KEY_DEVNET;
  delete env.NOTARY_KEY_MAINNET;
  const clusterText = env.SOLANA_CLUSTER?.trim() ?? "";
  if (!clusterText) return { status: "off", reason: "No SOLANA_CLUSTER: the notary is off" };
  if (!isCluster(clusterText)) throw new Error("SOLANA_CLUSTER must be devnet or mainnet");
  const cluster: Cluster = clusterText;
  const name = KEY_VARIABLES[cluster];
  const text = texts[cluster];
  if (!text) return { status: "off", reason: `No ${name}: the notary is off` };
  const own = keyObjectOf(text);
  if (!own) return { status: "off", reason: `${name} is not a notary key (64 bytes in base58, its public key last)` };
  // The other network's key must be another key: one key on both would sign on both.
  const otherCluster: Cluster = cluster === "devnet" ? "mainnet" : "devnet";
  const other = texts[otherCluster] ? keyObjectOf(texts[otherCluster]) : null;
  if (other && Buffer.from(other.publicKey).equals(Buffer.from(own.publicKey))) {
    return { status: "off", reason: `${KEY_VARIABLES.devnet} and ${KEY_VARIABLES.mainnet} hold the same key: each network needs its own` };
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
