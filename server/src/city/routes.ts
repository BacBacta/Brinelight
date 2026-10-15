/**
 * GET /city  the player's city, advanced to now with the server clock.
 * PUT /city  saves the city the client sends (temporary, removed in week 4).
 */
import { catchUp } from "@brinelight/shared";
import type { FastifyInstance } from "fastify";
import { requirePlayer } from "../auth/session.js";
import { createCity, loadCity, saveCity, type Db } from "../db/index.js";
import { SERVER_ERROR, refusal } from "../refusals.js";
import { readSentCity } from "./check.js";

export const CITY_MAX_BYTES = 64 * 1024;
/** Saves allowed per minute and per player. */
export const SAVES_PER_MINUTE = 6;

export const CITY_REFUSED = {
  conflict: refusal("version_conflict", "Your city changed on another device"),
  unreadable: refusal("unreadable_city", "Your saved city could not be read"),
  invalid: refusal("invalid_city", "This city is not valid"),
  tooLarge: refusal("city_too_large", "This city is too large"),
  tooMany: refusal("too_many_saves", "Too many saves. Please wait a minute"),
} as const;

export type CityOptions = { db: Db; now: () => Date };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export async function cityRoutes(app: FastifyInstance, { db, now }: CityOptions): Promise<void> {
  const signedIn = requirePlayer(db, now);

  // Nothing is created or stored here: two reads in a row give the same city.
  app.get("/city", { onRequest: signedIn }, async (req, reply) => {
    const loaded = await loadCity(db, req.playerId, req.log);
    if (loaded.status === "missing") return { city: null };
    if (loaded.status === "unreadable") return reply.code(409).send(CITY_REFUSED.unreadable);
    const asOf = now();
    const { state, version, savedAt } = loaded.city;
    return {
      state: catchUp(state, (asOf.getTime() - savedAt.getTime()) / 1000),
      version,
      savedAt: savedAt.toISOString(),
      asOf: asOf.toISOString(),
    };
  });

  /*
   * TEMPORARY, REMOVED IN WEEK 4. This route trusts the city the client sends, which goes against
   * "the server decides" (CLAUDE.md). It is accepted for week 3 only, so that a player can find their city
   * on another device; week 4 replaces it with actions checked by the server. See docs/decisions.md.
   */
  app.put(
    "/city",
    {
      onRequest: signedIn,
      bodyLimit: CITY_MAX_BYTES,
      config: {
        rateLimit: {
          max: SAVES_PER_MINUTE,
          timeWindow: 60_000,
          hook: "preHandler",
          keyGenerator: (req) => `city:${req.playerId}`,
          errorResponseBuilder: () => ({ statusCode: 429, ...CITY_REFUSED.tooMany }),
        },
      },
      errorHandler: (error: Error & { statusCode?: number }, req, reply) => {
        if (error.statusCode === 413) return reply.code(413).send(CITY_REFUSED.tooLarge);
        if (error.statusCode === 429) return reply.code(429).send(CITY_REFUSED.tooMany);
        if (error.statusCode === 400 || error.statusCode === 415) return reply.code(400).send(CITY_REFUSED.invalid);
        req.log.error(error);
        return reply.code(500).send(SERVER_ERROR);
      },
    },
    async (req, reply) => {
      const body = req.body;
      if (!isObj(body) || Object.keys(body).sort().join() !== "state,version") return reply.code(400).send(CITY_REFUSED.invalid);
      const version = body.version;
      if (typeof version !== "number" || !Number.isInteger(version) || version < 0) return reply.code(400).send(CITY_REFUSED.invalid);
      const state = readSentCity(body.state);
      if (!state) return reply.code(400).send(CITY_REFUSED.invalid);

      // A stored city that cannot be read is never replaced.
      const stored = await loadCity(db, req.playerId, req.log);
      if (stored.status === "unreadable") return reply.code(409).send(CITY_REFUSED.unreadable);

      const at = now();
      const saved = version === 0 ? await createCity(db, req.playerId, state, at) : await saveCity(db, req.playerId, state, version, at);
      if (!saved.ok) return reply.code(409).send(CITY_REFUSED.conflict);
      return { version: saved.version, savedAt: at.toISOString() };
    },
  );
}
