/**
 * What the notary does on Solana (week 9, task 3; protected): build and sign a seal's transaction, send it, follow it
 * until it is finalized or can no longer land, read it back from the chain, and know its own balance. The key signs
 * only the Memo transaction of `transaction.ts`; nothing else is ever signed.
 */
import { verifyEd25519 } from "../auth/ed25519.js";
import { base58Decode } from "../auth/base58.js";
import type { NotaryKey } from "./key.js";
import type { Rpc } from "./rpc.js";
import { memoMessage, readMemoTransaction, signedTransaction, transactionId } from "./transaction.js";

/** Lamports in one SOL. */
export const LAMPORTS_PER_SOL = 1_000_000_000;
/** The fee of a transaction with one signature (5,000 lamports a signature), with no priority fee. */
export const SEAL_FEE_LAMPORTS = 5_000;
/** Under this balance, the notary is "low" (owner's answer 6: 0.005 SOL). */
export const LOW_BALANCE_LAMPORTS = 5_000_000;
/**
 * A transaction not found when the finalized chain is this many blocks past its last valid height can no longer
 * land: it is given up and a new one is made. The margin covers a node that is a little behind.
 */
export const EXPIRY_MARGIN_BLOCKS = 150;

/** A seal ready to send: its id on Solana, the transaction in base64, and until when its blockhash is valid. */
export type PreparedSeal = { signature: string; tx: string; blockhash: string; lastValidBlockHeight: number };

/** Builds and signs the transaction carrying `memo`, on a blockhash the network has finalized. */
export async function prepareSeal(rpc: Rpc, key: NotaryKey, memo: string): Promise<PreparedSeal> {
  const latest = await rpc.call<{ value: { blockhash: string; lastValidBlockHeight: number } }>("getLatestBlockhash", [{ commitment: "finalized" }]);
  const blockhash = base58Decode(latest.value.blockhash);
  if (!blockhash || blockhash.length !== 32 || !Number.isSafeInteger(latest.value.lastValidBlockHeight)) throw new Error("The network gave a blockhash that cannot be read");
  const message = memoMessage(key.publicKey, blockhash, memo);
  const signature = key.sign(message);
  const tx = signedTransaction(message, signature);
  return { signature: transactionId(signature), tx: Buffer.from(tx).toString("base64"), blockhash: latest.value.blockhash, lastValidBlockHeight: latest.value.lastValidBlockHeight };
}

/**
 * Sends a signed transaction. Sending the same one again is harmless: it has the same signature, so it can land once
 * at most. The network simulates it first (preflight) and refuses one that would fail.
 */
export async function sendSeal(rpc: Rpc, txBase64: string): Promise<string> {
  return rpc.call<string>("sendTransaction", [txBase64, { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 5 }]);
}

/** Where a sent transaction is: finalized, still on its way, failed on chain, or never landing (its blockhash is too old). */
export type SealState = "finalized" | "pending" | "failed" | "expired";

export async function sealState(rpc: Rpc, signature: string, lastValidBlockHeight: number): Promise<SealState> {
  const statuses = await rpc.call<{ value: ({ confirmationStatus?: string; err: unknown } | null)[] }>("getSignatureStatuses", [[signature], { searchTransactionHistory: true }]);
  const s = statuses.value[0] ?? null;
  if (s) {
    if (s.err) return "failed";
    return s.confirmationStatus === "finalized" ? "finalized" : "pending";
  }
  const height = await rpc.call<number>("getBlockHeight", [{ commitment: "finalized" }]);
  return height > lastValidBlockHeight + EXPIRY_MARGIN_BLOCKS ? "expired" : "pending";
}

/** A finalized seal as the chain holds it: its signer and memo, read from the transaction's own bytes. */
export type SealOnChain = { signer: string; memo: string };

/**
 * Reads a finalized transaction from the chain and checks it as anyone would: it succeeded, it is exactly the notary's
 * kind of transaction, and its signature is right for its own message. Null when it is not found or not finalized.
 */
export async function readSeal(rpc: Rpc, signature: string): Promise<SealOnChain | null> {
  const got = await rpc.call<{ transaction: [string, string]; meta: { err: unknown } | null } | null>("getTransaction", [
    signature,
    { encoding: "base64", commitment: "finalized", maxSupportedTransactionVersion: 0 },
  ]);
  if (!got) return null;
  if (!got.meta || got.meta.err) throw new Error("The seal's transaction failed on chain");
  const tx = readMemoTransaction(new Uint8Array(Buffer.from(got.transaction[0], "base64")));
  if (!tx || transactionId(tx.signature) !== signature) throw new Error("The transaction on chain is not a notary's seal");
  const signer = base58Decode(tx.signer)!;
  if (!verifyEd25519(signer, tx.message, tx.signature)) throw new Error("The seal's signature does not match its message");
  return { signer: tx.signer, memo: tx.memo };
}

/** The notary's balance, in lamports. */
export async function balanceOf(rpc: Rpc, address: string): Promise<number> {
  const got = await rpc.call<{ value: number }>("getBalance", [address, { commitment: "confirmed" }]);
  return got.value;
}
