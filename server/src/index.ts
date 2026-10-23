import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db/index.js";
import { loadNotary } from "./proofs/key.js";
import { createRpc, endpointName, rpcUrls } from "./proofs/rpc.js";
import { createNotaryService, scheduleSeals } from "./proofs/seal.js";
import { schedulePurge } from "./purge.js";

// The notary's key first: it leaves the environment at once (proofs/key.ts).
const loadedNotary = loadNotary(process.env);
const config = loadConfig();
const port = Number(process.env.PORT ?? 8787);
const database = await openDatabase(config.databaseUrl);
const notary =
  loadedNotary.status === "on"
    ? createNotaryService(database.db, loadedNotary.key, createRpc(loadedNotary.key.cluster, { urls: rpcUrls(loadedNotary.key.cluster, process.env.SOLANA_RPC_URLS) }))
    : null;
const app = await buildApp({ db: database.db, config, logger: { level: "info" }, notary });

if (notary) {
  app.log.info({ cluster: notary.key.cluster, address: notary.key.address, rpc: rpcUrls(notary.key.cluster, process.env.SOLANA_RPC_URLS).map(endpointName) }, "The notary seals every night at 00:15 UTC");
  scheduleSeals(app, notary);
} else if (loadedNotary.status === "off") {
  app.log.info({}, loadedNotary.reason);
}
schedulePurge(app, database.db);
app.addHook("onClose", () => database.close());
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => void app.close());

await app.listen({ port, host: "0.0.0.0" });
