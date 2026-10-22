/**
 * The nightly seal (week 9, task 4; protected). Every night from 00:15 UTC, on real time (never sped up by
 * DEV_SPEED), the milestones recorded before 00:00 and not sealed yet go into one Merkle tree, whose root is sealed
 * in one Memo transaction signed by the notary.
 *
 * One seal a night, never two:
 * - the seal and its signed transaction are written, with the milestones it holds, before anything is sent;
 * - the database allows one seal `sent` or `finalized` per night and network (index `seals_one_a_night`);
 * - a seal sent is followed until it is finalized; while it may still land it is only sent again as it is (same
 *   signature: it can land once at most);
 * - only a seal that can no longer land (its blockhash is well past, `expired`) or that landed with an error
 *   (`failed`) gives its milestones back, to be sealed by a new transaction. After 3 tries a night that did not end
 *   finalized, it waits for the next night.
 */
import { NOTARIES, fromHex, isOfficialNotary, proofDay, sealMemo, toHex, type Cluster, type NotaryAddress } from "@brinelight/shared";
import { and, asc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Db } from "../db/index.js";
import { proofs, seals } from "../db/schema.js";
import type { NotaryKey } from "./key.js";
import { merkleRoot } from "./merkle.js";
import { LOW_BALANCE_LAMPORTS, SEAL_FEE_LAMPORTS, balanceOf, prepareSeal, readSeal, sealState, sendSeal } from "./notary.js";
import type { Rpc } from "./rpc.js";

/** The seal starts at 00:15 UTC (owner's answer 10), after `s1`'s reset. */
export const SEAL_MINUTE_UTC = 15;
/** How often the server looks at the seal: a night to seal, a seal to follow. */
export const SEAL_EVERY_MS = 5 * 60_000;
/** The balance is asked at most this often. */
export const BALANCE_EVERY_MS = 3600_000;
/** A milestone waiting for its seal longer than this makes the notary `late` (a missed night, with margin). */
export const LATE_HOURS = 26;
/** Tries a night (seals given up, `expired` or `failed`) before waiting for the next night. */
export const MAX_TRIES_A_NIGHT = 3;

export type SealLog = { info(fields: Record<string, unknown>, message: string): void; error(fields: Record<string, unknown>, message: string): void };

/** What one look at the seal did. */
export type SealOutcome = "too early" | "nothing" | "sent" | "waiting" | "done" | "low" | "gave up" | "taken";

/** The night to seal at `now`: the UTC day just ended, and the milestones recorded before its end. Null before 00:15. */
export function nightAt(now: Date): { day: string; before: Date } | null {
  const seconds = Math.floor(now.getTime() / 1000);
  const dayStart = Math.floor(seconds / 86_400) * 86_400;
  if (seconds < dayStart + SEAL_MINUTE_UTC * 60) return null;
  return { day: proofDay(dayStart - 1), before: new Date(dayStart * 1000) };
}

export type NotaryService = {
  readonly key: NotaryKey;
  readonly rpc: Rpc;
  /** The last balance read, in lamports; null until the first one. */
  readonly balance: number | null;
  /** Follows the seals sent, then seals the night if it is time. */
  tick(now: Date, log?: SealLog): Promise<SealOutcome>;
};

