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

/** The Night's panel and end card, as the player reads them. */
const read = (page: import("playwright-core").Page) =>
  page.evaluate(() => ({
    wave: document.querySelector(".night-hud .wave b")?.textContent ?? "",
    oil: document.querySelector(".night-hud .oil b")?.textContent ?? "",
    end: !(document.querySelector<HTMLElement>(".night-end")?.hidden ?? true),
    beam: Number(document.querySelector<HTMLCanvasElement>("canvas")?.dataset.beam ?? Number.NaN),
  }));

describe("the portal, from a folder of its own", () => {
  it("opens in its first Night with no error, fetches nothing outside its folder, saves under brinelight-portal-v1/", async () => {
    const context = await browser.newContext({ viewport: { width: 907, height: 510 } });
    const page = await context.newPage();
    const errors: string[] = [];
    const failed: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
    const opened = Date.now();
    await page.goto(`http://127.0.0.1:${PORT}${FOLDER}`);
    // The Night starts at once: no menu, no title, within 10 s of the page.
    await page.waitForSelector(".night-hud", { timeout: 10_000 });
    expect(Date.now() - opened).toBeLessThan(10_000);
    expect(await page.title()).toBe("Brinelight: Hold the Light");
    await expect.poll(async () => (await read(page)).wave).toBe("Wave 1 of 5");
    expect((await read(page)).oil).toBe("100");
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.every((k) => k.startsWith("brinelight-portal-v1/"))).toBe(true);
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
    expect(outside).toEqual([]);
    await context.close();
  });

  it("the beam follows the mouse, and the keys turn it", async () => {
    const context = await browser.newContext({ viewport: { width: 907, height: 510 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${PORT}${FOLDER}`);
    await page.waitForSelector("canvas[data-beam]", { timeout: 60_000 });
    // Far to the right of the screen: the water east of the Lighthouse.
    await page.mouse.move(890, 160);
    await expect.poll(async () => (await read(page)).beam).toBeGreaterThan(45);
    expect((await read(page)).beam).toBeLessThan(135);
    // Far to the left: west.
    await page.mouse.move(15, 160);
    await expect.poll(async () => (await read(page)).beam).toBeGreaterThan(225);
    expect((await read(page)).beam).toBeLessThan(315);
    const before = (await read(page)).beam;
    await page.keyboard.down("ArrowRight");
    await expect.poll(async () => (await read(page)).beam !== before).toBe(true);
    await page.keyboard.up("ArrowRight");
    await context.close();
  });

  it("a Night left alone ends on its card; Again starts a new one", async () => {
    const context = await browser.newContext({ viewport: { width: 384, height: 699 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${PORT}${FOLDER}`);
    await page.waitForSelector(".night-end:not([hidden])", { timeout: 170_000 });
    const end = await page.locator(".night-end").innerText();
    expect(end).toContain("The Lighthouse went dark");
    expect(end).toMatch(/You held \d waves of 5\./);
    expect(end).toContain("You bring back:");
    await page.locator('.night-end [data-act="again"]').click();
    await expect.poll(async () => await read(page)).toMatchObject({ end: false, oil: "100", wave: "Wave 1 of 5" });
    await context.close();
  }, 200_000);
});
