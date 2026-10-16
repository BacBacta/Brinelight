/** Server settings, read once from the environment. */
export type Config = {
  /** Origins allowed to call the server and to sign in, e.g. "https://brinelight.pages.dev". */
  allowedOrigins: string[];
  /** The Solana chain a sign-in message must name ("mainnet", "devnet"…). */
  chainId: string;
  /** The single proxy (Caddy) trusted for X-Forwarded-For; none by default. */
  trustedProxy: string | null;
  databaseUrl: string | undefined;
};

/**
 * Reads the settings. In production (NODE_ENV=production) the server refuses to start without DATABASE_URL
 * and ALLOWED_ORIGINS: without a database address it would keep the cities in memory and lose them on restart.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  if (env.NODE_ENV === "production") {
    const missing = ["DATABASE_URL", "ALLOWED_ORIGINS"].filter((k) => !env[k]?.trim());
    if (missing.length) throw new Error(`Missing setting in production: ${missing.join(", ")}`);
  }
  const origins = (env.ALLOWED_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return {
    allowedOrigins: origins,
    chainId: env.SIWS_CHAIN_ID?.trim() || "mainnet",
    trustedProxy: env.TRUSTED_PROXY?.trim() || null,
    databaseUrl: env.DATABASE_URL || undefined,
  };
}