export function createNotaryService(db: Db, key: NotaryKey, rpc: Rpc): NotaryService {
  let balance: number | null = null;
  let balanceAt = 0;
  const cluster: Cluster = key.cluster;
  if (rpc.cluster !== cluster) throw new Error("The RPC and the key are on two networks");

  const readBalance = async (now: Date, force: boolean) => {
    if (force || balance === null || now.getTime() - balanceAt >= BALANCE_EVERY_MS) {
      balance = await balanceOf(rpc, key.address);
      balanceAt = now.getTime();
    }
    return balance;
  };

  /** Gives a seal's milestones back and marks it, in one transaction; only a seal still `sent` (another process may have moved it). */
  const release = (id: number, status: "expired" | "failed") =>
    db.transaction(async (tx) => {
      const moved = await tx
        .update(seals)
        .set({ status })
        .where(and(eq(seals.id, id), eq(seals.status, "sent")))
        .returning({ id: seals.id });
      if (moved.length) await tx.update(proofs).set({ sealId: null, position: null }).where(eq(proofs.sealId, id));
    });

  /** Each seal sent and not finalized yet: finalized, sent again, or given up. */
  async function follow(now: Date, log?: SealLog): Promise<void> {
    const sent = await db.select().from(seals).where(and(eq(seals.cluster, cluster), eq(seals.status, "sent"))).orderBy(asc(seals.id));
    for (const s of sent) {
      // One seal that cannot be followed now (an endpoint down, a node without history) never stops the others.
      try {
        const state = await sealState(rpc, s.signature, s.lastValidHeight);
        if (state === "finalized") {
          const onChain = await readSeal(rpc, s.signature);
          if (!onChain) continue;
          if (onChain.memo !== s.memo || onChain.signer !== s.signer) {
            // Never expected: the chain holds this signature with another memo or signer. Nothing is sealed again for it.
            log?.error({ cluster, day: s.day, signature: s.signature }, "The seal on chain is not the one written: look at it by hand");
            continue;
          }
          await db
            .update(seals)
            .set({ status: "finalized", finalizedAt: now })
            .where(and(eq(seals.id, s.id), eq(seals.status, "sent")));
          log?.info({ cluster, day: s.day, leaves: s.leaves, signature: s.signature }, "Seal finalized on Solana");
        } else if (state === "pending") {
          // Sent again as it is: the same signature lands once at most. A refusal here changes nothing.
          await sendSeal(rpc, s.tx).catch(() => undefined);
        } else {
          await release(s.id, state);
          log?.error({ cluster, day: s.day, signature: s.signature, state }, "The seal did not land: its milestones wait for a new one");
        }
      } catch (err) {
        log?.error({ cluster, day: s.day, signature: s.signature, reason: err instanceof Error ? err.message : String(err) }, "The seal could not be followed: tried again in 5 minutes");
      }
    }
  }

  /** Seals the night, if it is time and it is not sealed yet. */
  async function sealNight(now: Date, log?: SealLog): Promise<SealOutcome> {
    const night = nightAt(now);
    if (!night) return "too early";
    const tonight = await db.select({ status: seals.status }).from(seals).where(and(eq(seals.cluster, cluster), eq(seals.day, night.day)));
    if (tonight.some((s) => s.status === "finalized")) return "done";
    if (tonight.some((s) => s.status === "sent")) return "waiting";
    if (tonight.filter((s) => s.status === "failed" || s.status === "expired").length >= MAX_TRIES_A_NIGHT) return "gave up";
    const rows = await db
      .select({ id: proofs.id, leaf: proofs.leaf })
      .from(proofs)
      .where(and(isNull(proofs.sealId), lt(proofs.recordedAt, night.before)))
      .orderBy(asc(proofs.id));
    if (rows.length === 0) return "nothing";
    if ((await readBalance(now, true)) < SEAL_FEE_LAMPORTS) {
      log?.error({ cluster, address: key.address }, "The notary cannot pay the seal's fee: send it devnet SOL from the faucet");
      return "low";
    }
    const root = merkleRoot(rows.map((r) => fromHex(r.leaf)!));
    const memo = sealMemo(night.day, root);
    const prepared = await prepareSeal(rpc, key, memo);
    try {
      await db.transaction(async (tx) => {
        const [seal] = await tx
          .insert(seals)
          .values({
            cluster,
            day: night.day,
            root: toHex(root),
            memo,
            leaves: rows.length,
            leafHashes: rows.map((r) => r.leaf).join(""),
            signer: key.address,
            signature: prepared.signature,
            tx: prepared.tx,
            lastValidHeight: prepared.lastValidBlockHeight,
            status: "sent",
            createdAt: now,
          })
          .returning({ id: seals.id });
        for (let i = 0; i < rows.length; i += 1000) {
          const ids = rows.slice(i, i + 1000).map((r) => r.id);
          const taken = await tx
            .update(proofs)
            .set({ sealId: seal!.id })
            .where(and(inArray(proofs.id, ids), isNull(proofs.sealId)))
            .returning({ id: proofs.id });
          if (taken.length !== ids.length) throw new SealTaken();
        }
        // Each leaf's place in the tree: the order of the ids, as the root was built.
        await tx.execute(
          sql`update proofs set position = r.pos from (select id, row_number() over (order by id) - 1 as pos from proofs where seal_id = ${seal!.id}) r where proofs.id = r.id`,
        );
      });
    } catch (err) {
      // Another server process sealed this night first (the index), or took these milestones: nothing is sent.
      if (err instanceof SealTaken || isUniqueViolation(err)) return "taken";
      throw err;
    }
    log?.info({ cluster, day: night.day, leaves: rows.length, root: toHex(root), signature: prepared.signature }, "Seal written, now sent to Solana");
    await sendSeal(rpc, prepared.tx).catch((err: unknown) => log?.error({ cluster, day: night.day, reason: String(err) }, "The seal could not be sent yet: tried again in 5 minutes"));
    return "sent";
  }

  return {
    key,
    rpc,
    get balance() {
      return balance;
    },
    async tick(now, log) {
      await follow(now, log);
      const outcome = await sealNight(now, log);
      await readBalance(now, false).catch(() => undefined);
      return outcome;
    },
  };
}

