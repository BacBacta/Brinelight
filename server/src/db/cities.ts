import { catchUp, newPlayerState, parseState, type PlayerState } from "@brinelight/shared";
import { and, eq } from "drizzle-orm";
import type { Db } from "./index.js";
import { cities } from "./schema.js";

/** Where the database functions report problems; the server passes its logger. Never given a city, only ids. */
export type DbLog = { error(fields: Record<string, unknown>, message: string): void };

export const CHANGED_ELSEWHERE = "Your city changed on another device";
export const UNREADABLE = "Your saved city could not be read";

export type StoredCity = { state: PlayerState; version: number; savedAt: Date };

export type LoadedCity =
  | { status: "ok"; city: StoredCity }
  | { status: "missing" }
  /** The stored city exists but parseState refuses it: it is left as it is, never replaced by a new city. */
  | { status: "unreadable"; reason: string };

/** Reads a player's city with parseState. An unreadable city is logged with the player id (not the city) and left intact. */
export async function loadCity(db: Db, playerId: string, log?: DbLog): Promise<LoadedCity> {
  const [row] = await db.select().from(cities).where(eq(cities.playerId, playerId));
  if (!row) return { status: "missing" };
  const state = parseState(row.state);
  if (!state) {
    log?.error({ playerId, version: row.version }, "Stored city refused by parseState");
    return { status: "unreadable", reason: UNREADABLE };
  }
  return { status: "ok", city: { state, version: row.version, savedAt: row.savedAt } };
}

export type SavedCity = { ok: true; version: number } | { ok: false; reason: string };

/** Stores the first city of a player, at version 1. Refused if the city is invalid or the player already has one. */
export async function createCity(db: Db, playerId: string, raw: unknown, now: Date): Promise<SavedCity> {
  const state = parseState(raw);
  if (!state) return { ok: false, reason: "This city is not valid" };
  const rows = await db.insert(cities).values({ playerId, state, version: 1, savedAt: now }).onConflictDoNothing().returning({ version: cities.version });
  return rows.length ? { ok: true, version: 1 } : { ok: false, reason: CHANGED_ELSEWHERE };
}

/**
 * Saves a city over the version it started from. The version goes up by one; a save from an older version
 * is refused, so two devices saving at once cannot overwrite each other.
 */
export async function saveCity(db: Db, playerId: string, raw: unknown, fromVersion: number, now: Date): Promise<SavedCity> {
  const state = parseState(raw);
  if (!state) return { ok: false, reason: "This city is not valid" };
  if (!Number.isInteger(fromVersion)) return { ok: false, reason: CHANGED_ELSEWHERE };
  const rows = await db
    .update(cities)
    .set({ state, version: fromVersion + 1, savedAt: now })
    .where(and(eq(cities.playerId, playerId), eq(cities.version, fromVersion)))
    .returning({ version: cities.version });
  return rows.length ? { ok: true, version: rows[0]!.version } : { ok: false, reason: CHANGED_ELSEWHERE };
}

/**
 * Creates the player's city if it is missing: a new city made by the server from the shared starting values,
 * at version 1. Does nothing when the city exists. The only place a city is created for a player who has none
 * (an action now; GET /city from week 4, task 4).
 */
export async function ensureCity(db: Db, playerId: string, now: Date): Promise<void> {
  await db.insert(cities).values({ playerId, state: newPlayerState(), version: 1, savedAt: now }).onConflictDoNothing();
}

/**
 * The game time a city advances by between `savedAt` and `now`: real seconds times the development speed.
 * Only the city's game time is sped up, never sessions, nonces, rate limits or the purge.
 */
export const gameSeconds = (savedAt: Date, now: Date, speed: number): number => Math.max(0, (now.getTime() - savedAt.getTime()) / 1000) * speed;

/** A stored city advanced to `now`, as the server shows it. Nothing is stored. */
export const cityAt = (city: StoredCity, now: Date, speed: number): PlayerState => catchUp(city.state, gameSeconds(city.savedAt, now, speed));
