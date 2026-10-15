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

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
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
