import { catchUp, newPlayerState, parseState, type PlayerState } from "@brinelight/shared";
import { eq } from "drizzle-orm";
import type { Db } from "./index.js";
import { cities } from "./schema.js";

/** Where the database functions report problems; the server passes its logger. Never given a city, only ids. */
export type DbLog = { error(fields: Record<string, unknown>, message: string): void };

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

/**
 * Creates the player's city if it is missing: a new city made by the server from the shared starting values,
 * at version 1. Does nothing when the city exists. The only place a city is created for a player who has none
 * (GET /city, or an action).
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

/**
 * A stored city advanced to `now`, checked with parseState before it is sent. Null when refused (the rules made it
 * invalid on the way): logged with the player id only, never the city. Nothing is stored.
 */
export function checkedCityAt(city: StoredCity, now: Date, speed: number, playerId: string, log?: DbLog): PlayerState | null {
  const state = cityAt(city, now, speed);
  if (parseState(state)) return state;
  log?.error({ playerId }, "City refused by parseState after catching up");
  return null;
}
