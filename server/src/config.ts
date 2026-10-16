/** Server settings, read once from the environment. */
export type Config = {
  /** Origins allowed to call the server and to sign in, e.g. "https://brinelight.pages.dev". */
  allowedOrigins: string[];
  /** The Solana chain a sign-in message must name ("mainnet", "devnet"…). */
  chainId: string;
  /** The single proxy (Caddy) trusted for X-Forwarded-For; none by default. */
  trustedProxy: string | null;
  databaseUrl: string | undefined;
  /**
   * How much faster the cities' game time runs than real time, for development (DEV_SPEED, 1 by default).
   * It changes only the time a city advances by: never sessions, nonces, rate limits or the purge.
   */
  devSpeed: number;
};

/**
 * Reads the settings. In production (NODE_ENV=production) the server refuses to start without DATABASE_URL
 * and ALLOWED_ORIGINS: without a database address it would keep the cities in memory and lose them on restart.
 * It also refuses a DEV_SPEED other than 1 in production, and a DEV_SPEED that is not a number above 0.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const production = env.NODE_ENV === "production";
  if (production) {
    const missing = ["DATABASE_URL", "ALLOWED_ORIGINS"].filter((k) => !env[k]?.trim());
    if (missing.length) throw new Error(`Missing setting in production: ${missing.join(", ")}`);
  }
  const speedText = env.DEV_SPEED?.trim();
  const devSpeed = speedText ? Number(speedText) : 1;
  if (!Number.isFinite(devSpeed) || devSpeed <= 0) throw new Error(`DEV_SPEED must be a number above 0 (found "${speedText}")`);
  if (production && devSpeed !== 1) throw new Error("DEV_SPEED must be 1 in production");
  const origins = (env.ALLOWED_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return {
    allowedOrigins: origins,
    chainId: env.SIWS_CHAIN_ID?.trim() || "mainnet",
    trustedProxy: env.TRUSTED_PROXY?.trim() || null,
    databaseUrl: env.DATABASE_URL || undefined,
    devSpeed,
  };
}
