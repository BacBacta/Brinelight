/**
 * The notary's only transaction (week 9, task 3; protected): one legacy Solana transaction with one signer, the
 * notary, who pays its fee, and one instruction to the Memo program carrying the night's memo. Built byte by byte from
 * Solana's documented wire format (https://solana.com/docs/core/transactions/transaction-structure, "Transaction
 * binary format"), with no library. It moves no SOL, creates no account and names no other account: the fee is the
 * only thing it costs.
 *
 * Wire format (legacy):
 *   compact-u16 number of signatures (1), then the 64-byte signature;
 *   the message: header [1 signature required, 0 read-only signed, 1 read-only unsigned],
 *   compact-u16 number of accounts (2), the notary's key then the Memo program's id,
 *   the recent blockhash (32 bytes),
 *   compact-u16 number of instructions (1), then: program index 1, compact-u16 0 accounts, compact-u16 data length,
 *   the memo's bytes (UTF-8, here ASCII).
 */
import { base58Decode, base58Encode } from "../auth/base58.js";

/** Solana's Memo program (SPL Memo v2). */
export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const MEMO_PROGRAM_BYTES = base58Decode(MEMO_PROGRAM)!;

/** A transaction may not be larger than this (PACKET_DATA_SIZE). */
export const MAX_TRANSACTION_BYTES = 1232;

/** compact-u16: 7 bits per byte, the lowest first, the high bit set when another byte follows (1 to 3 bytes). */
export function compactU16(n: number): number[] {
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) throw new Error("compact-u16 holds 0 to 65535");
  const out: number[] = [];
  let rest = n;
  for (;;) {
    const low = rest & 0x7f;
    rest >>= 7;
    if (rest === 0) {
      out.push(low);
      return out;
    }
    out.push(low | 0x80);
  }
}

/** Reads a compact-u16 at `at`: its value and the bytes it took. Null when it runs past the end or is not minimal. */
export function readCompactU16(bytes: Uint8Array, at: number): { value: number; size: number } | null {
  let value = 0;
  for (let i = 0; i < 3; i++) {
    const b = bytes[at + i];
    if (b === undefined) return null;
    value |= (b & 0x7f) << (7 * i);
    if ((b & 0x80) === 0) {
      // The shortest form only: 0x80 0x00 is not another way of writing 0.
      if (i > 0 && b === 0) return null;
      return value > 0xffff ? null : { value, size: i + 1 };
    }
  }
  return null;
}

const ascii = (text: string): Uint8Array => {
  if (!/^[\x20-\x7e]*$/.test(text)) throw new Error("The memo is printable ASCII only");
  return Uint8Array.from([...text].map((c) => c.charCodeAt(0)));
};

/** The message the notary signs: its key, the blockhash, and the Memo instruction with `memo`. */
export function memoMessage(notary: Uint8Array, blockhash: Uint8Array, memo: string): Uint8Array {
  if (notary.length !== 32 || blockhash.length !== 32) throw new Error("A key and a blockhash are 32 bytes");
  const data = ascii(memo);
  return Uint8Array.from([
    // The header: one signature (the notary's), no read-only signer, one read-only account that does not sign (the program).
    1, 0, 1,
    ...compactU16(2),
    ...notary,
    ...MEMO_PROGRAM_BYTES,
    ...blockhash,
    ...compactU16(1),
    // The instruction: the program is account 1, it names no account, then its data.
    1,
    ...compactU16(0),
    ...compactU16(data.length),
    ...data,
  ]);
}

/** The transaction as it is sent: one signature, then the message it signs. */
export function signedTransaction(message: Uint8Array, signature: Uint8Array): Uint8Array {
  if (signature.length !== 64) throw new Error("An Ed25519 signature is 64 bytes");
  const tx = Uint8Array.from([...compactU16(1), ...signature, ...message]);
  if (tx.length > MAX_TRANSACTION_BYTES) throw new Error("The transaction is too large");
  return tx;
}

/** The transaction's id on Solana: its first signature, in base58. */
export const transactionId = (signature: Uint8Array): string => base58Encode(signature);

/** What a memo transaction holds, read back from its bytes. */
export type MemoTransaction = { signature: Uint8Array; message: Uint8Array; signer: string; blockhash: Uint8Array; memo: string };

/**
 * Reads a transaction and returns it only if it is exactly the notary's kind: a legacy transaction, one signature, the
 * header [1, 0, 1], two accounts (the signer, then the Memo program), one instruction to the Memo program naming no
 * account, with a printable ASCII memo, and nothing after it. Anything else is null.
 */
export function readMemoTransaction(bytes: Uint8Array): MemoTransaction | null {
  let at = 0;
  const count = (): number | null => {
    const c = readCompactU16(bytes, at);
    if (!c) return null;
    at += c.size;
    return c.value;
  };
  const take = (n: number): Uint8Array | null => {
    if (at + n > bytes.length) return null;
    const out = bytes.slice(at, at + n);
    at += n;
    return out;
  };
  if (count() !== 1) return null;
  const signature = take(64);
  if (!signature) return null;
  const messageStart = at;
  const header = take(3);
  // A versioned message starts with a byte of 0x80 or more: not this kind.
  if (!header || header[0] !== 1 || header[1] !== 0 || header[2] !== 1) return null;
  if (count() !== 2) return null;
  const signer = take(32);
  const program = take(32);
  if (!signer || !program || base58Encode(program) !== MEMO_PROGRAM) return null;
  const blockhash = take(32);
  if (!blockhash || count() !== 1) return null;
  if (take(1)?.[0] !== 1 || count() !== 0) return null;
  const length = count();
  if (length === null) return null;
  const data = take(length);
  if (!data || at !== bytes.length) return null;
  const memo = String.fromCharCode(...data);
  if (!/^[\x20-\x7e]*$/.test(memo)) return null;
  return { signature, message: bytes.slice(messageStart), signer: base58Encode(signer), blockhash, memo };
}
