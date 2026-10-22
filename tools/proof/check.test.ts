/**
 * npm run proof:check (week 9, task 5): a proof saved from GET /proofs, checked against the fake network as against
 * Solana, from the seal of a whole night made by the server's own code.
 */
import { randomBytes } from "node:crypto";
import { proofDay, proofFile, toHex, type NotaryAddress, type PlayerProof, type ProofFile } from "@brinelight/shared";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../server/src/app.js";
import { base58Encode } from "../../server/src/auth/base58.js";
import { createSession, findOrCreatePlayer, openDatabase, schema, type Database } from "../../server/src/db/index.js";
import { loadNotary } from "../../server/src/proofs/key.js";
import { makeNotaryKey } from "../../server/src/proofs/keygen.js";
import { leafHash } from "../../server/src/proofs/merkle.js";
import { createRpc } from "../../server/src/proofs/rpc.js";
import { createNotaryService } from "../../server/src/proofs/seal.js";
import { fakeSolana, type FakeSolana } from "../../server/test/fakeSolana.js";
import { checkProof } from "./check.js";

let database: Database;
let chain: FakeSolana;
let file: ProofFile;
let notaryAddress: string;
const rpcOn = (c: FakeSolana, cluster: "devnet" | "mainnet" = "devnet") => createRpc(cluster, { urls: ["https://api.example"], fetch: c.fetch, wait: async () => {} });

beforeAll(async () => {
  database = await openDatabase(undefined);
  const db = database.db;
  await db.execute(sql`truncate players, proofs, seals cascade`);
  chain = fakeSolana("devnet");
  const k = makeNotaryKey();
  const loaded = loadNotary({ SOLANA_CLUSTER: "devnet", NOTARY_KEY_DEVNET: k.secret });
  if (loaded.status !== "on") throw new Error(loaded.reason);
  notaryAddress = loaded.key.address;
  chain.balances.set(notaryAddress, 20_000_000);
  // Three players' milestones on 22 October; the first is "you".
  const players = [];
  for (let i = 0; i < 3; i++) {
    const wallet = base58Encode(randomBytes(32));
    const p = await findOrCreatePlayer(db, wallet, new Date("2026-10-22T00:00:00Z"));
    const salt = new Uint8Array(randomBytes(16));
    const m = { fact: `lighthouse:${5 * (i + 1)}`, when: "on" as const, day: proofDay(Date.parse("2026-10-22T10:00:00Z") / 1000) };
    await db.insert(schema.proofs).values({ playerId: p.id, ...m, salt: toHex(salt), leaf: toHex(leafHash({ salt, wallet, ...m })), recordedAt: new Date("2026-10-22T10:00:00Z") });
    players.push(p);
  }
  const service = createNotaryService(db, loaded.key, rpcOn(chain));
  await service.tick(new Date("2026-10-23T00:15:00Z"));
  chain.advance(40);
  await service.tick(new Date("2026-10-23T00:20:00Z"));
  const token = randomBytes(32).toString("base64url");
  await createSession(db, token, players[0]!.id, new Date("2026-10-22T00:00:00Z"), new Date("2026-11-22T00:00:00Z"));
  const app = await buildApp({ db, notary: service, now: () => new Date("2026-10-23T08:00:00Z") });
  const answer = (await app.inject({ method: "GET", url: "/proofs", headers: { authorization: `Bearer ${token}` } })).json() as { proofs: PlayerProof[] };
  const mine = answer.proofs[0]!;
  file = proofFile({ ...mine, seal: mine.seal! });
}, 60_000);
afterAll(async () => {
  await database?.close();
});

const official = (): NotaryAddress[] => [{ cluster: "devnet", address: notaryAddress, from: "2026-10-01", until: null }];

describe("npm run proof:check", () => {
  it("a true proof holds, line by line", async () => {
    const lines = await checkProof(file, rpcOn(chain), official());
    expect(lines.every((l) => l.ok)).toBe(true);
    expect(lines.map((l) => l.text)).toEqual([
      expect.stringContaining("The leaf matches its salt"),
      expect.stringContaining("The endpoint is on devnet (genesis EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG)"),
      "The transaction is finalized, it succeeded, it is a Memo transaction with one signer, and its signature is right.",
      `Its memo is this seal: "brinelight proof v1 2026-10-22 ${file.seal.root}".`,
      `It is signed by ${notaryAddress}, Brinelight's notary on devnet for 2026-10-22.`,
      `See it: https://explorer.solana.com/tx/${file.seal.signature}?cluster=devnet`,
    ]);
  });

  it("signed by an address that is not the notary's for that day: it does not hold", async () => {
    const lines = await checkProof(file, rpcOn(chain), []);
    expect(lines.at(-1)).toEqual({ ok: false, text: expect.stringContaining("which is not Brinelight's notary on devnet for 2026-10-22") });
    const later: NotaryAddress[] = [{ cluster: "devnet", address: notaryAddress, from: "2026-10-23", until: null }];
    expect((await checkProof(file, rpcOn(chain), later)).at(-1)!.ok).toBe(false);
    const leaked: NotaryAddress[] = [{ cluster: "devnet", address: notaryAddress, from: "2026-10-01", until: null, leaked: "2026-10-20" }];
    expect((await checkProof(file, rpcOn(chain), leaked)).at(-1)!.ok).toBe(false);
  });

  it("a proof changed by one byte, another root, another transaction: it does not hold", async () => {
    expect((await checkProof({ ...file, fact: "lighthouse:30" }, rpcOn(chain), official()))[0]).toEqual({ ok: false, text: "This proof's details do not match its leaf." });
    const other = { ...file, seal: { ...file.seal, root: "00".repeat(32), path: [] } };
    expect((await checkProof(other, rpcOn(chain), official()))[0]!.ok).toBe(false);
    const missing = { ...file, seal: { ...file.seal, signature: "4".repeat(87) } };
    expect((await checkProof(missing, rpcOn(chain), official())).at(-1)).toEqual({ ok: false, text: expect.stringContaining("is not on Solana, or not finalized yet") });
  });

  it("an endpoint of another network is never believed", async () => {
    const mainnetNode = fakeSolana("mainnet");
    const lines = await checkProof(file, rpcOn(mainnetNode, "devnet"), official());
    expect(lines.at(-1)).toEqual({ ok: false, text: expect.stringContaining("is not on devnet") });
    expect((await checkProof(file, rpcOn(chain, "mainnet"), official())).at(-1)).toEqual({ ok: false, text: "The RPC endpoint is on mainnet, the proof on devnet." });
  });
});
