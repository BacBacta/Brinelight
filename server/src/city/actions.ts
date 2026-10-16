/**
 * POST /city/actions  one action ("upgrade the Refinery"), applied by the server with the shared rules.
 * Every answer that reaches the database carries the server's city, so the client can go back to it at once.
 */
import { parseAction } from "@brinelight/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requirePlayer } from "../auth/session.js";
import { applyPlayerAction, cityAt, ensureCity, loadCity, type CityNow, type Db } from "../db/index.js";
import { SERVER_ERROR, refusal } from "../refusals.js";
import { CITY_REFUSED } from "./routes.js";

/** An action is a few dozen bytes; the body may not be larger than this. */
export const ACTION_MAX_BYTES = 2048;
/** Actions allowed per minute and per player. */
export const ACTIONS_PER_MINUTE = 60;

export const ACTION_REFUSED = {
  invalid: refusal("invalid_action", "This action is not valid"),
  reused: refusal("action_id_reused", "This action was already sent with other content"),
  tooLarge: refusal("action_too_large", "This action is too large"),
  tooMany: refusal("too_many_actions", "Too many actions. Please wait a moment"),
} as const;

export type ActionRouteOptions = { db: Db; now: () => Date; speed: number };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export async function actionRoutes(app: FastifyInstance, { db, now, speed }: ActionRouteOptions): Promise<void> {
  const signedIn = requirePlayer(db, now);
  const cityBody = (c: CityNow) => ({ state: c.state, version: c.version, asOf: c.asOf.toISOString(), speed });

  /** The server's city as it is now, for an answer that applied nothing. Created if missing. */
  const currentCity = async (req: FastifyRequest): Promise<CityNow | null> => {
    const at = now();
    await ensureCity(db, req.playerId, at);
    const loaded = await loadCity(db, req.playerId, req.log);
    if (loaded.status !== "ok") return null;
    return { state: cityAt(loaded.city, at, speed), version: loaded.city.version, asOf: at };
  };
  const invalid = async (req: FastifyRequest, reply: FastifyReply) => {
    const city = await currentCity(req);
    if (!city) return reply.code(409).send(CITY_REFUSED.unreadable);
    return reply.code(400).send({ ...ACTION_REFUSED.invalid, ...cityBody(city) });
  };

  app.post(
    "/city/actions",
    {
      onRequest: signedIn,
      bodyLimit: ACTION_MAX_BYTES,
      config: {
        rateLimit: {
          max: ACTIONS_PER_MINUTE,
          timeWindow: 60_000,
          // Counted right after the session check, before the body is read: a flood never reaches the database.
          hook: "onRequest",
          keyGenerator: (req) => `actions:${req.playerId}`,
          errorResponseBuilder: () => ({ statusCode: 429, ...ACTION_REFUSED.tooMany }),
        },
      },
      // 413 and 429 never touch the database, so they carry no city: the client keeps its own and tries again.
      errorHandler: async (error: Error & { statusCode?: number }, req, reply) => {
        if (error.statusCode === 413) return reply.code(413).send(ACTION_REFUSED.tooLarge);
        if (error.statusCode === 429) return reply.code(429).send(ACTION_REFUSED.tooMany);
        if (error.statusCode === 400 || error.statusCode === 415) return invalid(req, reply);
        req.log.error(error);
        return reply.code(500).send(SERVER_ERROR);
      },
    },
    async (req, reply) => {
      const body = req.body;
      const action = isObj(body) && Object.keys(body).length === 1 && "action" in body ? parseAction(body.action) : null;
      if (!action) return invalid(req, reply);

      const outcome = await applyPlayerAction(db, req.playerId, action, now(), speed, req.log);
      switch (outcome.kind) {
        case "unreadable":
          return reply.code(409).send(CITY_REFUSED.unreadable);
        case "broken":
          return reply.code(500).send(SERVER_ERROR);
        case "reused":
          return reply.code(409).send({ ...ACTION_REFUSED.reused, ...cityBody(outcome.city) });
        case "refused":
          return reply
            .code(422)
            .send({ code: outcome.code, error: outcome.error, ...cityBody(outcome.city), ...(outcome.replayed ? { replayed: true } : {}) });
        case "applied":
          return { ...cityBody(outcome.city), ...(outcome.replayed ? { replayed: true } : {}) };
      }
    },
  );
}
