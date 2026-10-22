/**
 * The notary's Memo transaction, byte by byte (week 9, task 3; protected). Checked three ways: against the wire format
 * of Solana's documentation (https://solana.com/docs/core/transactions/transaction-structure), against a transaction
 * built by Solana's own Rust SDK (through solders, once, outside the repository: fixtures/memo-tx-solders.json), and
 * against the Ed25519 test vector of RFC 8032. A real devnet transaction is checked by hand (docs/proofs.md).
 */
import { createPrivateKey, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { base58Decode, base58Encode } from "../src/auth/base58.js";
import { verifyEd25519 } from "../src/auth/ed25519.js";
import { MAX_TRANSACTION_BYTES, MEMO_PROGRAM, compactU16, memoMessage, readCompactU16, readMemoTransaction, signedTransaction, transactionId } from "../src/proofs/transaction.js";
import solders from "./fixtures/memo-tx-solders.json" with { type: "json" };

const hex = (h: string) => new Uint8Array(Buffer.from(h, "hex"));
const toHex = (b: Uint8Array) => Buffer.from(b).toString("hex");
/** RFC 8032, section 7.1, TEST 1: a public test key, never a real one. */
const RFC_SEED = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
const RFC_PUBLIC = "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
const RFC_EMPTY_SIGNATURE =
  "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b";
const rfcKey = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(RFC_SEED, "hex")]), format: "der", type: "pkcs8" });
const rfcSign = (m: Uint8Array) => new Uint8Array(sign(null, m, rfcKey));

describe("compact-u16, as Solana's documentation describes it", () => {
  it("1 byte for 0 to 127, then 2 or 3 bytes, 7 bits each, the lowest first", () => {
    const cases: [number, number[]][] = [
      [0, [0x00]],
      [1, [0x01]],
      [127, [0x7f]],
      [128, [0x80, 0x01]],
      [255, [0xff, 0x01]],
      [16383, [0xff, 0x7f]],
      [16384, [0x80, 0x80, 0x01]],
      [65535, [0xff, 0xff, 0x03]],
    ];
    for (const [n, bytes] of cases) {
      expect(compactU16(n), String(n)).toEqual(bytes);
      expect(readCompactU16(Uint8Array.from(bytes), 0)).toEqual({ value: n, size: bytes.length });
    }
    expect(() => compactU16(65536)).toThrow();
    expect(() => compactU16(-1)).toThrow();
  });

  it("reads only the shortest form, and never past the end", () => {
    expect(readCompactU16(Uint8Array.from([0x80, 0x00]), 0)).toBeNull();
    expect(readCompactU16(Uint8Array.from([0x80]), 0)).toBeNull();
    expect(readCompactU16(Uint8Array.from([0xff, 0xff, 0xff]), 0)).toBeNull();
    expect(readCompactU16(Uint8Array.from([0xff, 0xff, 0x04]), 0)).toBeNull();
  });
});

describe("the notary's Memo transaction", () => {
  it("the Memo program's id", () => {
    expect(MEMO_PROGRAM).toBe("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
    expect(toHex(base58Decode(MEMO_PROGRAM)!)).toBe("054a535a992921064d24e87160da387c7c35b5ddbc92bb81e41fa8404105448d");
  });

  it("Node signs as RFC 8032 says (test 1)", () => {
    expect(toHex(rfcSign(new Uint8Array(0)))).toBe(RFC_EMPTY_SIGNATURE);
    expect(verifyEd25519(hex(RFC_PUBLIC), new Uint8Array(0), hex(RFC_EMPTY_SIGNATURE))).toBe(true);
  });

  it("the message, field by field as the documentation's table lists them", () => {
    const blockhash = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
    const memo = solders.memo;
    const byHand = [
      // num_required_signatures, num_readonly_signed, num_readonly_unsigned
      1, 0, 1,
      // num_account_keys (compact-u16), then the keys: the fee payer who signs, then the program
      2,
      ...hex(RFC_PUBLIC),
      ...hex("054a535a992921064d24e87160da387c7c35b5ddbc92bb81e41fa8404105448d"),
      // recent_blockhash
      ...blockhash,
      // num_instructions, then the instruction: program_id_index, num_accounts, data_len (compact-u16: 95 < 128), data
      1,
      1,
      0,
      memo.length,
      ...[...memo].map((c) => c.charCodeAt(0)),
    ];
    expect([...memoMessage(hex(RFC_PUBLIC), blockhash, memo)]).toEqual(byHand);
  });

  it("is, to the byte, the transaction Solana's own SDK builds (solders)", () => {
    const blockhash = base58Decode(solders.blockhash)!;
    expect(toHex(blockhash)).toBe(toHex(Uint8Array.from({ length: 32 }, (_, i) => i + 1)));
    const message = memoMessage(hex(solders.publicKey), blockhash, solders.memo);
    expect(toHex(message)).toBe(solders.message);
    const signature = rfcSign(message);
    const tx = signedTransaction(message, signature);
    expect(toHex(tx)).toBe(solders.transaction);
    expect(transactionId(signature)).toBe(solders.signature);
    expect(base58Encode(hex(solders.publicKey))).toBe(solders.address);
    expect(tx.length).toBe(264);
    expect(tx.length).toBeLessThanOrEqual(MAX_TRANSACTION_BYTES);
  });

  it("reads back only a transaction of exactly this kind", () => {
    const blockhash = base58Decode(solders.blockhash)!;
    const message = memoMessage(hex(solders.publicKey), blockhash, solders.memo);
    const tx = signedTransaction(message, rfcSign(message));
    const read = readMemoTransaction(tx)!;
    expect(read.signer).toBe(solders.address);
    expect(read.memo).toBe(solders.memo);
    expect(toHex(read.message)).toBe(toHex(message));
    expect(verifyEd25519(hex(solders.publicKey), read.message, read.signature)).toBe(true);

    const change = (at: number, value: number) => {
      const c = Uint8Array.from(tx);
      c[at] = value;
      return c;
    };
    expect(readMemoTransaction(change(0, 2)), "two signatures").toBeNull();
    expect(readMemoTransaction(change(65, 0x80)), "a versioned message").toBeNull();
    expect(readMemoTransaction(change(66, 1)), "another header").toBeNull();
    expect(readMemoTransaction(change(68, 3)), "three accounts").toBeNull();
    expect(readMemoTransaction(change(101, 0x06)), "another program").toBeNull();
    expect(readMemoTransaction(Uint8Array.from([...tx, 0])), "a byte after it").toBeNull();
    expect(readMemoTransaction(tx.slice(0, -1)), "cut short").toBeNull();
    expect(readMemoTransaction(change(tx.length - 1, 0xff)), "a memo that is not printable ASCII").toBeNull();
  });

  it("refuses what it must not carry", () => {
    const k = hex(RFC_PUBLIC);
    const b = new Uint8Array(32);
    expect(() => memoMessage(k, b, "brinelight proof v1 é")).toThrow();
    expect(() => memoMessage(k, b, "line\nbreak")).toThrow();
    expect(() => memoMessage(k.subarray(1), b, "x")).toThrow();
    expect(() => signedTransaction(memoMessage(k, b, "x"), new Uint8Array(63))).toThrow();
    expect(() => signedTransaction(memoMessage(k, b, "x".repeat(1100)), new Uint8Array(64))).toThrow();
  });
});
