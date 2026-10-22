/**
 * Checks a saved proof against Solana itself, without Brinelight's server (week 9, task 5): what anyone can do with the
 * file "Save the proof" gives, this repository and a public RPC endpoint.
 *
 * 1. The proof's fields give its leaf, and its leaf with its path gives its seal's root (no network).
 * 2. The RPC endpoint is on the proof's network (its genesis hash).
 * 3. The seal's transaction is on chain, finalized, succeeded, is exactly a notary's Memo transaction, and its
 *    signature is right for its message (checked here, not taken from the endpoint).
 * 4. Its memo is this seal: `brinelight proof v1 <day sealed> <root>`.
 * 5. It is signed by an address of Brinelight's notary, official on that network for that day (`NOTARIES`).
 */
import { CLUSTERS, NOTARIES, checkProofHashes, explorerTx, isOfficialNotary, sealMemo, fromHex, type NotaryAddress, type ProofFile } from "@brinelight/shared";
import { readSeal } from "../../server/src/proofs/notary.js";
import type { Rpc } from "../../server/src/proofs/rpc.js";

export type CheckLine = { ok: boolean; text: string };

const sha256 = async (bytes: Uint8Array) => new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));

export async function checkProof(p: ProofFile, rpc: Rpc, official: readonly NotaryAddress[] = NOTARIES): Promise<CheckLine[]> {
  const lines: CheckLine[] = [];
  const hashes = await checkProofHashes(p, sha256);
  if (hashes) return [{ ok: false, text: hashes }];
  lines.push({ ok: true, text: `The leaf matches its salt, wallet (${p.wallet}), fact (${p.fact}), "${p.when}" and day (${p.day}), and its path leads to the root ${p.seal.root}.` });

  if (rpc.cluster !== p.seal.cluster) return [...lines, { ok: false, text: `The RPC endpoint is on ${rpc.cluster}, the proof on ${p.seal.cluster}.` }];
  let onChain: Awaited<ReturnType<typeof readSeal>>;
  try {
    onChain = await readSeal(rpc, p.seal.signature);
  } catch (err) {
    return [...lines, { ok: false, text: err instanceof Error ? err.message : String(err) }];
  }
  lines.push({ ok: true, text: `The endpoint is on ${p.seal.cluster} (genesis ${CLUSTERS[p.seal.cluster].genesis}).` });
  if (!onChain) return [...lines, { ok: false, text: `The transaction ${p.seal.signature} is not on Solana, or not finalized yet.` }];
  lines.push({ ok: true, text: "The transaction is finalized, it succeeded, it is a Memo transaction with one signer, and its signature is right." });

  const memo = sealMemo(p.seal.day, fromHex(p.seal.root)!);
  if (onChain.memo !== memo) return [...lines, { ok: false, text: `Its memo is "${onChain.memo}", not this seal's "${memo}".` }];
  lines.push({ ok: true, text: `Its memo is this seal: "${memo}".` });

  if (!isOfficialNotary(p.seal.cluster, onChain.signer, p.seal.day, official)) {
    return [...lines, { ok: false, text: `It is signed by ${onChain.signer}, which is not Brinelight's notary on ${p.seal.cluster} for ${p.seal.day} (docs/proofs.md).` }];
  }
  lines.push({ ok: true, text: `It is signed by ${onChain.signer}, Brinelight's notary on ${p.seal.cluster} for ${p.seal.day}.` });
  lines.push({ ok: true, text: `See it: ${explorerTx(p.seal.cluster, p.seal.signature)}` });
  return lines;
}
