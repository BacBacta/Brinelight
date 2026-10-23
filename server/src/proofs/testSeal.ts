/**
 * The test seal (week 9; protected): one Memo transaction on devnet, run by hand on the server, to check the notary's
 * key, its balance, the transaction and its page on explorer.solana.com before a night has a milestone to seal.
 *   docker compose exec server npm run notary:test-seal
 * Its memo is marked "test" with a fixed root (`testSealMemo`): no player's data, never a night's seal, never a proof.
 * It does not open the database, so nothing of it is recorded. It refuses mainnet, and reads only the devnet key.
 */
import { pathToFileURL } from "node:url";
import { explorerTx, isOfficialNotary, NOTARIES, proofDay, testSealMemo, type NotaryAddress } from "@brinelight/shared";
import { loadNotary, SECRETS_DIR } from "./key.js";
import { balanceOf, LAMPORTS_PER_SOL, prepareSeal, readSeal, SEAL_FEE_LAMPORTS, sealState, sendSeal, type SealState } from "./notary.js";
import { createRpc, rpcUrls, type Rpc } from "./rpc.js";

export type TestSealOptions = {
  env?: Record<string, string | undefined>;
  dir?: string;
  /** The devnet endpoints (tests pass a fake network). */
  rpc?: Rpc;
  official?: readonly NotaryAddress[];
  now?: () => Date;
  /** Waits between two looks at the transaction (tests pass one that moves the fake chain on). */
  wait?: (ms: number) => Promise<void>;
  say?: (line: string) => void;
};

/** One look every 2 seconds, for 2 minutes at most: devnet finalizes in about 15 to 30 seconds. */
const LOOK_EVERY_MS = 2000;
const LOOKS = 60;

const sol = (lamports: number): string => (lamports / LAMPORTS_PER_SOL).toFixed(6);

/** Sends one test seal on devnet and says how it went, line by line. True when everything held. */
export async function testSeal(options: TestSealOptions = {}): Promise<boolean> {
  const say = options.say ?? ((line: string) => console.log(line));
  const env = { ...(options.env ?? process.env) };
  const asked = env.SOLANA_CLUSTER?.trim() ?? "";
  if (asked && asked !== "devnet") {
    say(`✗ The test seal runs on devnet only, and SOLANA_CLUSTER is "${asked}": nothing was sent.`);
    return false;
  }
  // Devnet whether the notary is on or still off on the server: only the devnet key is used.
  const loaded = loadNotary({ ...env, SOLANA_CLUSTER: "devnet" }, options.dir ?? SECRETS_DIR);
  if (loaded.status !== "on") {
    say(`✗ ${loaded.reason}. Nothing was sent.`);
    return false;
  }
  const key = loaded.key;
  if (key.cluster !== "devnet") throw new Error("The test seal runs on devnet only");
  const day = proofDay((options.now ?? (() => new Date()))().getTime() / 1000);
  let ok = true;
  say(`Network: devnet. The notary's address: ${key.address}`);
  if (isOfficialNotary("devnet", key.address, day, options.official ?? NOTARIES)) say("✓ It is the notary's official address on devnet (docs/proofs.md).");
  else {
    ok = false;
    say("✗ It is not the notary's official address on devnet for today (NOTARIES, docs/proofs.md): its seals would not be believed.");
  }

  const rpc = options.rpc ?? createRpc("devnet", { urls: rpcUrls("devnet", env.SOLANA_RPC_URLS) });
  const wait = options.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  try {
    const before = await balanceOf(rpc, key.address);
    if (before < SEAL_FEE_LAMPORTS) {
      say(`✗ Balance: ${sol(before)} SOL, not enough for one fee (0.000005 SOL). Ask for devnet SOL on https://faucet.solana.com (never from Phantom). Nothing was sent.`);
      return false;
    }
    say(`✓ Balance: ${sol(before)} SOL on devnet.`);

    const memo = testSealMemo(day);
    const prepared = await prepareSeal(rpc, key, memo);
    await sendSeal(rpc, prepared.tx);
    say(`Sent: ${prepared.signature}. Waiting until it is finalized (about 15 to 30 seconds)…`);
    let state: SealState = "pending";
    for (let i = 0; i < LOOKS && state === "pending"; i++) {
      await wait(LOOK_EVERY_MS);
      state = await sealState(rpc, prepared.signature, prepared.lastValidBlockHeight);
    }
    const link = explorerTx("devnet", prepared.signature);
    if (state === "pending") {
      say(`✗ Not finalized after 2 minutes. Look at it in a minute: ${link}`);
      return false;
    }
    if (state !== "finalized") {
      say(state === "expired" ? "✗ It never landed (its blockhash expired): run the command again." : `✗ It failed on chain: ${link}`);
      return false;
    }
    const onChain = await readSeal(rpc, prepared.signature);
    if (!onChain || onChain.signer !== key.address || onChain.memo !== memo) {
      say(`✗ The transaction read back from the chain is not the one sent: ${link}`);
      return false;
    }
    say(`✓ Finalized on devnet, signed by the notary, its signature checked, its memo: "${memo}".`);
    const after = await balanceOf(rpc, key.address);
    say(`✓ Fee paid: ${sol(before - after)} SOL. Balance now: ${sol(after)} SOL.`);
    say(`See it: ${link}`);
    say("This is a test: no player's data, not a night's seal, not a proof. The nightly seals go on as planned.");
    return ok;
  } catch (err) {
    // The RPC's errors name an endpoint's host only; nothing here can hold the key.
    say(`✗ ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void testSeal().then((ok) => process.exit(ok ? 0 : 1));
}
