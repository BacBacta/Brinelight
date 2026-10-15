import { eq } from "drizzle-orm";
import type { Db } from "./index.js";
import { players } from "./schema.js";

export type Player = typeof players.$inferSelect;

/** The player of a wallet, created on first sign-in; `last_seen_at` is set to `now` either way. */
export async function findOrCreatePlayer(db: Db, wallet: string, now: Date): Promise<Player> {
  const [row] = await db
    .insert(players)
    .values({ wallet, createdAt: now, lastSeenAt: now })
    .onConflictDoUpdate({ target: players.wallet, set: { lastSeenAt: now } })
    .returning();
  return row!;
}

export async function findPlayer(db: Db, id: string): Promise<Player | null> {
  const [row] = await db.select().from(players).where(eq(players.id, id));
  return row ?? null;
}
