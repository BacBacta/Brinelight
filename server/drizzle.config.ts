import { defineConfig } from "drizzle-kit";

/** Used only to generate migrations (npm run db:generate -w server); no database is needed for that. */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
