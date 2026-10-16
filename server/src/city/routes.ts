/**
 * GET /city  the player's city, advanced to now with the server clock (and the development speed).
 * A new account gets its city here, made by the server: a city played without an account is never imported.
 * The city changes only through actions (POST /city/actions, ./actions.ts).
 */
import type { FastifyInstance } from "fastify";
import { requirePlayer } from "../auth/session.js";
import { checkedCityAt, ensureCity, loadCity, type Db } from "../db/index.js";
import { SERVER_ERROR, refusal } from "../refusals.js";

export const CITY_REFUSED = {
  unreadable: refusal("unreadable_city", "Your saved city could not be read"),
} as const;

export type CityOptions = {
  db: Db;
  now: () => Date;
  /** DEV_SPEED: how much faster a city's game time runs than real time (1 in production). */
  speed: number;
};

export async function cityRoutes(app: FastifyInstance, { db, now, speed }: CityOptions): Promise<void> {
  const signedIn = requirePlayer(db, now);

  // The first call of a new account makes its city (ensureCity); after that, reading stores nothing.
  app.get("/city", { onRequest: signedIn }, async (req, reply) => {
    const asOf = now();
    await ensureCity(db, req.playerId, asOf);
    const loaded = await loadCity(db, req.playerId, req.log);
    if (loaded.status === "unreadable") return reply.code(409).send(CITY_REFUSED.unreadable);
    if (loaded.status === "missing") return reply.code(500).send(SERVER_ERROR);
    // A city the rules made invalid while catching up is never sent.
    const state = checkedCityAt(loaded.city, asOf, speed, req.playerId, req.log);
    if (!state) return reply.code(500).send(SERVER_ERROR);
    const { version, savedAt } = loaded.city;
    return {
      state,
      version,
      savedAt: savedAt.toISOString(),
      asOf: asOf.toISOString(),
      speed,
    };
  });
}
