/**
 * Week 1: a minimal server that answers with the shared rules.
 * Week 3: database, wallet sign-in, validated actions.
 * Principle to keep: the client sends intentions, the server decides with @brinelight/shared.
 */
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyServerOptions } from "fastify";
import { BUILDING_IDS, upgradeCost, upgradeTime, type BuildingId } from "@brinelight/shared";
import { authRoutes, REFUSED } from "./auth/routes.js";
import { loadConfig, type Config } from "./config.js";
import type { Db } from "./db/index.js";

export type AppOptions = {
  /** Without a database, only /health and /rules are served. */
  db?: Db;
  config?: Config;
  now?: () => Date;
  /** Pino options; the Authorization header is always redacted. False (the default) logs nothing. */
  logger?: false | Exclude<FastifyServerOptions["logger"], boolean | undefined>;
};

/** Never written to a log: the session token travels in this header. */
export const REDACTED = ["req.headers.authorization", "headers.authorization"];

export const TOO_MANY = "Too many sign-in attempts. Please wait a minute and try again";

export async function buildApp(options: AppOptions = {}) {
  const config = options.config ?? loadConfig({});
  const app = Fastify({
    logger: options.logger ? { ...options.logger, redact: { paths: REDACTED } } : false,
    // Only the configured proxy may say who the player is (X-Forwarded-For); anyone else is ignored.
    trustProxy: config.trustedProxy ?? false,
    // A request with an unexpected field is refused, not silently trimmed.
    ajv: { customOptions: { removeAdditional: false } },
  });

  await app.register(cors, {
    origin: config.allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => ({ statusCode: 429, error: TOO_MANY }),
  });

  app.setErrorHandler((error: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    if (error.statusCode === 429) return reply.code(429).send({ error: TOO_MANY });
    if (error.validation || error.statusCode === 400 || error.statusCode === 415) return reply.code(400).send({ error: REFUSED.request });
    req.log.error(error);
    return reply.code(500).send({ error: "Something went wrong on the server. Please try again" });
  });

  app.get("/health", async () => ({ ok: true, service: "brinelight", version: "0.1.0" }));

  app.get<{ Params: { id: string; level: string } }>("/rules/buildings/:id/:level", async (req, reply) => {
    const id = req.params.id as BuildingId;
    const level = Number(req.params.level);
    if (!BUILDING_IDS.includes(id)) return reply.code(404).send({ error: "Unknown building" });
    if (!Number.isInteger(level) || level < 0 || level > 60) return reply.code(400).send({ error: "Invalid level" });
    return { id, level, cost: upgradeCost(id, level), seconds: upgradeTime(id, level) };
  });

  if (options.db) await authRoutes(app, { db: options.db, config, now: options.now ?? (() => new Date()) });

  return app;
}
