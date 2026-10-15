import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** End-to-end tests (npm run e2e): the real server on PGlite, the built client, and Chromium. Not part of npm run check. */
export default defineConfig({
  test: {
    root: fileURLToPath(new URL("..", import.meta.url)),
    include: ["e2e/**/*.e2e.ts"],
    environment: "node",
    testTimeout: 90_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
