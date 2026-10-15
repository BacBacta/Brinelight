import { createHash } from "node:crypto";
import { and, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { Db } from "./index.js";
import { authNonces, sessions } from "./schema.js";

/** Only this hash of a session token is stored: a stolen database gives no usable token. */
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export async function createSession(db: Db, token: string, playerId: string, now: Date, expiresAt: Date): Promise<void> {
  await db.insert(sessions).values({ tokenHash: hashToken(token), playerId, createdAt: now, expiresAt });
}

/** The player of a session token that has not expired at `now`, or null. */
export async function findSession(db: Db, token: string, now: Date): Promise<{ playerId: string; expiresAt: Date } | null> {
  const [row] = await db
    .select({ playerId: sessions.playerId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now)));
  return row ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function createNonce(db: Db, nonce: string, now: Date, expiresAt: Date): Promise<void> {
  await db.insert(authNonces).values({ nonce, createdAt: now, expiresAt });
}

/** Uses a nonce once: true only if it exists, is not used yet and has not expired at `now`. */
export async function useNonce(db: Db, nonce: string, now: Date): Promise<boolean> {
  const rows = await db
    .update(authNonces)
    .set({ usedAt: now })
    .where(and(eq(authNonces.nonce, nonce), gt(authNonces.expiresAt, now), isNull(authNonces.usedAt)))
    .returning({ nonce: authNonces.nonce });
  return rows.length === 1;
}

/** Kept one day after use, so a replayed sign-in can still be told apart from an unknown nonce. */
export const USED_NONCE_KEPT_MS = 24 * 3600 * 1000;

/** Deletes nonces that expired unused or were used more than a day ago, and sessions that expired. */
export async function purgeExpired(db: Db, now: Date): Promise<{ nonces: number; sessions: number }> {
  const dayAgo = new Date(now.getTime() - USED_NONCE_KEPT_MS);
  const n = await db
    .delete(authNonces)
    .where(or(and(isNull(authNonces.usedAt), lt(authNonces.expiresAt, now)), and(isNotNull(authNonces.usedAt), lt(authNonces.usedAt, dayAgo))))
    .returning({ nonce: authNonces.nonce });
  const s = await db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({ tokenHash: sessions.tokenHash });
  return { nonces: n.length, sessions: s.length };
}
