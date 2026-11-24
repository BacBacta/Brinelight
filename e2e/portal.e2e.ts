/**
 * The portal's build (Hold the Light), served from a folder of its own as CrazyGames does: it opens with no error,
 * fetches nothing outside its folder, and keeps what it saves under its own key. No server, no account.
 */
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CLIENT = fileURLToPath(new URL("../client", import.meta.url));
const OUT = fileURLToPath(new URL("./.dist-portal", import.meta.url));
const FOLDER = "/games/brinelight-hold-the-light/";
const PORT = 4183;
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".mp3": "audio/mpeg", ".woff2": "font/woff2" };

let server: Server;
let browser: Browser;
const outside: string[] = [];

beforeAll(async () => {
  await build({ root: CLIENT, mode: "portal", logLevel: "warn", build: { outDir: OUT, emptyOutDir: true } });
  server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]!);
    if (!path.startsWith(FOLDER)) {
      outside.push(path);
      res.writeHead(404).end();
      return;
    }
    const file = join(OUT, path.slice(FOLDER.length) || "index.html");
    readFile(file).then(
      (body) => res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body),
      () => res.writeHead(404).end(),
    );
  });
  await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  browser = await chromium.launch(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {});
});

afterAll(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

describe("the portal, from a folder of its own", () => {
  it("opens the city with no error, fetches nothing outside its folder, saves under brinelight-portal-v1/", async () => {
    const context = await browser.newContext({ viewport: { width: 907, height: 510 } });
    const page = await context.newPage();
    const errors: string[] = [];
    const failed: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
    await page.goto(`http://127.0.0.1:${PORT}${FOLDER}`);
    await page.waitForSelector("canvas[data-view]", { timeout: 60_000 });
    expect(await page.title()).toBe("Brinelight: Hold the Light");
    // A tap on the Power card (a plain click can land on the 3D view that lies over it as it loads).
    await page.locator('[aria-label="Profile"]').first().evaluate((e) => (e as HTMLElement).click());
    await expect.poll(() => page.locator(".sheet:not([hidden]) h3, .sheet:not([hidden]) h2").first().textContent()).toContain("Settings");
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => k.startsWith("brinelight-portal-v1/"))).toBe(true);
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
    expect(outside).toEqual([]);
    await context.close();
  });
});
