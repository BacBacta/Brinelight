import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("settings", () => {
  it("development: defaults for a local game, and no database address (PGlite in memory)", () => {
    expect(loadConfig({})).toEqual({ allowedOrigins: ["http://localhost:5173"], chainId: "mainnet", trustedProxy: null, databaseUrl: undefined });
  });

  it("reads the online settings", () => {
    const c = loadConfig({
      ALLOWED_ORIGINS: "https://play.example.com",
      SIWS_CHAIN_ID: "devnet",
      TRUSTED_PROXY: "172.30.0.10",
      DATABASE_URL: "postgres://u:p@db:5432/b",
    });
    expect(c).toEqual({ allowedOrigins: ["https://play.example.com"], chainId: "devnet", trustedProxy: "172.30.0.10", databaseUrl: "postgres://u:p@db:5432/b" });
  });

  it("production refuses to start without a database address or allowed origins", () => {
    expect(() => loadConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "https://play.example.com" })).toThrow("Missing setting in production: DATABASE_URL");
    expect(() => loadConfig({ NODE_ENV: "production", DATABASE_URL: " " })).toThrow("DATABASE_URL, ALLOWED_ORIGINS");
    expect(loadConfig({ NODE_ENV: "production", DATABASE_URL: "postgres://x", ALLOWED_ORIGINS: "https://play.example.com" }).databaseUrl).toBe("postgres://x");
  });
});
