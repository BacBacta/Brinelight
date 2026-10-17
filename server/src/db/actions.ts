import { createHash } from "node:crypto";
import { CITY_SHAPE, applyAction, catchUp, migrateCity, parseState, type GameAction, type PlayerState } from "@brinelight/shared";
import { and, eq, lt } from "drizzle-orm";
import { ensureCity, gameSeconds, type DbLog } from "./cities.js";
import type { Db } from "./index.js";
import { appliedActions, cities } from "./schema.js";

/** How long the ids of applied actions are kept: a client never sends an action older than this again. */
export const ACTION_KEPT_MS = 7 * 24 * 3600 * 1000;

/** The SHA-256 of an action read by parseAction (its fields always come in the same order). */
export const actionHash = (action: GameAction): string => createHash("sha256").update(JSON.stringify(action)).digest("hex");

/** The city as the answer shows it: advanced to `asOf`, with its version. */
export type CityNow = { state: PlayerState; version: number; asOf: Date };

export type ActionOutcome =
  /** Applied now, or applied before (`replayed`): the city is the one after it, or the current one. */
  | { kind: "applied"; replayed: boolean; city: CityNow }
  /** Refused by the rules now, or before (`replayed`): the city did not change. */
  | { kind: "refused"; replayed: boolean; code: string; error: string; city: CityNow }
  /** The same id was already used for another action: nothing applied. */
  | { kind: "reused"; city: CityNow }
  /** The stored city cannot be read: nothing applied, the row is left as it is. */
  | { kind: "unreadable" }
  /** The rules gave a city that parseState refuses (a bug): nothing written, nothing sent. */
  | { kind: "broken" };

export const RULE_REFUSED = "rule_refused";

/**
 * Applies one action to a player's city, in one transaction:
 * the city is created if missing and its row locked (SELECT … FOR UPDATE), so two actions on the same city
 * run one after the other; an id already seen gives back its first outcome and applies nothing;
 * the city, brought up to the current shape (migrateCity), is advanced to `now` (server clock, times `speed`), then the
 * action is applied with the shared rules; a city stored in an older shape is written in the current one.
 * The city is checked with parseState after catching up and after the action: refused, nothing is written.
 * Only the outcome and a hash of the action are kept, never the city.
 */
export async function applyPlayerAction(db: Db, playerId: string, action: GameAction, now: Date, speed: number, log?: DbLog): Promise<ActionOutcome> {
  const broken = (message: string) => {
    log?.error({ playerId, action: action.type }, message);
    return { kind: "broken" } as const;
  };
  return db.transaction(async (tx) => {
    await ensureCity(tx, playerId, now);
    const [row] = await tx.select().from(cities).where(eq(cities.playerId, playerId)).for("update");
    const stored = row ? migrateCity(row.state, row.shape) : null;
    if (!row || !stored) {
      log?.error({ playerId, version: row?.version, shape: row?.shape }, "Stored city refused by migrateCity");
      return { kind: "unreadable" } as const;
    }
    const current = catchUp(stored, gameSeconds(row.savedAt, now, speed));
    // Every answer carries the city: a city the rules made invalid is never sent, nor written.
    if (!parseState(current)) return broken("City refused by parseState after catching up");
    const unchanged: CityNow = { state: current, version: row.version, asOf: now };
    const hash = actionHash(action);

    const [seen] = await tx
      .select()
      .from(appliedActions)
      .where(and(eq(appliedActions.playerId, playerId), eq(appliedActions.actionId, action.id)));
    if (seen) {
      if (seen.actionHash !== hash) return { kind: "reused", city: unchanged } as const;
      return seen.ok
        ? ({ kind: "applied", replayed: true, city: unchanged } as const)
        : ({ kind: "refused", replayed: true, code: seen.code ?? RULE_REFUSED, error: seen.error ?? "", city: unchanged } as const);
    }

    const result = applyAction(current, action);
    if (!result.ok) {
      await tx.insert(appliedActions).values({ playerId, actionId: action.id, actionHash: hash, appliedAt: now, ok: false, code: RULE_REFUSED, error: result.reason });
      return { kind: "refused", replayed: false, code: RULE_REFUSED, error: result.reason, city: unchanged } as const;
    }
    // An action that changes nothing (a report already read) is kept by its id, but the city is not written again.
    if (result.state === current) {
      await tx.insert(appliedActions).values({ playerId, actionId: action.id, actionHash: hash, appliedAt: now, ok: true });
      return { kind: "applied", replayed: false, city: unchanged } as const;
    }
    if (!parseState(result.state)) return broken("City refused by parseState after an action");
    const version = row.version + 1;
    await tx.update(cities).set({ state: result.state, version, shape: CITY_SHAPE, savedAt: now }).where(eq(cities.playerId, playerId));
    // The player id and the two shapes only: never the city, never a wallet address.
    if (row.shape !== CITY_SHAPE) log?.info?.({ playerId, from: row.shape, to: CITY_SHAPE }, "Stored city written in the current shape");
    await tx.insert(appliedActions).values({ playerId, actionId: action.id, actionHash: hash, appliedAt: now, ok: true });
    return { kind: "applied", replayed: false, city: { state: result.state, version, asOf: now } } as const;
  });
}

/** Deletes the ids of actions applied more than 7 days ago (real time, never sped up). */
export async function purgeOldActions(db: Db, now: Date): Promise<number> {
  const rows = await db
    .delete(appliedActions)
    .where(lt(appliedActions.appliedAt, new Date(now.getTime() - ACTION_KEPT_MS)))
    .returning({ actionId: appliedActions.actionId });
  return rows.length;
}
