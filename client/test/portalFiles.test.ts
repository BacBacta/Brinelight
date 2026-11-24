import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** What CrazyGames asks of the files (docs.crazygames.com/requirements/technical, read on 24 November 2026). */
const MAX_BYTES = 20 * 1024 * 1024; // the mobile home page; 50 MB without their SDK
const MAX_FILES = 1500;
/** Web addresses three.js carries as text (an XML namespace, a warning): no link, no request. */
const KNOWN_ADDRESSES = [/^http:\/\/www\.w3\.org\//, /^https:\/\/discourse\.threejs\.org\//];

let out = "";
const files: string[] = [];
const text = (exts: string[]) => files.filter((f) => exts.some((e) => f.endsWith(e))).map((f) => [f, readFileSync(join(out, f), "utf8")] as const);

beforeAll(async () => {
  out = mkdtempSync(join(tmpdir(), "brinelight-portal-"));
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = "production"; // Vitest's own, "test", would make a development build.
  try {
    await build({ root: new URL("..", import.meta.url).pathname, mode: "portal", logLevel: "silent", build: { outDir: out, emptyOutDir: true } });
  } finally {
    process.env.NODE_ENV = saved;
  }
  files.push(...readdirSync(out, { recursive: true, encoding: "utf8" }).filter((f) => statSync(join(out, f)).isFile()));
}, 180_000);
afterAll(() => rmSync(out, { recursive: true, force: true }));

describe("the portal's files, as CrazyGames takes them", () => {
  it(`under ${MAX_FILES} files and 20 MB, without the prototype`, () => {
    const bytes = files.reduce((n, f) => n + statSync(join(out, f)).size, 0);
    expect(files.length).toBeLessThan(MAX_FILES);
    expect(bytes).toBeLessThan(MAX_BYTES);
    expect(files.some((f) => f.startsWith("prototype"))).toBe(false);
  });

  it("only relative addresses: the page's, and the code's own folders", () => {
    const page = readFileSync(join(out, "index.html"), "utf8");
    for (const [, ref] of page.matchAll(/(?:src|href)="([^"]+)"/g)) expect(ref, ref).toMatch(/^(\.\/|data:)/);
    for (const [f, t] of text([".js", ".css"])) expect(t, f).not.toMatch(/["'`(]\/(assets|models|city|icons|sounds|captains|prototype)\//);
  });

  it("not a word of the wallet, Solana or a server; no web address but what three.js carries as text", () => {
    // The code and the page. The shared style sheet keeps the Profile's class names (".wallet"), never shown.
    for (const [f, t] of text([".js", ".html"])) expect(t, f).not.toMatch(/wallet|solana|phantom|usdc|notary|\/auth\/|VITE_API_URL|127\.0\.0\.1|localhost/i);
    for (const [f, t] of text([".js", ".css", ".html"])) {
      for (const [address] of t.matchAll(/https?:\/\/[^\s"'`)]+/g)) expect(KNOWN_ADDRESSES.some((k) => k.test(address)), `${f}: ${address}`).toBe(true);
    }
  });
});
