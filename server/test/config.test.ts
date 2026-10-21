import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("settings", () => {
  it("development: defaults for a local game, and no database address (PGlite in memory)", () => {
    expect(loadConfig({})).toEqual({ allowedOrigins: ["http://localhost:5173"], chainId: "mainnet", trustedProxy: null, databaseUrl: undefined, devSpeed: 1, statusDir: null });
  });

  it("reads the online settings", () => {
    const c = loadConfig({
      ALLOWED_ORIGINS: "https://play.example.com",
      SIWS_CHAIN_ID: "devnet",
      TRUSTED_PROXY: "172.30.0.10",
      DATABASE_URL: "postgres://u:p@db:5432/b",
    });
    expect(c).toEqual({ allowedOrigins: ["https://play.example.com"], chainId: "devnet", trustedProxy: "172.30.0.10", databaseUrl: "postgres://u:p@db:5432/b", devSpeed: 1, statusDir: null });
  });

  it("HEALTH_STATUS_DIR: the folder of the backups' and restores' status, none by default", () => {
    expect(loadConfig({ HEALTH_STATUS_DIR: "/status" }).statusDir).toBe("/status");
    expect(loadConfig({ HEALTH_STATUS_DIR: " " }).statusDir).toBeNull();
  });

  it("DEV_SPEED: 1 by default, a number above 0 in development", () => {
    expect(loadConfig({ DEV_SPEED: "60" }).devSpeed).toBe(60);
    expect(loadConfig({ DEV_SPEED: " 2.5 " }).devSpeed).toBe(2.5);
    expect(loadConfig({ DEV_SPEED: "" }).devSpeed).toBe(1);
    for (const bad of ["0", "-3", "fast", "Infinity", "NaN"]) {
      expect(() => loadConfig({ DEV_SPEED: bad }), bad).toThrow("DEV_SPEED must be a number above 0");
    }
  });

  it("production refuses a DEV_SPEED other than 1", () => {
    const prod = { NODE_ENV: "production", DATABASE_URL: "postgres://x", ALLOWED_ORIGINS: "https://play.example.com" };
    expect(() => loadConfig({ ...prod, DEV_SPEED: "60" })).toThrow("DEV_SPEED must be 1 in production");
    expect(() => loadConfig({ ...prod, DEV_SPEED: "0.5" })).toThrow("DEV_SPEED must be 1 in production");
    expect(loadConfig({ ...prod, DEV_SPEED: "1" }).devSpeed).toBe(1);
    expect(loadConfig(prod).devSpeed).toBe(1);
  });

  it("production refuses to start without a database address or allowed origins", () => {
    expect(() => loadConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "https://play.example.com" })).toThrow("Missing setting in production: DATABASE_URL");
    expect(() => loadConfig({ NODE_ENV: "production", DATABASE_URL: " " })).toThrow("DATABASE_URL, ALLOWED_ORIGINS");
    expect(loadConfig({ NODE_ENV: "production", DATABASE_URL: "postgres://x", ALLOWED_ORIGINS: "https://play.example.com" }).databaseUrl).toBe("postgres://x");
  });
});
