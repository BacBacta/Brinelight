/**
 * The files that use TEST_DATABASE_URL empty tables: they run only on a database that is clearly a test one, on this machine.
 * Throws otherwise, before anything is touched.
 */
export function checkTestDatabaseUrl(url: string): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid address");
  }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) throw new Error(`TEST_DATABASE_URL must point to this machine (localhost or 127.0.0.1), not "${host}"`);
  const name = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!name.includes("test")) throw new Error(`TEST_DATABASE_URL must name a database whose name contains "test", not "${name}"`);
}
