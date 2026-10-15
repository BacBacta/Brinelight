import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db/index.js";
import { schedulePurge } from "./purge.js";

const config = loadConfig();
const port = Number(process.env.PORT ?? 8787);
const database = await openDatabase(config.databaseUrl);
const app = await buildApp({ db: database.db, config, logger: { level: "info" } });

schedulePurge(app, database.db);
app.addHook("onClose", () => database.close());
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => void app.close());

await app.listen({ port, host: "0.0.0.0" });
