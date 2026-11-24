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
    // What the first Night needs comes first (under 5 MB); the models made in Blender and the sounds come during it.
    let bytes = 0;
    page.on("response", (r) => void r.body().then((b) => (bytes += b.length), () => undefined));
    const opened = Date.now();
    await page.goto(`http://127.0.0.1:${PORT}${FOLDER}`);
    // The Night starts at once: no menu, no title, within 10 s of the page.
    await page.waitForSelector(".night-hud", { timeout: 10_000 });
    expect(Date.now() - opened).toBeLessThan(10_000);
    expect(bytes).toBeLessThan(5 * 1024 * 1024);
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
    // The headless browser draws a few frames a second: the beam follows within them.
    await expect.poll(async () => (await read(page)).beam, { timeout: 10_000 }).toBeGreaterThan(45);
    expect((await read(page)).beam).toBeLessThan(135);
    // Far to the left: west.
    await page.mouse.move(15, 160);
    await expect.poll(async () => (await read(page)).beam, { timeout: 10_000 }).toBeGreaterThan(225);
    expect((await read(page)).beam).toBeLessThan(315);
    const before = (await read(page)).beam;
    await page.keyboard.down("ArrowRight");
    await expect.poll(async () => (await read(page)).beam !== before, { timeout: 10_000 }).toBe(true);
    await page.keyboard.up("ArrowRight");
    await context.close();
  });

  it("a Night with the beam left alone ends on its card; its loot goes to your city, where the Lighthouse is upgraded; the city stays after a reload", async () => {
    const context = await browser.newContext({ viewport: { width: 384, height: 699 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${PORT}${FOLDER}`);
    // The beam left alone; between waves, the first card (key 1): the next wave waits for a choice.
    await page.waitForSelector(".night-hud", { timeout: 60_000 });
    for (let i = 0; i < 170 && !(await read(page)).end; i++) {
      if (await page.locator(".night-cards:not([hidden])").count()) await page.keyboard.press("Digit1");
      await page.waitForTimeout(1000);
    }
    const end = await page.locator(".night-end").innerText();
    expect(end).toContain("The Lighthouse went dark");
    expect(end).toMatch(/You held \d waves of 5\./);
    expect(end).toContain("You bring back:");
    await page.locator('.night-end [data-act="done"]').click();
    const day = page.locator(".day:not([hidden])");
    await expect.poll(() => day.count()).toBe(1);
    expect(await day.innerText()).toContain("Lighthouse");
    await page.locator('.day [data-act="upgrade"][data-b="lighthouse"]').click();
    await expect.poll(async () => (await day.innerText()).replace(/\s+/g, " ")).toContain("Lighthouse level 2");
    await page.reload();
    await page.waitForSelector(".day:not([hidden])", { timeout: 60_000 });
    expect((await page.locator(".day").innerText()).replace(/\s+/g, " ")).toContain("Lighthouse level 2");
    await page.locator('.day [data-act="night"]').click();
    await expect.poll(async () => await read(page)).toMatchObject({ end: false, wave: "Wave 1 of 5" });
    await context.close();
  }, 200_000);

  it("a save edited by hand is set aside: a new city, Night 1 at once, and you are told", async () => {
    const context = await browser.newContext({ viewport: { width: 907, height: 510 } });
    await context.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("brinelight-portal-v1/hold-the-light-city", JSON.stringify({ v: 1, city: { v: 1, buildings: { lighthouse: 99, refinery: 1, infirmary: 0 }, stock: { wood: 9e9, fish: 0, pearls: 0 }, won: 5, played: 5 } }));
      }
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${PORT}${FOLDER}`);
    await page.waitForSelector(".night-hud", { timeout: 60_000 });
    await expect.poll(() => page.locator("body").innerText(), { timeout: 10_000 }).toContain("Your saved city could not be read. A copy was kept.");
    expect(await read(page)).toMatchObject({ wave: "Wave 1 of 5", oil: "100" });
    const kept = await page.evaluate(() => localStorage.getItem("brinelight-portal-v1/hold-the-light-city-rejected"));
    expect(kept).toContain('"lighthouse":99');
    await context.close();
  });

  it("?measure lists the sessions kept on this device", async () => {
    const context = await browser.newContext({ viewport: { width: 907, height: 510 } });
    await context.addInitScript(() =>
      localStorage.setItem("brinelight-portal-v1/hold-the-light-measure", JSON.stringify([{ start: 1, seconds: 754, firstMove: 2.5, nights: [{ night: 1, wave: 4, end: "lost" }] }])),
    );
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${PORT}${FOLDER}?measure`);
    const panel = page.locator(".measure");
    await expect.poll(() => panel.count(), { timeout: 60_000 }).toBe(1);
    const text = await panel.innerText();
    expect(text).toContain("12 min 34 s");
    expect(text).toContain("Night 1: lost at wave 4");
    expect(text).toContain("Nothing is sent.");
    await context.close();
  });

  it("between waves, three cards; a tap on a raft puts troops there", async () => {
    const context = await browser.newContext({ viewport: { width: 907, height: 510 } });
    await context.addInitScript(() =>
      localStorage.setItem("brinelight-portal-v1/hold-the-light-city", JSON.stringify({ v: 1, city: { v: 1, buildings: { lighthouse: 3, refinery: 1, infirmary: 0 }, stock: { wood: 0, fish: 0, pearls: 0 }, won: 1, played: 1 } })),
    );
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${PORT}${FOLDER}`);
    await page.waitForSelector(".day:not([hidden])", { timeout: 60_000 });
    await page.locator('.day [data-act="night"]').click();
    await page.waitForSelector(".night-post", { timeout: 10_000 });
    await expect.poll(async () => (await page.locator(".night-hud").innerText()).replace(/\s+/g, " ")).toContain("Wave 1 of 8");
    expect(await page.locator("body").innerText()).toContain("Tap ＋ on a raft to put troops there.");
    await page.locator('.night-post[data-post="0"]').click();
    await page.locator('.night-troops [data-troop="crossbowmen"]').click();
    await expect.poll(() => page.locator('.night-post[data-post="0"] span').getAttribute("aria-label")).toBe("Crossbowmen on this raft");
    const cards = page.locator(".night-cards:not([hidden])");
    await expect.poll(() => cards.count(), { timeout: 120_000 }).toBe(1);
    expect(await cards.locator("[data-card]").count()).toBe(3);
    await page.keyboard.press("Digit2");
    await expect.poll(() => cards.count()).toBe(0);
    await expect.poll(async () => (await page.locator(".night-hud").innerText()).replace(/\s+/g, " "), { timeout: 30_000 }).toContain("Wave 2 of 8");
    await context.close();
  }, 200_000);

  it("at every size CrazyGames shows a game: nothing runs off the page, the next Night's button whole, the Night's panels apart", async () => {
    // docs.crazygames.com/requirements/gameplay (read again on 24 November): desktop 907 × 510, 1216 × 684, 1077 × 606,
    // 821 × 462, fullscreen 1366 × 768, 1920 × 1080, 1536 × 864, 1280 × 720, mobile 800 × 450, tablet 1080 × 607; and a phone upright.
    const sizes: [number, number][] = [[821, 462], [907, 510], [1077, 606], [1216, 684], [1280, 720], [1366, 768], [1536, 864], [1920, 1080], [800, 450], [1080, 607], [384, 699]];
    const inside = (b: { x: number; y: number; width: number; height: number } | null, w: number, h: number) => !!b && b.x >= -1 && b.y >= -1 && b.x + b.width <= w + 1 && b.y + b.height <= h + 1;
    const apart = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
      a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
    for (const [w, h] of sizes) {
      const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      await context.addInitScript(() =>
        localStorage.setItem("brinelight-portal-v1/hold-the-light-city", JSON.stringify({ v: 1, city: { v: 2, buildings: { lighthouse: 4, refinery: 3, infirmary: 1, barracks: 1, harbor: 1, observatory: 1 }, stock: { wood: 400, fish: 300, pearls: 20 }, won: 5, played: 8 } })),
      );
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${PORT}${FOLDER}`);
      await page.waitForSelector(".day:not([hidden])", { timeout: 60_000 });
      await page.waitForTimeout(800);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}×${h}: no page wider than the frame`).toBe(true);
      expect(inside(await page.locator(".day-night").boundingBox(), w, h), `${w}×${h}: Start Night whole`).toBe(true);
      await page.screenshot({ path: `e2e/.shots/portal-day-${w}x${h}.png` });
      await page.locator(".day-night").click();
      await page.waitForSelector(".night-hud", { timeout: 10_000 });
      await page.waitForTimeout(1500);
      const oil = (await page.locator(".night-hud .oil").boundingBox())!;
      const wave = (await page.locator(".night-hud .wave").boundingBox())!;
      const flare = (await page.locator(".night-flare").boundingBox())!;
      for (const [name, b] of [["oil", oil], ["wave", wave], ["flare", flare]] as const) expect(inside(b, w, h), `${w}×${h}: ${name} on screen`).toBe(true);
      expect(apart(oil, wave) && apart(oil, flare) && apart(wave, flare), `${w}×${h}: the Night's panels apart`).toBe(true);
      await page.screenshot({ path: `e2e/.shots/portal-night-${w}x${h}.png` });
      await context.close();
    }
  }, 600_000);
});
