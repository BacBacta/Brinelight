/**
 * Records the Lighthouse's milestones a saved city reached (week 9, task 2), to be sealed on Solana at night. Called
 * in the transaction that saves the city, with the city that was stored and the one written: a milestone comes only
 * from a city the rules made on the server, never from the client.
 */
import { randomBytes } from "node:crypto";
import { LIGHTHOUSE_MILESTONES, SALT_BYTES, isWalletText, milestonesReached, proofDay, toHex, type PlayerState } from "@brinelight/shared";
import { eq } from "drizzle-orm";
import type { DbLog, Db } from "../db/index.js";
import { players, proofs } from "../db/schema.js";
import { leafHash } from "./merkle.js";

/**
 * Records each milestone of `after` not recorded yet for this player, with a new random salt, and returns how many.
 * A city under the first milestone costs no query. `now` is the server's real time: the day of the save. A wallet that
 * does not fit the proof's format records nothing and is logged with the player id only: the game goes on.
 */
export async function recordMilestones(db: Db, playerId: string, before: PlayerState, after: PlayerState, now: Date, log?: DbLog): Promise<number> {
  if (after.buildings.lighthouse < LIGHTHOUSE_MILESTONES[0]) return 0;
  const rows = await db.select({ fact: proofs.fact }).from(proofs).where(eq(proofs.playerId, playerId));
  const found = milestonesReached(before, after, new Set(rows.map((r) => r.fact)), proofDay(now.getTime() / 1000));
  if (found.length === 0) return 0;
  const [player] = await db.select({ wallet: players.wallet }).from(players).where(eq(players.id, playerId));
  if (!player) return 0;
  if (!isWalletText(player.wallet)) {
    log?.error({ playerId }, "Milestones not recorded: the wallet does not fit the proof's format");
    return 0;
  }
  const values = found.map((m) => {
    const salt = new Uint8Array(randomBytes(SALT_BYTES));
    return { playerId, fact: m.fact, when: m.when, day: m.day, salt: toHex(salt), leaf: toHex(leafHash({ salt, wallet: player.wallet, ...m })), recordedAt: now };
  });
  const added = await db.insert(proofs).values(values).onConflictDoNothing().returning({ id: proofs.id });
  return added.length;
}