class SealTaken extends Error {}
const isUniqueViolation = (err: unknown): boolean => {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
};

/** How the notary is, for /health. `off`: no notary. The others but `ok` make /health say something is wrong. */
export type NotaryHealth = "ok" | "late" | "low" | "unlisted" | "off";

/**
 * A milestone waits while it is in no finalized seal of the notary's own network: one sealed on devnet still waits
 * once the notary is on mainnet (week 9, task 6, seals them again).
 */
export async function notaryHealth(db: Db, notary: NotaryService | null, now: Date, official: readonly NotaryAddress[] = NOTARIES): Promise<NotaryHealth> {
  if (!notary) return "off";
  const cluster = notary.key.cluster;
  const [oldest] = await db
    .select({ at: sql<Date | string | null>`min(${proofs.recordedAt})` })
    .from(proofs)
    .leftJoin(seals, eq(seals.id, proofs.sealId))
    .where(sql`${seals.id} is null or ${seals.status} <> 'finalized' or ${seals.cluster} <> ${cluster}`);
  const at = oldest?.at ? new Date(oldest.at) : null;
  if (at && now.getTime() - at.getTime() > LATE_HOURS * 3600_000) return "late";
  if (notary.balance !== null && notary.balance < LOW_BALANCE_LAMPORTS) return "low";
  if (!isOfficialNotary(cluster, notary.key.address, proofDay(now.getTime() / 1000), official)) return "unlisted";
  return "ok";
}

/** notaryHealth asked at most once a minute: /health is open to anyone, and Docker asks it every 30 seconds. */
export function cachedNotaryHealth(db: Db, notary: NotaryService | null, everyMs = 60_000): (now: Date) => Promise<NotaryHealth> {
  let last: { at: number; value: NotaryHealth } | null = null;
  return async (now) => {
    if (last && now.getTime() - last.at < everyMs && now.getTime() >= last.at) return last.value;
    const value = await notaryHealth(db, notary, now);
    last = { at: now.getTime(), value };
    return value;
  };
}

/**
 * Looks at the seal every 5 minutes (and 20 seconds after start), one look at a time. The timer never keeps the
 * process alive, and stops with the server.
 */
export function scheduleSeals(app: FastifyInstance, notary: NotaryService, now: () => Date = () => new Date(), everyMs = SEAL_EVERY_MS): NodeJS.Timeout {
  let running = false;
  const look = () => {
    if (running) return;
    running = true;
    notary
      .tick(now(), app.log)
      .catch((err: unknown) => app.log.error({ reason: err instanceof Error ? err.message : String(err) }, "The seal's look failed: tried again in 5 minutes"))
      .finally(() => (running = false));
  };
  const first = setTimeout(look, 20_000);
  first.unref();
  const timer = setInterval(look, everyMs);
  timer.unref();
  app.addHook("onClose", async () => {
    clearTimeout(first);
    clearInterval(timer);
  });
  return timer;
}
