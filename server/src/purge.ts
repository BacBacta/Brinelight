import type { FastifyInstance } from "fastify";
import { purgeExpired, purgeOldActions, type Db } from "./db/index.js";

export const PURGE_MS = 3600_000;

/**
 * Deletes old nonces, sessions and action ids every hour, on real time (never sped up by DEV_SPEED).
 * The timer never keeps the process alive (unref), and it stops when the server closes.
 */
export function schedulePurge(app: FastifyInstance, db: Db, now: () => Date = () => new Date(), everyMs = PURGE_MS): NodeJS.Timeout {
  const timer = setInterval(() => {
    const at = now();
    Promise.all([purgeExpired(db, at), purgeOldActions(db, at)]).catch((err: unknown) => app.log.error({ err }, "purge failed"));
  }, everyMs);
  timer.unref();
  app.addHook("onClose", async () => clearInterval(timer));
  return timer;
}
