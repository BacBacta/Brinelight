import { fileURLToPath } from "node:url";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema.js";

/** The database, whichever engine runs it: the same Drizzle API for PostgreSQL and PGlite. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type Database = {
  db: Db;
  /** "postgres" in production, "pglite" for tests and local development. */
  engine: "postgres" | "pglite";
  close(): Promise<void>;
};

const MIGRATIONS = fileURLToPath(new URL("../../drizzle", import.meta.url));

/**
 * Opens the database and applies the committed migrations (server/drizzle/).
 * DATABASE_URL set: a real PostgreSQL, through pg. Not set: PGlite, in memory, loaded only then
 * (it is a development dependency, never used in production).
 */
export async function openDatabase(url: string | undefined = process.env.DATABASE_URL): Promise<Database> {
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return { db: db as unknown as Db, engine: "postgres", close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return { db: db as unknown as Db, engine: "pglite", close: () => client.close() };
}

export * from "./players.js";
export * from "./sessions.js";
export * from "./cities.js";
export * from "./actions.js";
export { schema };
