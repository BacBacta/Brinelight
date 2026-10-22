/**
 * A fake Solana network for the tests (week 9): a `fetch` that answers the JSON-RPC calls the notary makes, from
 * memory. It checks what a real node would (the blockhash, the signature over the message, a transaction sent twice
 * landing once) and lets a test break it: endpoint down, transactions dropped, blocks moving on, another network.
 * Tests only: never used by the server.
 */
import { CLUSTERS, type Cluster } from "@brinelight/shared";
import { base58Decode, base58Encode } from "../src/auth/base58.js";
import { verifyEd25519 } from "../src/auth/ed25519.js";
import { readMemoTransaction, transactionId } from "../src/proofs/transaction.js";

type Landed = { signature: string; bytes: Uint8Array; slot: number; finalized: boolean; signer: string; memo: string };

export type FakeSolana = {
  fetch: typeof fetch;
  /** Every call received, by method. */
  calls: string[];
  /** The transactions that landed, in order. */
  landed: Landed[];
  /** Sends that reached the node (landed or not). */
  sent: number;
  /** When true, every call fails as a network error. */
  down: boolean;
  /** When true, sendTransaction answers the signature but the transaction never lands (lost on the way). */
  drop: boolean;
  /** When set, sendTransaction refuses with this message (a preflight failure). */
  refuse: string | null;
  /** The balances, in lamports, by address. */
  balances: Map<string, number>;
  /**
   * False: a node without history. It knows the statuses of the last 300 blocks only (as Solana's status cache), and
   * refuses getTransaction with the error a real one gives.
   */
  history: boolean;
  /** Moves the chain on by `n` blocks; landed transactions older than 32 blocks become finalized. */
  advance(n: number): void;
  /** Finalizes every landed transaction at once. */
  finalizeAll(): void;
  height(): number;
};

/** A blockhash is valid for this many blocks after it was given (as Solana's 150 slots). */
const VALID_BLOCKS = 150;

export function fakeSolana(cluster: Cluster = "devnet", options: { genesis?: string } = {}): FakeSolana {
  let height = 1000;
  const blockhashes = new Map<string, number>();
  const genesis = options.genesis ?? CLUSTERS[cluster].genesis;
  const blockhashAt = (h: number) => base58Encode(Uint8Array.from({ length: 32 }, (_, i) => (h * 7 + i * 13) & 0xff));
  const state: FakeSolana = {
    calls: [],
    landed: [],
    sent: 0,
    down: false,
    drop: false,
    refuse: null,
    balances: new Map(),
    history: true,
    advance(n) {
      height += n;
      for (const t of state.landed) if (t.slot <= height - 32) t.finalized = true;
    },
    finalizeAll() {
      for (const t of state.landed) t.finalized = true;
    },
    height: () => height,
    fetch: async (_url, init) => {
      if (state.down) throw new TypeError("fetch failed");
      const req = JSON.parse(String(init?.body)) as { id: number; method: string; params: unknown[] };
      state.calls.push(req.method);
      const ok = (result: unknown) => new Response(JSON.stringify({ jsonrpc: "2.0", id: req.id, result }), { status: 200 });
      const fail = (code: number, message: string) => new Response(JSON.stringify({ jsonrpc: "2.0", id: req.id, error: { code, message } }), { status: 200 });
      const p = req.params;
      switch (req.method) {
        case "getGenesisHash":
          return ok(genesis);
        case "getLatestBlockhash": {
          const hash = blockhashAt(height);
          blockhashes.set(hash, height);
          return ok({ context: { slot: height }, value: { blockhash: hash, lastValidBlockHeight: height + VALID_BLOCKS } });
        }
        case "getBlockHeight":
          return ok(height);
        case "getBalance":
          return ok({ context: { slot: height }, value: state.balances.get(String(p[0])) ?? 0 });
        case "sendTransaction": {
          state.sent++;
          if (state.refuse) return fail(-32002, state.refuse);
          const bytes = new Uint8Array(Buffer.from(String(p[0]), "base64"));
          const tx = readMemoTransaction(bytes);
          if (!tx) return fail(-32602, "invalid transaction");
          if (!verifyEd25519(base58Decode(tx.signer)!, tx.message, tx.signature)) return fail(-32003, "Transaction signature verification failure");
          const given = blockhashes.get(base58Encode(tx.blockhash));
          if (given === undefined || height > given + VALID_BLOCKS) return fail(-32002, "Blockhash not found");
          const signature = transactionId(tx.signature);
          const fee = 5000;
          if (!state.landed.some((t) => t.signature === signature) && !state.drop) {
            const balance = state.balances.get(tx.signer) ?? 0;
            if (balance < fee) return fail(-32002, "Attempt to debit an account but found no record of a prior credit.");
            state.balances.set(tx.signer, balance - fee);
            state.landed.push({ signature, bytes, slot: height, finalized: false, signer: tx.signer, memo: tx.memo });
          }
          return ok(signature);
        }
        case "getSignatureStatuses": {
          const sigs = p[0] as string[];
          return ok({
            context: { slot: height },
            value: sigs.map((s) => {
              const t = state.landed.find((l) => l.signature === s && (state.history || l.slot > height - 300));
              return t ? { slot: t.slot, confirmations: t.finalized ? null : 1, err: null, confirmationStatus: t.finalized ? "finalized" : "confirmed" } : null;
            }),
          });
        }
        case "getTransaction": {
          if (!state.history) return fail(-32011, "Transaction history is not available from this node");
          const t = state.landed.find((l) => l.signature === p[0]);
          if (!t || !t.finalized) return ok(null);
          return ok({ slot: t.slot, blockTime: 0, transaction: [Buffer.from(t.bytes).toString("base64"), "base64"], meta: { err: null, fee: 5000 } });
        }
        default:
          return fail(-32601, "Method not found");
      }
    },
  };
  return state;
}
