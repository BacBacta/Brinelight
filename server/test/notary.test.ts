/**
 * The notary on Solana (week 9, task 3; protected): the RPC client (tries, endpoints, the network's genesis hash) and
 * the seal's life on chain (sent, followed, read back, its balance), against the fake network of fakeSolana.ts.
 */
import { describe, expect, it } from "vitest";
import { base58Decode } from "../src/auth/base58.js";
import type { NotaryKey } from "../src/proofs/key.js";
import { balanceOf, prepareSeal, readSeal, sealState, sendSeal } from "../src/proofs/notary.js";
import { RpcError, createRpc, endpointName, rpcUrls } from "../src/proofs/rpc.js";
import { readMemoTransaction } from "../src/proofs/transaction.js";
import { fakeSolana, throwawayNotary } from "./fakeSolana.js";

const noWait = async () => {};
const notary = (): { key: NotaryKey; secret: string } => throwawayNotary("devnet");
const MEMO = `brinelight proof v1 2026-10-22 ${"ab".repeat(32)}`;

describe("the RPC client", () => {
  it("uses the network's public endpoints, or SOLANA_RPC_URLS, https only", () => {
    expect(rpcUrls("devnet", undefined)).toEqual(["https://api.devnet.solana.com"]);
    expect(rpcUrls("mainnet", "")).toEqual(["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"]);
    expect(rpcUrls("devnet", " https://a.example/x?k=1 , https://b.example ")).toEqual(["https://a.example/x?k=1", "https://b.example"]);
    expect(() => rpcUrls("devnet", "http://a.example")).toThrow();
    expect(endpointName("https://rpc.example.com/v1/SECRET-KEY?api-key=SECRET")).toBe("rpc.example.com");
  });

  it("refuses an endpoint of another network, and never uses it again", async () => {
    const wrong = fakeSolana("devnet", { genesis: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d" });
    const rpc = createRpc("devnet", { urls: ["https://a.example"], fetch: wrong.fetch, wait: noWait });
    await expect(rpc.call("getBlockHeight")).rejects.toThrow("a.example is not on devnet");
    await expect(rpc.call("getBlockHeight")).rejects.toThrow("no endpoint on devnet");
    expect(wrong.calls).toEqual(["getGenesisHash"]);
  });

  it("tries again, spaced out, on the next endpoint", async () => {
    const good = fakeSolana();
    const waits: number[] = [];
    let first = 0;
    const fetchFn: typeof fetch = async (url, init) => {
      if (String(url).includes("down.example")) {
        first++;
        throw new TypeError("fetch failed");
      }
      return good.fetch(url, init);
    };
    const rpc = createRpc("devnet", { urls: ["https://down.example", "https://up.example"], fetch: fetchFn, wait: async (ms) => void waits.push(ms) });
    expect(await rpc.call<number>("getBlockHeight")).toBe(1000);
    expect(first).toBe(1);
    expect(waits).toEqual([1000]);
  });

  it("gives up after its tries with a reason that names the endpoint's host only", async () => {
    const down = fakeSolana();
    down.down = true;
    const waits: number[] = [];
    const rpc = createRpc("devnet", { urls: ["https://rpc.example.com/v1/SECRET"], fetch: down.fetch, wait: async (ms) => void waits.push(ms) });
    const err = await rpc.call("getBlockHeight").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RpcError);
    expect(String(err)).toContain("rpc.example.com did not answer getGenesisHash");
    expect(String(err)).not.toContain("SECRET");
    expect(waits).toEqual([1000, 3000, 9000]);
  });

  it("a node's refusal keeps its code and its message", async () => {
    const f = fakeSolana();
    const rpc = createRpc("devnet", { urls: ["https://a.example"], fetch: f.fetch, wait: noWait, tries: 1 });
    const err = (await rpc.call("noSuchMethod").catch((e: unknown) => e)) as RpcError;
    expect([err.code, err.message]).toEqual([-32601, "a.example refused noSuchMethod: Method not found"]);
  });
});

describe("a seal on chain", () => {
  it("is built on a finalized blockhash, carries exactly the memo, and is signed by the notary", async () => {
    const chain = fakeSolana();
    const rpc = createRpc("devnet", { urls: ["https://a.example"], fetch: chain.fetch, wait: noWait });
    const { key } = notary();
    const p = await prepareSeal(rpc, key, MEMO);
    const tx = readMemoTransaction(new Uint8Array(Buffer.from(p.tx, "base64")))!;
    expect([tx.signer, tx.memo]).toEqual([key.address, MEMO]);
    expect(p.lastValidBlockHeight).toBe(1150);
    expect(p.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]{86,88}$/);
  });

  it("sent, then confirmed, then finalized and read back as it is", async () => {
    const chain = fakeSolana();
    const rpc = createRpc("devnet", { urls: ["https://a.example"], fetch: chain.fetch, wait: noWait });
    const { key } = notary();
    chain.balances.set(key.address, 20_000_000);
    expect(await balanceOf(rpc, key.address)).toBe(20_000_000);
    const p = await prepareSeal(rpc, key, MEMO);
    expect(await sendSeal(rpc, p.tx)).toBe(p.signature);
    // Sent twice: it lands once and the fee is paid once.
    await sendSeal(rpc, p.tx);
    expect(chain.landed).toHaveLength(1);
    expect(await balanceOf(rpc, key.address)).toBe(20_000_000 - 5000);
    expect(await sealState(rpc, p.signature, p.lastValidBlockHeight)).toBe("pending");
    expect(await readSeal(rpc, p.signature)).toBeNull();
    chain.advance(40);
    expect(await sealState(rpc, p.signature, p.lastValidBlockHeight)).toBe("finalized");
    expect(await readSeal(rpc, p.signature)).toEqual({ signer: key.address, memo: MEMO });
  });

  it("a transaction that never landed is given up only when its blockhash is well past", async () => {
    const chain = fakeSolana();
    const rpc = createRpc("devnet", { urls: ["https://a.example"], fetch: chain.fetch, wait: noWait });
    const { key } = notary();
    chain.balances.set(key.address, 20_000_000);
    chain.drop = true;
    const p = await prepareSeal(rpc, key, MEMO);
    await sendSeal(rpc, p.tx);
    expect(await sealState(rpc, p.signature, p.lastValidBlockHeight)).toBe("pending");
    chain.advance(150 + 150);
    expect(await sealState(rpc, p.signature, p.lastValidBlockHeight)).toBe("pending");
    chain.advance(1);
    expect(await sealState(rpc, p.signature, p.lastValidBlockHeight)).toBe("expired");
    // An expired blockhash can never land again: the node refuses it.
    chain.drop = false;
    await expect(sendSeal(rpc, p.tx)).rejects.toThrow("Blockhash not found");
  });

  it("reading back refuses a transaction that is not the notary's kind or whose signature is wrong", async () => {
    const chain = fakeSolana();
    const rpc = createRpc("devnet", { urls: ["https://a.example"], fetch: chain.fetch, wait: noWait });
    const { key } = notary();
    chain.balances.set(key.address, 20_000_000);
    const p = await prepareSeal(rpc, key, MEMO);
    await sendSeal(rpc, p.tx);
    chain.finalizeAll();
    const landed = chain.landed[0]!;
    // The node answers bytes whose memo was changed after the signature.
    landed.bytes[landed.bytes.length - 1] = "c".charCodeAt(0);
    await expect(readSeal(rpc, p.signature)).rejects.toThrow("The seal's signature does not match its message");
    landed.bytes = Uint8Array.from([...landed.bytes, 0]);
    await expect(readSeal(rpc, p.signature)).rejects.toThrow("not a notary's seal");
    expect(base58Decode(p.signature)!.length).toBe(64);
  });
});
