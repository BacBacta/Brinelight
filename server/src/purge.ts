import type { FastifyInstance } from "fastify";
import { purgeExpired, type Db } from "./db/index.js";

export const PURGE_MS = 3600_000;

/**
 * Deletes old nonces and sessions every hour. The timer never keeps the process alive (unref),
 * and it stops when the server closes.
 */
export function schedulePurge(app: FastifyInstance, db: Db, now: () => Date = () => new Date(), everyMs = PURGE_MS): NodeJS.Timeout {
  const timer = setInterval(() => {
    purgeExpired(db, now()).catch((err: unknown) => app.log.error({ err }, "purge failed"));
  }, everyMs);
  timer.unref();
  app.addHook("onClose", async () => clearInterval(timer));
  return timer;
}
