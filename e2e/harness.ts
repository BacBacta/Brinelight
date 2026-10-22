/**
 * Starts everything the end-to-end tests need, in this process: the server on PGlite, the client built
 * with VITE_API_URL pointing to it (into e2e/.dist, never client/dist), served by vite preview, and Chromium.
 */
import { createServer, request, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";
import { build, preview, type PreviewServer } from "vite";
import { buildApp } from "../server/src/app.js";
import { loadConfig } from "../server/src/config.js";
import { CITY_SHAPE } from "@brinelight/shared";
import { sql } from "drizzle-orm";
import { openDatabase, schema, type Database } from "../server/src/db/index.js";
import { loadNotary } from "../server/src/proofs/key.js";
import { makeNotaryKey } from "../server/src/proofs/keygen.js";
import { createRpc } from "../server/src/proofs/rpc.js";
import { createNotaryService } from "../server/src/proofs/seal.js";
import { fakeSolana, type FakeSolana } from "../server/test/fakeSolana.js";

export const API = "http://127.0.0.1:8797";
const API_BEHIND = 8798;
/** The CORS check (preflight) is held this long, so that only a keepalive request can outlive a page going away. */
export const SLOW_PREFLIGHT_MS = 800;
export const GAME = "http://127.0.0.1:4173";
const CLIENT = fileURLToPath(new URL("../client", import.meta.url));
const OUT = fileURLToPath(new URL("./.dist", import.meta.url));

export type Harness = {
  browser: Browser;
  /**
   * Tests only: puts a city for a test account straight into the database this harness opened itself, saved now,
   * one version up. Never a server route, option or setting: nothing of it can exist in production.
   */
  putCity(playerId: string, state: unknown): Promise<void>;
  /**
   * Tests only: the server's notary signs with a throwaway key on a fake Solana network (server/test/fakeSolana.ts),
   * never a real one. `seal` plays the night that follows `day` (00:15 UTC the next day), then finalizes it.
   */
  notary: { address: string; chain: FakeSolana; seal(day: Date): Promise<void> };
  close(): Promise<void>;
};

/** How long the relay holds each action (POST /city/actions) before passing it on: a slow server. 0: not held. */
let actionDelayMs = 0;
export const holdActions = (ms: number): void => {
  actionDelayMs = ms;
};

export async function startHarness(): Promise<Harness> {
  const database: Database = await openDatabase(undefined);
  const config = loadConfig({ ALLOWED_ORIGINS: GAME });
  const chain = fakeSolana("devnet");
  const loaded = loadNotary({ SOLANA_CLUSTER: "devnet", NOTARY_KEY_DEVNET: makeNotaryKey().secret });
  if (loaded.status !== "on") throw new Error(loaded.reason);
  chain.balances.set(loaded.key.address, 20_000_000);
  const notary = createNotaryService(database.db, loaded.key, createRpc("devnet", { urls: ["https://api.devnet.solana.com"], fetch: chain.fetch, wait: async () => {} }));
  const server = await buildApp({ db: database.db, config, notary });
  await server.listen({ port: API_BEHIND, host: "127.0.0.1" });
  const relay = slowPreflightRelay();
  await new Promise<void>((resolve) => relay.listen(8797, "127.0.0.1", resolve));

  process.env.VITE_API_URL = API;
  await build({ root: CLIENT, mode: "production", logLevel: "warn", build: { outDir: OUT, emptyOutDir: true } });
  delete process.env.VITE_API_URL;
  const site: PreviewServer = await preview({ root: CLIENT, logLevel: "warn", build: { outDir: OUT }, preview: { port: 4173, host: "127.0.0.1", strictPort: true } });

  const browser = await chromium.launch();
  return {
    browser,
    notary: {
      address: loaded.key.address,
      chain,
      async seal(day) {
        const next = Math.floor(day.getTime() / 86_400_000 + 1) * 86_400_000;
        await notary.tick(new Date(next + 15 * 60_000));
        chain.advance(40);
        await notary.tick(new Date(next + 20 * 60_000));
      },
    },
    async putCity(playerId, state) {
      const savedAt = new Date();
      await database.db
        .insert(schema.cities)
        .values({ playerId, state, version: 1, shape: CITY_SHAPE, savedAt })
        .onConflictDoUpdate({ target: schema.cities.playerId, set: { state, savedAt, shape: CITY_SHAPE, version: sql`${schema.cities.version} + 1` } });
    },
    async close() {
      const step = async (name: string, f: () => Promise<unknown>) => {
        const t = Date.now();
        await f();
        if (process.env.E2E_DEBUG) console.log(`closed ${name} in ${Date.now() - t} ms`);
      };
      await step("browser", () => browser.close());
      for (const [name, http] of [["site", site.httpServer as Server], ["relay", relay]] as const) {
        await step(name, async () => {
          http.closeAllConnections();
          await new Promise<void>((resolve) => http.close(() => resolve()));
        });
      }
      await step("server", async () => {
        server.server.closeAllConnections();
        await server.close();
      });
      await step("database", () => database.close());
    },
  };
}

/**
 * Passes every request to the server unchanged, but holds each CORS preflight (OPTIONS) for SLOW_PREFLIGHT_MS,
 * and each action for the time given to holdActions.
 */
function slowPreflightRelay(): Server {
  return createServer((req, res) => {
    const forward = () => {
      // agent: false, one connection per request, so nothing stays open when the tests end.
      const up = request({ host: "127.0.0.1", port: API_BEHIND, path: req.url, method: req.method, headers: req.headers, agent: false }, (answer) => {
        res.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(res);
      });
      up.on("error", () => res.destroy());
      req.pipe(up);
    };
    if (req.method === "OPTIONS") setTimeout(forward, SLOW_PREFLIGHT_MS);
    else if (req.method === "POST" && req.url === "/city/actions" && actionDelayMs > 0) setTimeout(forward, actionDelayMs);
    else forward();
  });
}
