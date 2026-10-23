/**
 * The test seal (week 9): one Memo transaction marked "test" on devnet, to check the key, the balance, the transaction
 * and its explorer page before a night has a milestone to seal. Never on mainnet, never a night's seal.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseSealMemo, testSealMemo, type NotaryAddress } from "@brinelight/shared";
import { afterEach, describe, expect, it } from "vitest";
import { makeNotaryKey } from "../src/proofs/keygen.js";
import { createRpc } from "../src/proofs/rpc.js";
import { testSeal } from "../src/proofs/testSeal.js";
import { fakeSolana, type FakeSolana } from "./fakeSolana.js";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A secrets folder with a devnet key (and, if asked, a mainnet one), as Docker Compose mounts it. */
function secrets(files: { devnet?: boolean; mainnet?: boolean } = { devnet: true }) {
  const dir = mkdtempSync(join(tmpdir(), "secrets-"));
  dirs.push(dir);
  const devnet = makeNotaryKey();
  const mainnet = makeNotaryKey();
  writeFileSync(join(dir, "notary-devnet.key"), files.devnet ? `${devnet.secret}\n` : "", { mode: 0o600 });
  writeFileSync(join(dir, "notary-mainnet.key"), files.mainnet ? `${mainnet.secret}\n` : "", { mode: 0o600 });
  return { dir, devnet, mainnet };
}

function run(chain: FakeSolana, dir: string, env: Record<string, string | undefined>, official: NotaryAddress[] | null = null, address = "") {
  const lines: string[] = [];
  const list = official ?? [{ cluster: "devnet" as const, address, from: "2026-10-01", until: null }];
  const done = testSeal({
    env,
    dir,
    rpc: createRpc("devnet", { urls: ["https://api.devnet.solana.com"], fetch: chain.fetch, wait: async () => {} }),
    official: list,
    now: () => new Date("2026-10-23T14:00:00Z"),
    wait: async () => chain.advance(10),
    say: (l) => lines.push(l),
  });
  return done.then((ok) => ({ ok, lines, text: lines.join("\n") }));
}

describe("npm run notary:test-seal", () => {
  it("sends one Memo transaction marked test on devnet, waits until it is finalized, and gives its explorer page", async () => {
    const s = secrets();
    const chain = fakeSolana("devnet");
    chain.balances.set(s.devnet.address, 1_000_000_000);
    const r = await run(chain, s.dir, { SOLANA_CLUSTER: "devnet" }, null, s.devnet.address);
    expect(r.ok).toBe(true);
    expect(chain.landed).toHaveLength(1);
    const tx = chain.landed[0]!;
    expect(tx.signer).toBe(s.devnet.address);
    expect(tx.memo).toBe(`brinelight test v1 2026-10-23 ${"0".repeat(64)}`);
    expect(tx.memo).toBe(testSealMemo("2026-10-23"));
    // Never read as a night's seal, so never as a proof.
    expect(parseSealMemo(tx.memo)).toBeNull();
    expect(r.lines).toContain("✓ It is the notary's official address on devnet (docs/proofs.md).");
    expect(r.lines).toContain("✓ Balance: 1.000000 SOL on devnet.");
    expect(r.lines).toContain("✓ Fee paid: 0.000005 SOL. Balance now: 0.999995 SOL.");
    expect(r.lines).toContain(`See it: https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`);
    // The key is never said; only its address.
    expect(r.text).not.toContain(s.devnet.secret);
  });

  it("runs on devnet while the notary is still off on the server (no SOLANA_CLUSTER)", async () => {
    const s = secrets();
    const chain = fakeSolana("devnet");
    chain.balances.set(s.devnet.address, 50_000_000);
    const r = await run(chain, s.dir, {}, null, s.devnet.address);
    expect(r.ok).toBe(true);
    expect(chain.landed).toHaveLength(1);
  });

  it("refuses mainnet: no key read for it, nothing sent, not even a call to a node", async () => {
    const s = secrets({ devnet: true, mainnet: true });
    const chain = fakeSolana("mainnet");
    chain.balances.set(s.mainnet.address, 1_000_000_000);
    for (const SOLANA_CLUSTER of ["mainnet", "testnet"]) {
      const r = await run(chain, s.dir, { SOLANA_CLUSTER }, null, s.devnet.address);
      expect(r.ok).toBe(false);
      expect(r.lines).toEqual([`✗ The test seal runs on devnet only, and SOLANA_CLUSTER is "${SOLANA_CLUSTER}": nothing was sent.`]);
    }
    expect(chain.calls).toEqual([]);
    expect(chain.sent).toBe(0);
  });

  it("an endpoint on another network is never used: nothing lands", async () => {
    const s = secrets();
    const chain = fakeSolana("mainnet");
    chain.balances.set(s.devnet.address, 1_000_000_000);
    const r = await run(chain, s.dir, { SOLANA_CLUSTER: "devnet" }, null, s.devnet.address);
    expect(r.ok).toBe(false);
    expect(chain.sent).toBe(0);
    expect(r.lines.at(-1)).toMatch(/^✗ .*devnet/);
  });

  it("without SOL or without a key, nothing is sent, and it says what to do", async () => {
    const s = secrets();
    const chain = fakeSolana("devnet");
    const poor = await run(chain, s.dir, { SOLANA_CLUSTER: "devnet" }, null, s.devnet.address);
    expect(poor.ok).toBe(false);
    expect(poor.lines.at(-1)).toContain("Ask for devnet SOL on https://faucet.solana.com (never from Phantom). Nothing was sent.");
    expect(chain.sent).toBe(0);

    const empty = secrets({});
    const none = await run(chain, empty.dir, { SOLANA_CLUSTER: "devnet" });
    expect(none).toMatchObject({ ok: false, lines: ["✗ No key in notary-devnet.key: the notary is off. Nothing was sent."] });
    const old = await run(chain, s.dir, { SOLANA_CLUSTER: "devnet", NOTARY_KEY_DEVNET: s.devnet.secret });
    expect(old.ok).toBe(false);
    expect(old.text).not.toContain(s.devnet.secret);
    expect(chain.sent).toBe(0);
  });

  it("an address that is not the official one is said so: the test does not hold", async () => {
    const s = secrets();
    const chain = fakeSolana("devnet");
    chain.balances.set(s.devnet.address, 1_000_000_000);
    const r = await run(chain, s.dir, { SOLANA_CLUSTER: "devnet" }, []);
    expect(r.ok).toBe(false);
    expect(r.lines[1]).toMatch(/^✗ It is not the notary's official address on devnet/);
  });

  it("a transaction that never lands is said so, and the network down too", async () => {
    const s = secrets();
    const chain = fakeSolana("devnet");
    chain.balances.set(s.devnet.address, 1_000_000_000);
    chain.drop = true;
    const lost = await run(chain, s.dir, { SOLANA_CLUSTER: "devnet" }, null, s.devnet.address);
    expect(lost.ok).toBe(false);
    expect(lost.lines.at(-1)).toBe("✗ It never landed (its blockhash expired): run the command again.");
    chain.drop = false;
    chain.down = true;
    const down = await run(chain, s.dir, { SOLANA_CLUSTER: "devnet" }, null, s.devnet.address);
    expect(down.ok).toBe(false);
    expect(down.text).not.toContain(s.devnet.secret);
  });

  it("never opens the database: nothing of a test seal is ever recorded as a night's seal", () => {
    const source = readFileSync(new URL("../src/proofs/testSeal.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from "\.\.\/db|from "\.\/seal|drizzle|pg"/);
  });
});
