/**
 * Sign in from the game, end to end: the real server (PGlite), the built client in Chromium, and a test wallet.
 * Signed in, every action goes to the server, which decides; the city shown is the server's.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import type { BrowserContext, Locator, Page } from "playwright-core";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { HOUR, PROMOTE_TIME, RAFT_INSTALL_TIME, RAFT_SLOTS, advance, heal, installOnRaft, newPlayerState, promote, raftUpgradeTime, research, sail, upgrade, type ActionResult, type PlayerState, type RaftBuildingId } from "@brinelight/shared";
import { frameCity } from "../client/src/scene/camera.js";
import { SHORE_RADIUS } from "../client/src/scene/models.js";
import { CITY_KEY_PREFIX } from "../client/src/account/actions.js";
import { PROFILE_TEXT } from "../client/src/account/profile.js";
import { TEXT } from "../client/src/account/index.js";
import { installFakeWallet, type TestWallet } from "./fakeWallet.js";
import { comparePixels, decodePng } from "./png.js";
import { API, GAME, holdActions, startHarness, type Harness } from "./harness.js";

const SAVE_KEY = "brinelight-client-v1";
const ACCOUNT_KEY = "brinelight-account-v1";
type Job = { id: string };
type City = { buildings: Record<string, number>; queue: Job[]; stock: Record<string, number> };
type Copy = { v: 1; server: { state: City; version: number; asOf: string; speed: number } | null; receivedAt: number; pending: { action: { id: string }; firstSentAt: number | null }[] };

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h?.close();
});
/** Every browser profile is closed after its test, even a failed one: a page left open keeps drawing and slows the next tests. */
const contexts: BrowserContext[] = [];
afterEach(async () => {
  holdActions(0);
  await Promise.all(contexts.splice(0).map((c) => c.close().catch(() => undefined)));
});

/** A browser profile of its own (its own localStorage); with a test wallet when asked. */
async function newPlayer(
  withWallet: boolean,
  viewport = { width: 412, height: 915 },
): Promise<{ context: BrowserContext; wallet: TestWallet | null; apiCalls: string[]; actionIds: string[]; problems: string[] }> {
  const context = await h.browser.newContext({ viewport, deviceScaleFactor: 1 });
  contexts.push(context);
  const wallet = withWallet ? await installFakeWallet(context) : null;
  const apiCalls: string[] = [];
  const actionIds: string[] = [];
  const problems: string[] = [];
  context.on("request", (r) => {
    if (!r.url().startsWith(API)) return;
    apiCalls.push(`${r.method()} ${new URL(r.url()).pathname}`);
    if (r.method() === "POST" && r.url().endsWith("/city/actions")) actionIds.push((JSON.parse(r.postData() ?? "{}") as { action: { id: string } }).action.id);
  });
  // A keepalive request still on its way when the page goes is reported "ERR_ABORTED" by the page, though the
  // server gets it (the tests check the server). Anything else, and any CORS refusal, is a problem.
  context.on("requestfailed", (r) => {
    const why = r.failure()?.errorText ?? "";
    if (r.url().startsWith(API) && why !== "net::ERR_ABORTED") problems.push(`failed ${r.method()} ${r.url()} ${why}`);
  });
  context.on("console", (m) => /CORS|blocked|keepalive|preflight/i.test(m.text()) && problems.push(m.text()));
  return { context, wallet, apiCalls, actionIds, problems };
}

/** Opens the game and waits for the city and its labels. */
async function openGame(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  // The lowest quality step: the container draws without a graphics chip.
  await page.goto(`${GAME}/?quality=2`);
  await page.waitForSelector(".loading", { state: "detached", timeout: 60_000 });
  await page.waitForSelector(".labels.city .bl b");
  return page;
}

/** Taps a building in the 3D view, just under its label, until its sheet opens. */
async function openSheet(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(300);
  const label = page.locator(".labels.city .bl", { hasText: name }).first();
  const box = (await label.boundingBox())!;
  for (const dy of [30, 45, 60, 20]) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height + dy);
    if (await page.locator(".sheet:not(.profile)", { hasText: name }).isVisible()) return;
  }
  throw new Error(`Could not open the sheet of ${name}`);
}

/** Taps a building in the 3D view, just under its label, and upgrades it from its sheet. */
async function upgradeBuilding(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(300);
  const label = page.locator(".labels.city .bl", { hasText: name }).first();
  const box = (await label.boundingBox())!;
  for (const dy of [30, 45, 60, 20]) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height + dy);
    const sheet = page.locator(".sheet:not(.profile)", { hasText: name });
    if (await sheet.isVisible()) {
      await sheet.locator('[data-act="upgrade"]').click();
      // The sheet is drawn again on every frame while the building works: close it from the page.
      await page.evaluate(() => document.querySelector<HTMLButtonElement>('.sheet:not(.profile):not([hidden]) [data-act="close"]')?.click());
      return;
    }
  }
  throw new Error(`Could not open the sheet of ${name}`);
}

const localCity = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null")?.state as City | null, SAVE_KEY);
const session = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null") as { token: string; wallet: string; playerId: string } | null, ACCOUNT_KEY);
/** The account's city kept on this device, for a player. */
const copyOf = (page: Page, playerId: string) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null") as Copy | null, `${CITY_KEY_PREFIX}${playerId}`);
/** The buildings in the builders' queue on screen (top left), by name. */
const shownJobs = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".queue .n")]
      .map((e) => e.textContent ?? "")
      .filter((t) => !t.startsWith("Fleet"))
      .map((t) => t.replace(/ Lv \d+$/, ""))
      .sort(),
  );

/** The account's city on the server (null while it has none). */
async function serverCity(token: string): Promise<{ state: City; version: number } | null> {
  const res = await fetch(`${API}/city`, { headers: { authorization: `Bearer ${token}` } });
  const body = (await res.json()) as { state?: City; version?: number };
  return body.state ? (body as { state: City; version: number }) : null;
}
/** Waits until the account's city on the server has exactly these upgrades in its queue (sorted ids). */
async function serverHas(token: string, jobs: string[]): Promise<{ state: City; version: number }> {
  let last: unknown = null;
  for (let i = 0; i < 75; i++) {
    const c = await serverCity(token);
    last = c?.state.queue;
    if (c && queued(c.state).join() === jobs.join()) return c;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`The account city never had ${jobs.join(", ")} (last: ${JSON.stringify(last)})`);
}
/** As when you switch apps: the page is hidden. */
const hide = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
/** As when you come back to the app: the page is shown again. */
const show = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

async function signIn(page: Page): Promise<void> {
  await page.locator(".hud .lvl").click();
  await page.locator('.profile [data-act="sign-in"]').click();
}
async function signOut(page: Page): Promise<void> {
  await page.locator(".hud .lvl").click();
  await page.locator('.profile [data-act="sign-out"]').click();
  await page.locator(".toast", { hasText: TEXT.signedOut }).waitFor();
  await page.locator('.profile [data-act="close"]').click();
}

const queued = (c: City | null) => (c?.queue ?? []).map((j) => j.id).sort();
/** Until no celebration is on screen: one would take the next tap (a tap closes it). */
const calm = (page: Page) => expect.poll(() => page.locator(".celebration").count(), { timeout: 15_000, interval: 100 }).toBe(0);
/** For a poll that waits on the network (an answer, a retry): longer than the default second. */
const NET = { timeout: 15_000, interval: 100 };

/** A new player with a test wallet, signed in, on a city never played on this device. */
async function signedInPlayer() {
  const p = await newPlayer(true);
  const page = await openGame(p.context);
  await signIn(page);
  await page.locator(".toast", { hasText: TEXT.signedIn }).waitFor();
  const s = (await session(page))!;
  return { ...p, page, token: s.token, playerId: s.playerId };
}

describe("playing without signing in", () => {
  it("works as before: the city is saved on this device, and nothing goes to the server", async () => {
    const p = await newPlayer(false);
    const page = await openGame(p.context);
    await upgradeBuilding(page, "Refinery");
    await hide(page);
    expect(queued(await localCity(page))).toEqual(["refinery"]);
    await page.reload();
    await page.waitForSelector(".labels.city .bl b");
    expect(queued(await localCity(page))).toEqual(["refinery"]);
    await page.locator(".hud .lvl").click();
    await expect(page.locator(".profile").textContent()).resolves.toContain(PROFILE_TEXT.noWallet);
    await page.screenshot({ path: "e2e/.shots/shot-profile-no-wallet.png" });
    expect(p.apiCalls).toEqual([]);
    await p.context.close();
  });
});

describe("city labels", () => {
  it("the nine building models: all loaded, each label just above its building, and a tap under it opens its sheet", async () => {
    const base = newPlayerState();
    const city = { ...base, buildings: { lighthouse: 4, refinery: 2, fishery: 2, lumberyard: 2, shelters: 1, barracks: 1, harbor: 1, observatory: 1, infirmary: 1 } };
    const p = await newPlayer(false);
    await p.context.addInitScript(({ key, file }) => localStorage.setItem(key, file), { key: SAVE_KEY, file: JSON.stringify({ v: 1, savedAt: Date.now(), state: city }) });
    const models: string[] = [];
    p.context.on("response", (r) => r.url().includes("/buildings/") && r.ok() && models.push(new URL(r.url()).pathname));
    const page = await openGame(p.context);
    expect(models.sort()).toEqual(["barracks", "fishery", "harbor", "infirmary", "lighthouse", "lumberyard", "observatory", "refinery", "shelters"].map((id) => `/buildings/${id}.glb`));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/.shots/shot-buildings.png" });
    // Closer, every label has room at full size.
    await page.mouse.move(206, 500);
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(1000);
    const shown = () => page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".labels.city .bl")].filter((e) => e.style.display !== "none" && !e.classList.contains("compact")).length);
    await expect.poll(shown).toBe(9);
    await page.screenshot({ path: "e2e/.shots/shot-buildings-near.png" });
    // A tap just under each label lands on its building: the labels follow the models' heights.
    for (const name of ["Lighthouse", "Refinery", "Fishery", "Lumberyard", "Shelters", "Barracks", "Harbor", "Observatory", "Infirmary"]) {
      await openSheet(page, name);
      await page.evaluate(() => document.querySelector<HTMLButtonElement>('.sheet:not(.profile):not([hidden]) [data-act="close"]')?.click());
    }
    await p.context.close();
  });

  it("the island, the rafts, the sea's wrecks, camps and boat, and the icons: the models of the art direction", async () => {
    const base = newPlayerState();
    const inner = RAFT_SLOTS.filter((x) => x.ring === 3).map((x) => x.key);
    let city: PlayerState = {
      ...base,
      buildings: { lighthouse: 6, refinery: 2, fishery: 2, lumberyard: 2, shelters: 1, barracks: 1, harbor: 1, observatory: 1, infirmary: 1 },
      rafts: Object.fromEntries(inner.slice(0, 10).map((k, i) => [k, { hp: i === 2 ? 40 : 100, building: null, level: 0 }])),
    };
    const sent = sail(city, "camp-1");
    if (!sent.ok) throw new Error(sent.reason);
    city = advance(sent.state, 200);
    const p = await newPlayer(false);
    await p.context.addInitScript(({ key, file }) => localStorage.setItem(key, file), { key: SAVE_KEY, file: JSON.stringify({ v: 1, savedAt: Date.now(), state: city }) });
    const models: string[] = [];
    p.context.on("response", (r) => r.url().includes("/models/") && r.ok() && models.push(new URL(r.url()).pathname));
    const page = await openGame(p.context);
    // The five models of the first screen, then the three buildings on rafts, loaded once the city shows.
    expect(models.slice(0, 5).sort()).toEqual(["boat", "camp", "island", "raft", "wreck"].map((id) => `/models/${id}.glb`));
    await expect.poll(() => models.slice(5).sort(), NET).toEqual(["greenhouse", "smokehouse", "watchtower"].map((id) => `/models/${id}.glb`));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/.shots/shot-island.png" });
    await page.screenshot({ path: "e2e/.shots/shot-hud.png", clip: { x: 0, y: 0, width: 412, height: 140 } });
    // The top bar (Lighthouse, oil, fish, wood, Pearls, survivors) and the bottom menu (five views): every icon loaded.
    const icons = await page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>("img.icon")].map((i) => i.complete && i.naturalWidth > 0));
    expect(icons.length).toBeGreaterThanOrEqual(11);
    expect(icons.every(Boolean)).toBe(true);
    await page.locator('.nav button[data-v="sea"]').click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "e2e/.shots/shot-sea.png" });
    await page.mouse.move(206, 500);
    // Farther out: wrecks and camps around your city.
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/.shots/shot-sea-far.png" });
    await p.context.close();
  });

  it("turning and zooming the camera: a label never covers another one (seen on the phone: a badge over \"Lighthouse 4\")", async () => {
    const base = newPlayerState();
    const city = { ...base, buildings: { ...base.buildings, lighthouse: 4, refinery: 2, fishery: 2, lumberyard: 2, shelters: 1, barracks: 1, harbor: 1, observatory: 1, infirmary: 1 } };
    const p = await newPlayer(false);
    await p.context.addInitScript(({ key, file }) => localStorage.setItem(key, file), { key: SAVE_KEY, file: JSON.stringify({ v: 1, savedAt: Date.now(), state: city }) });
    const page = await openGame(p.context);
    await page.waitForTimeout(1000);
    const overlaps = () =>
      page.evaluate(() => {
        const shown = [...document.querySelectorAll<HTMLElement>(".labels.city .bl")].filter((e) => e.style.display !== "none").map((e) => ({ t: e.textContent, r: e.getBoundingClientRect() }));
        const hits: string[] = [];
        for (const [i, a] of shown.entries())
          for (const b of shown.slice(i + 1)) if (a.r.left < b.r.right && b.r.left < a.r.right && a.r.top < b.r.bottom && b.r.top < a.r.bottom) hits.push(`${a.t} × ${b.t}`);
        return hits;
      });
    const seen: string[] = [];
    for (let step = 0; step < 24; step++) {
      if (step > 0) {
        // A short drag turns the camera; every fourth step zooms in or out.
        await page.mouse.move(200, 600);
        await page.mouse.down();
        await page.mouse.move(200 + (step % 2 ? 60 : 40), 600 + ((step % 3) - 1) * 25, { steps: 5 });
        await page.mouse.up();
        if (step % 4 === 0) await page.mouse.wheel(0, step % 8 ? 300 : -300);
        await page.waitForTimeout(400);
      }
      seen.push(...(await overlaps()).map((x) => `step ${step}: ${x}`));
      // The view where the phone showed the defect: a badge used to sit over the end of "Lighthouse 4".
      if (step === 12) await page.screenshot({ path: "e2e/.shots/shot-labels.png" });
    }
    expect(seen).toEqual([]);
    await p.context.close();
  });
});

describe("combat reports", () => {
  /** A city whose fleets came back twice: two unread reports, r1 then r2. No need to wait for a fleet. */
  const cityWithTwoReports = (): PlayerState => {
    let city = newPlayerState();
    for (let i = 0; i < 2; i++) {
      const r = sail({ ...city, troops: { boarders: 25, harpooners: 25, crossbowmen: 25 } }, "camp-1");
      if (!r.ok) throw new Error(r.reason);
      city = advance(r.state, 8 * HOUR);
    }
    return city;
  };
  type Reports = { reports: { id: string; read: boolean }[] };
  const reportsRead = async (page: Page) =>
    (await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null")?.state as Reports | null, SAVE_KEY))?.reports.map((r) => [r.id, r.read]);

  it("closing a report marks that one read, and the newer one stays unread", async () => {
    const city = cityWithTwoReports();
    expect(city.reports.map((r) => [r.id, r.read])).toEqual([
      ["r1", false],
      ["r2", false],
    ]);
    const p = await newPlayer(false);
    // The city is put in the save before the game starts, once (a reload would not put it back).
    await p.context.addInitScript(
      ({ key, file }) => {
        if (sessionStorage.getItem("e2e-injected")) return;
        localStorage.setItem(key, file);
        sessionStorage.setItem("e2e-injected", "1");
      },
      { key: SAVE_KEY, file: JSON.stringify({ v: 1, savedAt: Date.now(), state: city }) },
    );
    const page = await openGame(p.context);

    // The oldest unread report opens by itself.
    const sheet = page.locator('.sheet[aria-label="Combat report"]:not([hidden])');
    await sheet.waitFor();
    await page.screenshot({ path: "e2e/.shots/shot-report.png" });
    await sheet.locator('[data-act="close"]').click();

    await expect.poll(() => reportsRead(page)).toEqual([
      ["r1", true],
      ["r2", false],
    ]);
    // The newer one opens next, still unread until you close it.
    await sheet.waitFor();
    expect(await reportsRead(page)).toEqual([
      ["r1", true],
      ["r2", false],
    ]);
    await sheet.locator('[data-act="close"]').click();
    await expect.poll(() => reportsRead(page)).toEqual([
      ["r1", true],
      ["r2", true],
    ]);
    expect(p.apiCalls).toEqual([]);
    await p.context.close();
  });

  it("a report shows the veterans sent, with their icon, and counts the lost ones in the losses", async () => {
    const vets = { ...newPlayerState(), troops: { boarders: 25, harpooners: 25, crossbowmen: 25 }, veterans: { boarders: 10, harpooners: 0, crossbowmen: 10 } };
    const r = sail(vets, "camp-1");
    if (!r.ok) throw new Error(r.reason);
    const city = advance(r.state, 8 * HOUR);
    const report = city.reports[0]!;
    expect(report.infirmary).toBe(false);
    const p = await newPlayer(false);
    await p.context.addInitScript(
      ({ key, file }) => {
        if (sessionStorage.getItem("e2e-injected")) return;
        localStorage.setItem(key, file);
        sessionStorage.setItem("e2e-injected", "1");
      },
      { key: SAVE_KEY, file: JSON.stringify({ v: 1, savedAt: Date.now(), state: city }) },
    );
    const page = await openGame(p.context);
    const sheet = page.locator('.sheet[aria-label="Combat report"]:not([hidden])');
    await sheet.waitFor();
    const boarders = sheet.locator("table.rep tr", { hasText: "Boarders" });
    expect(await boarders.locator(".vet").textContent()).toBe("+10 vet.");
    expect(await boarders.locator('.vet img[src*="veteran-48.webp"]').count()).toBe(1);
    expect(await boarders.locator("td.l").textContent()).toBe(`−${report.losses.boarders + report.veteranLosses!.boarders}`);
    expect(await sheet.locator("table.rep tr", { hasText: "Harpooners" }).locator(".vet").count()).toBe(0);
    await expect.poll(() => sheet.textContent()).toContain("no Infirmary: all losses died");
    expect(await sheet.textContent()).toContain("One veteran is worth 1.8 soldiers.");
    await page.screenshot({ path: "e2e/.shots/shot-report-veterans.png" });
    expect(p.apiCalls).toEqual([]);
    await p.context.close();
  });
});

/** Puts a city in this device's save before the game starts, once (a reload would not put it back). */
const injectCity = (context: BrowserContext, city: PlayerState) =>
  context.addInitScript(
    ({ key, file }) => {
      if (sessionStorage.getItem("e2e-injected")) return;
      localStorage.setItem(key, file);
      sessionStorage.setItem("e2e-injected", "1");
    },
    { key: SAVE_KEY, file: JSON.stringify({ v: 1, savedAt: Date.now(), state: city }) },
  );
const SIZES = [
  { width: 412, height: 915 },
  { width: 360, height: 800 },
];

describe("the queue", () => {
  it("six works: three rows and \"+3 more\", clear of the island; unfolded, no name cut; folded back, at 412 and 360 px", async () => {
    const ok = (r: ActionResult) => {
      if (!r.ok) throw new Error(r.reason);
      return r.state;
    };
    const base = newPlayerState();
    let city: PlayerState = {
      ...base,
      buildings: { ...base.buildings, lighthouse: 6, barracks: 3, observatory: 3, infirmary: 1 },
      techs: { veterans: 1 },
      troops: { boarders: 25, harpooners: 25, crossbowmen: 25 },
      wounded: { boarders: 12, harpooners: 5, crossbowmen: 3 },
      stock: { oil: 50_000, fish: 50_000, wood: 50_000, rope: 3 },
    };
    city = ok(upgrade(city, "observatory"));
    city = ok(upgrade(city, "infirmary"));
    city = ok(research(city, "warehouses"));
    city = ok(promote(city, "crossbowmen"));
    city = ok(heal(city));
    city = ok(sail(city, "camp-1"));
    const names = ["Observatory Lv 4", "Infirmary Lv 2", "Research · Sealed Warehouses", "10 veteran crossbowmen", "Healing · 20 wounded", "Fleet · Mist Pirates"];
    const rowsOf = (page: Page) =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".queue .list > div")].map((row) => {
          const n = row.querySelector<HTMLElement>(".n")!;
          const box = row.getBoundingClientRect();
          const name = n.getBoundingClientRect();
          const bar = row.querySelector<HTMLElement>(".pb")!.getBoundingClientRect();
          return { text: n.textContent, cut: n.scrollWidth > n.clientWidth, inside: name.left >= box.left && name.right <= box.right, below: bar.top >= name.bottom - 1 };
        }),
      );
    for (const size of SIZES) {
      const p = await newPlayer(false, size);
      await injectCity(p.context, city);
      const page = await openGame(p.context);
      const more = page.locator(".queue .more");
      await expect.poll(() => more.textContent()).toBe("+3 more");
      const folded = await rowsOf(page);
      expect(folded.map((r) => r.text), `${size.width} px`).toEqual(names.slice(0, 3));
      // Folded, the queue ends above the island's shore wherever they share the screen's width.
      const queue = (await page.locator(".queue").boundingBox())!;
      const shore = shoreOnScreen(6, size.width, size.height).filter((pt) => pt.x >= queue.x && pt.x <= queue.x + queue.width);
      expect(shore.length).toBeGreaterThan(0);
      expect(queue.y + queue.height, `${size.width} px`).toBeLessThan(Math.min(...shore.map((pt) => pt.y)));
      await page.screenshot({ path: `e2e/.shots/shot-queue-folded-${size.width}.png` });

      await more.click();
      await expect.poll(() => more.textContent()).toBe("Show less");
      const open = await rowsOf(page);
      expect(open.map((r) => r.text), `${size.width} px`).toEqual(names);
      for (const r of open) expect({ width: size.width, ...r }).toEqual({ width: size.width, text: r.text, cut: false, inside: true, below: true });
      await page.screenshot({ path: `e2e/.shots/shot-queue-open-${size.width}.png` });
      // Still unfolded a few seconds later, as the rows are drawn again.
      await page.waitForTimeout(1500);
      expect(await page.locator(".queue .list > div").count()).toBe(6);

      await more.click();
      await expect.poll(() => page.locator(".queue .list > div").count()).toBe(3);
      expect(await more.textContent()).toBe("+3 more");
      expect(p.apiCalls).toEqual([]);
      await p.context.close();
    }
  });
});

describe("buildings on rafts", () => {
  it("six rafts with buildings, two of each type; the sheet of a free raft and of a raft with a building, at 412 and 360 px", async () => {
    const order: [RaftBuildingId, number][] = [
      ["greenhouse", 2],
      ["greenhouse", 1],
      ["smokehouse", 1],
      ["smokehouse", 3],
      ["watchtower", 1],
      ["watchtower", 2],
    ];
    for (const size of SIZES) {
      // The two lowest slots on screen: a free raft, then the Kelp Greenhouse level 2; the others around them.
      const clear = slotsOnScreen(6, size.width, size.height);
      const rest = RAFT_SLOTS.filter((x) => x.ring === 3 && x.key !== clear[0]!.slot && x.key !== clear[1]!.slot).map((x) => x.key);
      const equipped = [clear[1]!.slot, ...rest.slice(0, 5)];
      const base = newPlayerState();
      const city: PlayerState = {
        ...base,
        buildings: { lighthouse: 6, refinery: 2, fishery: 2, lumberyard: 2, shelters: 1, barracks: 1, harbor: 1, observatory: 1, infirmary: 1 },
        stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 },
        rafts: {
          [clear[0]!.slot]: { hp: 100, building: null, level: 0 },
          ...Object.fromEntries(equipped.map((k, i) => [k, { hp: 100, building: order[i]![0], level: order[i]![1] }])),
        },
      };
      const p = await newPlayer(false, size);
      await injectCity(p.context, city);
      const models: string[] = [];
      p.context.on("response", (r) => r.url().includes("/models/") && r.ok() && models.push(new URL(r.url()).pathname));
      const page = await openGame(p.context);
      await expect.poll(() => models.filter((m) => /greenhouse|smokehouse|watchtower/.test(m)).length, NET).toBe(3);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `e2e/.shots/shot-rafts-${size.width}.png` });

      const sheet = page.locator(".raft-sheet:not([hidden])");
      await page.mouse.click(clear[0]!.x, clear[0]!.y);
      await sheet.waitFor();
      expect(await sheet.locator("h2").textContent()).toBe("Raft");
      expect(await sheet.locator("[data-raft-building]").count()).toBe(3);
      // Two greenhouses already: refused, still tappable; the reason comes in a toast.
      expect(await sheet.locator('[data-building="greenhouse"]').getAttribute("aria-disabled")).toBe("true");
      expect(await sheet.locator('[data-raft-building="watchtower"] small').last().textContent()).toContain("2/2");
      await page.screenshot({ path: `e2e/.shots/shot-raft-free-${size.width}.png` });
      // aria-disabled: Playwright waits for an enabled button; a finger does not.
      await sheet.locator('[data-building="greenhouse"]').click({ force: true });
      await page.locator(".toast", { hasText: "Each type is limited to 2 rafts" }).waitFor();
      await sheet.locator('[data-act="close"]').click();

      await page.mouse.click(clear[1]!.x, clear[1]!.y);
      await sheet.waitFor();
      expect(await sheet.locator("h2").textContent()).toBe("Kelp Greenhouse");
      expect(await sheet.textContent()).toContain("Kelp Greenhouse level 2: +9 fish/h.");
      expect(await sheet.textContent()).toContain("Upgrade to level 3");
      await page.screenshot({ path: `e2e/.shots/shot-raft-building-${size.width}.png` });
      expect(p.apiCalls).toEqual([]);
      await p.context.close();
    }
  });
});

describe("captains", () => {
  it("a victory's report with the captain's experience and the shards; the Captains sheet; a camp's sheet, at 412 and 360 px", async () => {
    const base = newPlayerState();
    const sent = sail({ ...base, troops: { boarders: 200, harpooners: 200, crossbowmen: 200 }, captains: { tom: { level: 2, xp: 140, stars: 2 }, isa: { level: 1, xp: 0, stars: 1 } }, shards: { sel: 9, mira: 4 } }, "camp-1");
    if (!sent.ok) throw new Error(sent.reason);
    const city = advance(sent.state, 8 * HOUR);
    expect(city.reports[0]).toMatchObject({ win: true, captainXp: { id: "tom", xp: 30, levels: 1 }, shards: { id: "sel", count: 1 } });
    for (const size of SIZES) {
      const p = await newPlayer(false, size);
      await injectCity(p.context, city);
      const page = await openGame(p.context);

      // The report of the victory opens by itself.
      const report = page.locator('.sheet[aria-label="Combat report"]:not([hidden])');
      await report.waitFor();
      expect(await report.textContent()).toContain("CaptainOld Tom · +30 XP · +1 level");
      expect(await report.textContent()).toContain("Shards+1 for Sel the Navigator");
      await page.screenshot({ path: `e2e/.shots/shot-report-captain-${size.width}.png` });
      await report.locator('[data-act="close"]').click();

      // The Captains sheet, from the bottom menu: Sel has 10 shards now, Nera is not recruited.
      await page.locator('.nav button[data-v="captains"]').click();
      const sheet = page.locator(".sheet.captains:not([hidden])");
      await sheet.waitFor();
      expect(await sheet.locator('[data-captain-row="nera"] small').last().textContent()).toBe("Not recruited · shards 0/10");
      expect(await sheet.locator('[data-captain-row="sel"] [data-act="unlock"]').getAttribute("aria-disabled")).toBe("false");
      expect(await sheet.locator('[data-captain-row="tom"] small').last().textContent()).toBe("Lv 3 · 10/240 XP · shards 0/10");
      expect(await sheet.locator('[data-captain-row="tom"] img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
      await page.screenshot({ path: `e2e/.shots/shot-captains-${size.width}.png` });
      await sheet.locator('[data-act="close"]').click();

      // At sea, a camp's sheet names its captain.
      await page.locator('.nav button[data-v="sea"]').click();
      await page.waitForTimeout(1500);
      const camps = page.locator(".labels.sea .sl.camp:visible");
      const site = page.locator(".sheet:not([hidden])", { has: page.locator("[data-shards-for]") });
      let found = false;
      for (let i = 0; i < (await camps.count()) && !found; i++) {
        const box = (await camps.nth(i).boundingBox())!;
        for (const dy of [30, 45, 60]) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height + dy);
          if (await site.isVisible()) {
            found = true;
            break;
          }
        }
      }
      expect(found).toBe(true);
      expect(await site.locator("[data-shards-for]").textContent()).toMatch(/^Shards for .+ · \d+\/10$/);
      await page.screenshot({ path: `e2e/.shots/shot-camp-${size.width}.png` });
      expect(p.apiCalls).toEqual([]);
      await p.context.close();
    }
  });
});

describe("celebrations", () => {
  const SEEN_KEY = "brinelight-seen-v1";
  /** A city whose works end 10 and 20 minutes after it is saved, with the lead captain one experience point from level 2. */
  const ending = (): PlayerState => {
    const base = newPlayerState();
    return {
      ...base,
      buildings: { ...base.buildings, lighthouse: 4, refinery: 2, fishery: 2 },
      stock: { oil: 9000, fish: 9000, wood: 9000, rope: 10 },
      pearls: 500,
      queue: [
        { id: "refinery", left: 600, duration: 900 },
        { id: "lighthouse", left: 1200, duration: 1800 },
      ],
      captains: { ...base.captains, [base.lead!]: { level: 1, xp: 79, stars: 1 } },
    };
  };
  /** At most one celebration on screen at any time, checked every 50 ms while `run` goes on. */
  async function oneAtATime(page: Page, run: () => Promise<void>): Promise<number> {
    let most = 0;
    let going = true;
    const watch = (async () => {
      while (going) {
        most = Math.max(most, await page.locator(".celebration").count());
        await page.waitForTimeout(50);
      }
    })();
    await run();
    going = false;
    await watch;
    return most;
  }

  it("a work that ends: gold text; the Lighthouse: the full screen; a captain: the 512 px portrait; one at a time, at 412 and 360 px", async () => {
    for (const size of SIZES) {
      const p = await newPlayer(false, size);
      const t0 = Date.now();
      await p.context.addInitScript(({ key, file }) => localStorage.setItem(key, file), { key: SAVE_KEY, file: JSON.stringify({ v: 1, savedAt: t0, state: ending() }) });
      // The page's clock waits for the test: the works end when the test says, however long the loading takes.
      const page = await p.context.newPage();
      await page.clock.install({ time: t0 });
      await page.clock.pauseAt(t0 + 500);
      await page.goto(`${GAME}/?quality=2`);
      await page.waitForSelector(".loading", { state: "detached", timeout: 60_000 });
      await page.waitForSelector(".labels.city .bl b");
      const most = await oneAtATime(page, async () => {
        expect(await page.locator(".celebration").count()).toBe(0);
        await page.clock.fastForward(600_000);
        await page.clock.runFor(200);
        const float = page.locator(".celebration.float");
        await float.waitFor();
        await expect(float.textContent()).resolves.toBe("Refinery level 3");
        // Its rise runs on the real clock, its life on the page's: held at mid-way for the picture.
        await float.evaluate((e) => {
          const f = e.firstElementChild as HTMLElement;
          f.style.animation = "none";
          void f.offsetWidth;
          f.style.animation = "rise 1.2s ease-out -0.4s paused both";
        });
        await page.screenshot({ path: `e2e/.shots/shot-celebrate-work-${size.width}.png` });
        await page.clock.runFor(1300);
        await float.waitFor({ state: "detached" });
        await page.clock.fastForward(600_000);
        await page.clock.runFor(200);
        const full = page.locator(".celebration.lighthouse");
        await full.waitFor();
        await expect(full.textContent()).resolves.toContain("Lighthouse level 5");
        await page.waitForTimeout(600);
        await page.screenshot({ path: `e2e/.shots/shot-celebrate-lighthouse-${size.width}.png` });
        // A tap closes it.
        await full.click();
        await full.waitFor({ state: "detached" });
        // The Logbook takes the lead captain one level up.
        await page.locator('.nav button[data-v="captains"]').click();
        await page.locator('.sheet.captains [data-act="logbook"]').click();
        await page.clock.runFor(100);
        const card = page.locator(".celebration.captain");
        await card.waitFor();
        await expect(card.textContent()).resolves.toContain("reached level 2");
        await expect.poll(() => card.locator("img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth === 512 && i.src.endsWith("-512.webp"))).toBe(true);
        await page.screenshot({ path: `e2e/.shots/shot-celebrate-captain-${size.width}.png` });
        await page.clock.runFor(2600);
        await card.waitFor({ state: "detached" });
      });
      expect(most).toBe(1);
      await p.context.close();
    }
  });

  it("at launch: one card for what ended while you were away; nothing on the very first launch", async () => {
    // Saved and last seen two hours ago, with two works that ended since.
    const city = { ...ending(), research: { id: "saws", left: 60, duration: 600 }, buildings: { ...ending().buildings, observatory: 1 } };
    for (const first of [false, true]) {
      const p = await newPlayer(false);
      const savedAt = Date.now() - 2 * 3600_000;
      await p.context.addInitScript(
        ({ save, seen, file, owner }) => {
          if (sessionStorage.getItem("e2e-injected")) return;
          localStorage.setItem(save, file);
          if (owner) localStorage.setItem(seen, owner);
          sessionStorage.setItem("e2e-injected", "1");
        },
        { save: SAVE_KEY, seen: SEEN_KEY, file: JSON.stringify({ v: 1, savedAt, state: city }), owner: first ? "" : JSON.stringify({ owner: "device", state: city }) },
      );
      const page = await openGame(p.context);
      if (first) {
        await page.waitForTimeout(1500);
        expect(await page.locator(".celebration").count()).toBe(0);
        // From now on, this city is the one seen here.
        await expect.poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null")?.owner, SEEN_KEY)).toBe("device");
      } else {
        const card = page.locator(".celebration.away");
        await card.waitFor();
        const text = await card.textContent();
        expect(text).toContain("While you were away");
        for (const line of ["Refinery level 3", "Lighthouse level 5", "Tide Saws level 1"]) expect(text).toContain(line);
        await page.screenshot({ path: "e2e/.shots/shot-celebrate-away.png" });
        // Reloaded at once: nothing more ended, nothing told.
        await page.reload();
        await page.waitForSelector(".labels.city .bl b");
        await page.waitForTimeout(1500);
        expect(await page.locator(".celebration").count()).toBe(0);
      }
      await p.context.close();
    }
  });

  it("signed in: nothing when the account's city takes the screen; at the next launch, what ended on the server while you were away", async () => {
    const p = await signedInPlayer();
    const base = newPlayerState();
    // The account's city is ahead of the city of this device; sign out, then in again: it takes the screen, silently.
    await h.putCity(p.playerId, { ...base, buildings: { ...base.buildings, lighthouse: 5, refinery: 4, observatory: 1 }, stock: { oil: 9000, fish: 9000, wood: 9000, rope: 10 } });
    await signOut(p.page);
    await signIn(p.page);
    await p.page.locator(".toast", { hasText: TEXT.signedIn }).waitFor();
    await expect.poll(async () => (await copyOf(p.page, p.playerId))?.server?.state.buildings.refinery, NET).toBe(4);
    await p.page.waitForTimeout(1500);
    expect(await p.page.locator(".celebration").count()).toBe(0);
    // Away: on the server, two works end.
    const token = (await session(p.page))!.token;
    const now = (await serverCity(token))!.state as unknown as PlayerState;
    await p.page.close();
    await h.putCity(p.playerId, { ...now, queue: [{ id: "refinery", left: 1, duration: 60 }], research: { id: "nets", left: 1, duration: 60 } });
    await new Promise((r) => setTimeout(r, 2500));
    const page = await openGame(p.context);
    const card = page.locator(".celebration.away");
    await card.waitFor({ timeout: 15_000 });
    const text = await card.textContent();
    for (const line of ["While you were away", "Refinery level 5", "Braided Nets level 1"]) expect(text).toContain(line);
    expect(p.problems).toEqual([]);
    await p.context.close();
  });
});

describe("the Mist's mood", () => {
  it("the Mist's mood: calm before a Mist, the Mist's look when the rules say it is on, and with ?mist to see it", async () => {
    /**
     * A city saved at T, its own clock at `clock` (UTC seconds): the banner and the 3D view read the rules on it. The
     * page's clock is paused at T + 1 s, so no game time passes before the banner is read: the e2e build runs a city
     * without an account 60 times faster (DEV_SPEED, docs/decisions.md), and a page that lived 5 seconds would count
     * 5 minutes down. Then the clock runs for the FPS counter.
     */
    const T = new Date("2026-10-18T12:00:00.000Z").getTime();
    const look = async (query: string, clock: number) => {
      const p = await newPlayer(false);
      await p.context.addInitScript(({ key, file }) => localStorage.setItem(key, file), { key: SAVE_KEY, file: JSON.stringify({ v: 1, savedAt: T, state: newPlayerState(clock) }) });
      const page = await p.context.newPage();
      await page.clock.install({ time: T });
      await page.clock.pauseAt(new Date(T + 1000));
      await page.goto(`${GAME}/?quality=2&fps${query}`);
      await page.waitForSelector(".loading", { state: "detached", timeout: 60_000 });
      const banner = await page.locator('.sub [data-k="mist"]').innerText();
      // Frames for the counter: the page's clock runs 200 ms at a time until it shows the draw calls.
      for (let i = 0; i < 50 && !/calls/.test(await page.locator(".fps").innerText().catch(() => "")); i++) await page.clock.runFor(200);
      await page.clock.runFor(1500);
      const fps = await page.locator(".fps").innerText();
      await page.screenshot({ path: `e2e/.shots/shot-mood-${query ? "preview" : clock % (24 * HOUR) >= 4 * HOUR ? "mist" : "calm"}.png` });
      await p.context.close();
      return { banner, fps, calls: Number(/(\d+) calls/.exec(fps)![1]) };
    };
    // 18 October 2026: 01:00 UTC is calm (the next Mist at 04:00), 04:30 is in the Mist.
    const day = 1_792_281_600;
    const calm = await look("", day + HOUR);
    const mist = await look("", day + 4.5 * HOUR);
    const preview = await look("&mist", day + HOUR);
    expect(calm.banner).toBe("Mist in 3 h 00 · enough oil");
    expect(calm.fps).not.toMatch(/Mist/);
    expect(mist.banner).toBe("Mist · 1 h 30 left · Lighthouse stoked");
    expect(mist.fps).toMatch(/City · Mist/);
    expect(preview.banner).toMatch(/^Mist · /);
    expect(preview.fps).toMatch(/City · Mist/);
    // The veil on the horizon (+1), and the Lighthouse's two beams, hidden in calm and sweeping in the Mist (+4: each
    // cone is drawn on both sides).
    console.log(`The Mist's mood: calm ${calm.calls} calls, Mist ${mist.calls} calls, ?mist ${preview.calls} calls`);
    expect(mist.calls).toBe(calm.calls + 5);
    expect(preview.calls).toBe(mist.calls);
  });
});

describe("sounds", () => {
  it("nothing before the first tap; turned off in the Profile, without an account, they stay off after a reload", async () => {
    const p = await newPlayer(false);
    // Counts the AudioContexts the page makes, and the notes it starts.
    await p.context.addInitScript(() => {
      const w = window as unknown as { AudioContext: typeof AudioContext; __audio: { made: number; notes: number } };
      w.__audio = { made: 0, notes: 0 };
      const Real = w.AudioContext;
      w.AudioContext = class extends Real {
        constructor(...a: ConstructorParameters<typeof AudioContext>) {
          super(...a);
          w.__audio.made++;
          const make = this.createOscillator.bind(this);
          this.createOscillator = () => {
            const o = make();
            const start = o.start.bind(o);
            o.start = (...t: Parameters<OscillatorNode["start"]>) => {
              w.__audio.notes++;
              start(...t);
            };
            return o;
          };
        }
      };
    });
    const audio = (page: Page) => page.evaluate(() => (window as unknown as { __audio: { made: number; notes: number } }).__audio);
    const page = await openGame(p.context);
    await page.waitForTimeout(1500);
    expect(await audio(page)).toEqual({ made: 0, notes: 0 });
    // The first tap: the Captains button knocks, and its sheet opens like a rope.
    await page.locator('.nav button[data-v="captains"]').click();
    await expect.poll(async () => (await audio(page)).notes).toBeGreaterThan(0);
    expect((await audio(page)).made).toBe(1);
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.sheet:not([hidden]) [data-act="close"]')?.click());
    // The Profile opens without an account: the switch is there, on.
    await page.locator(".hud .lvl").click();
    const button = page.locator('.profile [data-act="sound"]');
    await expect(button.textContent()).resolves.toBe("On");
    await button.click();
    await expect(button.textContent()).resolves.toBe("Off");
    await expect(button.getAttribute("aria-pressed")).resolves.toBe("false");
    await page.screenshot({ path: "e2e/.shots/shot-profile-sounds-off.png" });
    await page.reload();
    await page.waitForSelector(".labels.city .bl b");
    await page.locator(".hud .lvl").click();
    await expect(page.locator('.profile [data-act="sound"]').textContent()).resolves.toBe("Off");
    await page.locator('.profile [data-act="close"]').click();
    await page.locator('.nav button[data-v="captains"]').click();
    await page.waitForTimeout(300);
    expect(await audio(page)).toEqual({ made: 0, notes: 0 });
    await p.context.close();
  });
});

describe("short motions", () => {
  /** The animations and transitions running in the page, by name (CSS animation) or property (transition). */
  const running = (page: Page) =>
    page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty));

  it("a sheet opens with \"up\" and closes down, already hidden and out of the way of taps; a button pressed sinks", async () => {
    const p = await newPlayer(false);
    const page = await openGame(p.context);
    // Opened and closed, the motions are read in the same task as the tap: the container draws slowly, and a 220 ms
    // motion can be over before a later read.
    const opening = await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('.nav button[data-v="captains"]')!.click();
      return document.getAnimations().map((a) => (a as CSSAnimation).animationName);
    });
    expect(opening).toContain("up");
    // Its "up" starts on the next frame drawn: wait for it to end, however slowly the container draws.
    await expect.poll(() => running(page), NET).not.toContain("up");
    // Closed: at once [hidden] and out of the way of taps, while its picture goes down for 160 ms.
    const closing = await page.evaluate(() => {
      const e = document.querySelector<HTMLElement>(".sheet.captains")!;
      e.querySelector<HTMLButtonElement>('[data-act="close"]')!.click();
      return { hidden: e.hidden, taps: getComputedStyle(e).pointerEvents, moving: document.getAnimations().map((a) => (a as CSSTransition).transitionProperty) };
    });
    expect(closing).toEqual({ hidden: true, taps: "none", moving: expect.arrayContaining(["translate", "opacity", "display"]) });
    await page.waitForTimeout(300);
    expect(await page.locator(".sheet.captains").evaluate((e) => getComputedStyle(e).display)).toBe("none");
    // A pressed button sinks by 2 px and shrinks a little.
    await page.locator('.nav button[data-v="captains"]').click();
    const lead = page.locator('.sheet.captains .b').first();
    const box = (await lead.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    expect(await lead.evaluate((e) => getComputedStyle(e).transform)).toBe("matrix(0.97, 0, 0, 0.97, 0, 2)");
    await page.mouse.up();
    await p.context.close();
  });

  it("with reduced motion on the device: nothing moves, the celebrations stand still", async () => {
    const p = await newPlayer(false);
    const t0 = Date.now();
    const city = { ...newPlayerState(), queue: [{ id: "refinery" as const, left: 600, duration: 900 }] };
    await p.context.addInitScript(({ key, file }) => localStorage.setItem(key, file), { key: SAVE_KEY, file: JSON.stringify({ v: 1, savedAt: t0, state: city }) });
    const page = await p.context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install({ time: t0 });
    await page.clock.pauseAt(t0 + 500);
    await page.goto(`${GAME}/?quality=2`);
    await page.waitForSelector(".loading", { state: "detached", timeout: 60_000 });
    await page.waitForSelector(".labels.city .bl b");
    await page.locator('.nav button[data-v="captains"]').click();
    expect(await running(page)).toEqual([]);
    await page.locator('.sheet.captains [data-act="close"]').click();
    expect(await running(page)).toEqual([]);
    await page.clock.fastForward(600_000);
    await page.clock.runFor(200);
    const float = page.locator(".celebration.float .cel-float");
    await float.waitFor();
    expect(await running(page)).toEqual([]);
    expect(await float.evaluate((e) => [getComputedStyle(e).opacity, getComputedStyle(e).transform])).toEqual(["1", "none"]);
    await p.context.close();
  });
});

describe("building tiers", () => {
  it("every building at level 1, 5 and 10: the three tiers, captured, with their draw calls and FPS (?fps)", async () => {
    const rows: string[] = [];
    for (const [tier, level, lighthouse] of [
      [1, 1, 4],
      [2, 5, 9],
      [3, 10, 12],
    ] as const) {
      const base = newPlayerState();
      const city: PlayerState = { ...base, buildings: { lighthouse, refinery: level, fishery: level, lumberyard: level, shelters: level, barracks: level, harbor: level, observatory: level, infirmary: level } };
      const p = await newPlayer(false);
      await p.context.addInitScript(({ key, file }) => localStorage.setItem(key, file), { key: SAVE_KEY, file: JSON.stringify({ v: 1, savedAt: Date.now(), state: city }) });
      const page = await p.context.newPage();
      await page.goto(`${GAME}/?quality=2&fps`);
      await page.waitForSelector(".loading", { state: "detached", timeout: 60_000 });
      await page.waitForSelector(".labels.city .bl b");
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `e2e/.shots/shot-tier-${tier}.png` });
      // As the art direction asks: each building by its silhouette, close up, without the labels.
      await page.addStyleTag({ content: ".labels{visibility:hidden}" });
      await page.mouse.move(206, 470);
      await page.mouse.wheel(0, -900);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `e2e/.shots/shot-tier-${tier}-near.png` });
      await page.mouse.wheel(0, 900);
      // The counter needs a few seconds of frames.
      await page.waitForTimeout(12_000);
      rows.push(`tier ${tier} (level ${level}, Lighthouse ${lighthouse}): ${(await page.locator(".fps").textContent())!.replace(/\n/g, " · ")}`);
      await p.context.close();
    }
    // During the Lighthouse's full-screen celebration (2.5 s): the counter shows the last second.
    const base = newPlayerState();
    const p = await newPlayer(false);
    const city: PlayerState = { ...base, buildings: { ...base.buildings, lighthouse: 9 }, queue: [{ id: "lighthouse", left: 35, duration: 600 }] };
    await p.context.addInitScript(({ key, file }) => localStorage.setItem(key, file), { key: SAVE_KEY, file: JSON.stringify({ v: 1, savedAt: Date.now(), state: city }) });
    const page = await p.context.newPage();
    await page.goto(`${GAME}/?quality=2&fps`);
    await page.waitForSelector(".loading", { state: "detached", timeout: 60_000 });
    await page.locator(".celebration.lighthouse").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1600);
    rows.push(`during the Lighthouse's celebration: ${(await page.locator(".fps").textContent())!.replace(/\n/g, " · ")}`);
    await p.context.close();
    mkdirSync("e2e/.shots", { recursive: true });
    writeFileSync("e2e/.shots/tiers.txt", rows.join("\n") + "\n");
    console.log(`Building tiers:\n${rows.join("\n")}`);
  });
});

/**
 * The look of every sheet, compared pixel by pixel with the references in e2e/look/ (week 6, task 2: the shared
 * interface components must not change it). The page's clock is fixed (page.clock), the 3D view and its labels are
 * hidden at the moment of each capture, and each capture is cut to its element. LOOK=update writes the references;
 * every capture is also written to e2e/.shots/look/ (an artifact of the CI's e2e job).
 * The references are made by the CI's e2e job (its captures, downloaded): another machine draws text a little
 * differently. So a difference fails the test in the CI (or with LOOK=strict), and is only reported elsewhere.
 * How to make them: e2e/look/README.md.
 */
describe("the look", () => {
  const T0 = new Date("2026-10-18T12:00:00.000Z");
  const REF = "e2e/look";
  const OUT = "e2e/.shots/look";
  const update = process.env.LOOK === "update";
  const strict = !!process.env.CI || process.env.LOOK === "strict";
  const problems: string[] = [];
  /**
   * The only captures with a second reference (docs/decisions.md, 17 October): some AMD machines of the CI (EPYC 9V74,
   * 9V45) draw the left corners of the captain rows a little differently, with the same layout. Any third drawing fails, as
   * for the others.
   */
  const VARIANTS: Readonly<Record<string, readonly string[]>> = { "captains-top-412": ["variant"], "captains-top-360": ["variant"] };
  /** Which reference each capture with a second one matched. */
  const matched: string[] = [];
  /** Taps that miss their button: on every machine, they fail the test. */
  const missed: string[] = [];
  /** Neighbor buttons whose 44 px squares overlap: they share the space between them. */
  const pairs = new Set<string>();
  const ok = (r: ActionResult) => {
    if (!r.ok) throw new Error(r.reason);
    return r.state;
  };

  /**
   * The city's own clock for the captures: 06:00 UTC, just after a Mist, whatever time the city was advanced to. The
   * captures stay in calm weather, and the Mist banner, whose card's shadow reaches the top bar and the queue, always
   * says the same thing.
   */
  const CALM = 6 * HOUR;
  /** Opens the game with its clock fixed at T0, a city saved at T0 (in calm weather), then pauses the clock 5 minutes later. */
  async function frozenGame(size: { width: number; height: number }, city: PlayerState): Promise<Page> {
    const p = await newPlayer(false, size);
    await p.context.addInitScript(
      ({ key, file }) => {
        if (sessionStorage.getItem("e2e-injected")) return;
        localStorage.setItem(key, file);
        sessionStorage.setItem("e2e-injected", "1");
      },
      { key: SAVE_KEY, file: JSON.stringify({ v: 1, savedAt: T0.getTime(), state: { ...city, clock: CALM } }) },
    );
    const page = await p.context.newPage();
    // Paused before the game starts: however long the loading takes, the game sees the same times, frame by frame.
    await page.clock.install({ time: T0 });
    await page.clock.pauseAt(new Date(T0.getTime() + 1000));
    await page.goto(`${GAME}/?quality=2`);
    await page.waitForSelector(".loading", { state: "detached", timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.clock.fastForward(5 * 60_000);
    await page.clock.runFor(200);
    await page.waitForSelector(".labels.city .bl b");
    return page;
  }

  /** Captures `what`, the 3D view hidden, and compares it with its reference (or writes it, with LOOK=update). */
  async function look(page: Page, what: Locator, name: string, hide = ""): Promise<void> {
    await page.evaluate((hide) => {
      const s = document.createElement("style");
      s.id = "look-hide";
      // Captured standing still (as with reduced motion): the celebrations' motions and the bars' 300 ms transitions run
      // on the real clock. `hide`: what else is hidden for this capture.
      s.textContent = `#cv,.labels{visibility:hidden!important}.celebration *{animation:none!important}*{transition:none!important}${hide}`;
      document.head.appendChild(s);
    }, hide);
    const png = await what.screenshot({ animations: "disabled", caret: "hide" });
    await page.evaluate(() => document.getElementById("look-hide")?.remove());
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/${name}.png`, png);
    const ref = `${REF}/${name}.png`;
    if (update) {
      mkdirSync(REF, { recursive: true });
      writeFileSync(ref, png);
      return;
    }
    await taps(what, name);
    if (!existsSync(ref)) return void problems.push(`${name}: no reference`);
    const shot = decodePng(png);
    for (const v of VARIANTS[name] ?? []) {
      const variant = `${REF}/${name}.${v}.png`;
      if (!existsSync(variant)) problems.push(`${name}: no reference ${variant}`);
      else if (comparePixels(decodePng(readFileSync(variant)), shot).differing === 0) return void matched.push(`${name}: ${name}.${v}.png`);
    }
    const d = comparePixels(decodePng(readFileSync(ref)), shot);
    if (VARIANTS[name] && d.size && !d.differing) matched.push(`${name}: ${name}.png`);
    if (!d.size) problems.push(`${name}: not the same size`);
    else if (d.differing) problems.push(`${name}: ${d.differing} pixels differ, the first at ${d.first!.x},${d.first!.y}`);
  }

  /**
   * Every button in `what` can be tapped on a 44 px square around its center (or its own size when bigger): a tap at
   * the middle of each side of that square reaches the button, except on the side of a neighbor whose square overlaps
   * (the pair is listed), outside the screen, or outside the part of a sheet that scrolls.
   */
  async function taps(what: Locator, name: string): Promise<void> {
    const r = await what.evaluate((root) => {
      const label = (e: HTMLElement) => {
        const data = Object.entries(e.dataset)
          .filter(([k]) => k !== "act")
          .map(([k, v]) => `${k}=${v}`)
          .join(",");
        return `${e.dataset.act ?? e.className}${data ? `(${data})` : ""} "${(e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 30)}"`;
      };
      const all = [root as HTMLElement, ...root.querySelectorAll<HTMLElement>("*")].filter(
        (e) => e.matches("button, [role=button], .build-badge") && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden",
      );
      const squares = all.map((e) => {
        const b = e.getBoundingClientRect();
        const w = Math.max(44, b.width);
        const h = Math.max(44, b.height);
        const x = b.x + b.width / 2;
        const y = b.y + b.height / 2;
        let clip: DOMRect | null = null;
        for (let a = e.parentElement; a; a = a.parentElement) if (getComputedStyle(a).overflowY !== "visible") clip ??= a.getBoundingClientRect();
        return { e, x, y, l: x - w / 2, r: x + w / 2, t: y - h / 2, b: y + h / 2, clip };
      });
      const misses: string[] = [];
      const pairs: string[] = [];
      for (const s of squares) {
        const others = squares.filter((o) => o !== s && o.l < s.r && s.l < o.r && o.t < s.b && s.t < o.b);
        for (const o of others) pairs.push([label(s.e), label(o.e)].sort().join(" + "));
        for (const [px, py] of [[s.x, s.t + 1], [s.x, s.b - 1], [s.l + 1, s.y], [s.r - 1, s.y]] as const) {
          if (px < 0 || py < 0 || px >= innerWidth || py >= innerHeight) continue;
          if (s.clip && (px < s.clip.left || px >= s.clip.right || py < s.clip.top || py >= s.clip.bottom)) continue;
          if (others.some((o) => px >= o.l && px < o.r && py >= o.t && py < o.b)) continue;
          const hit = document.elementFromPoint(px, py);
          if (!hit || !s.e.contains(hit)) misses.push(`${label(s.e)} at ${Math.round(px)},${Math.round(py)} gives ${hit ? (hit as HTMLElement).className || hit.tagName : "nothing"}`);
        }
      }
      return { misses, pairs };
    });
    for (const m of r.misses) missed.push(`${name}: a tap misses ${m}`);
    for (const p of r.pairs) pairs.add(p);
  }

  const sheet = (page: Page) => page.locator(".sheet:not([hidden])").first();
  const close = (page: Page) => page.evaluate(() => document.querySelector<HTMLButtonElement>('.sheet:not([hidden]) [data-act="close"]')?.click());
  const toBottom = (page: Page) => page.evaluate(() => document.querySelectorAll(".sheet:not([hidden]) .sh-b").forEach((b) => (b.scrollTop = b.scrollHeight)));

  it("every sheet, the top bar and the queue, at 412 and 360 px", async () => {
    for (const size of SIZES) {
      const w = size.width;
      const clear = slotsOnScreen(6, size.width, size.height);
      const base = newPlayerState();

      // A built city: every building, a research, a work at the shipyard, rafts, wounded and captains.
      let town: PlayerState = {
        ...base,
        buildings: { lighthouse: 6, refinery: 3, fishery: 6, lumberyard: 2, shelters: 2, barracks: 3, harbor: 1, observatory: 3, infirmary: 1 },
        techs: { veterans: 1, blades: 1 },
        troops: { boarders: 60, harpooners: 60, crossbowmen: 60 },
        wounded: { boarders: 12, harpooners: 5, crossbowmen: 3 },
        stock: { oil: 9000, fish: 9000, wood: 9000, rope: 10 },
        captains: { tom: { level: 3, xp: 40, stars: 2 }, sel: { level: 1, xp: 0, stars: 1 } },
        shards: { sel: 4, mira: 7 },
        rafts: {
          [clear[0]!.slot]: { hp: 100, building: null, level: 0 },
          [clear[1]!.slot]: { hp: 100, building: "greenhouse", level: 2 },
          [clear[2]!.slot]: { hp: 100, building: null, level: 0 },
        },
      };
      town = ok(upgrade(town, "lumberyard"));
      town = ok(research(town, "nets"));
      town = ok(installOnRaft(town, clear[2]!.slot, "watchtower"));
      let page = await frozenGame(size, town);
      await look(page, page.locator(".hud"), `hud-${w}`);
      for (const [name, file] of [
        ["Refinery", "refinery"],
        ["Fishery", "fishery"],
        ["Lumberyard", "lumberyard-working"],
        ["Barracks", "barracks"],
        ["Infirmary", "infirmary"],
      ] as const) {
        await openSheet(page, name);
        await look(page, sheet(page), `${file}-${w}`);
        await close(page);
      }
      await openSheet(page, "Observatory");
      await look(page, sheet(page), `observatory-top-${w}`);
      await toBottom(page);
      await look(page, sheet(page), `observatory-bottom-${w}`);
      await close(page);
      for (const [i, file] of [
        [0, "raft-free"],
        [1, "raft-building"],
        [2, "raft-working"],
      ] as const) {
        await page.mouse.click(clear[i]!.x, clear[i]!.y);
        await page.locator(".raft-sheet:not([hidden])").waitFor();
        await look(page, page.locator(".raft-sheet"), `${file}-${w}`);
        await close(page);
      }
      await page.locator('.nav button[data-v="captains"]').click();
      await look(page, sheet(page), `captains-top-${w}`);
      // Where the captain rows fall, to the fraction of a pixel: their rounded corners were drawn in two ways by the CI.
      console.log(
        `Captain rows at ${w} px (devicePixelRatio ${await page.evaluate(() => devicePixelRatio)}): ` +
          (await sheet(page).locator(".it.captain").evaluateAll((rows) => rows.map((r) => { const b = r.getBoundingClientRect(); return `${b.top}..${b.bottom} (left ${b.left})`; }))).join(", "),
      );
      await toBottom(page);
      await look(page, sheet(page), `captains-bottom-${w}`);
      await close(page);
      await page.locator(".hud .lvl").click();
      await look(page, page.locator(".sheet.profile"), `profile-${w}`);
      await page.context().close();

      // A poor city after a victory: the report opens by itself; a refused upgrade; a free slot; the sea's sheets.
      const sent = sail({ ...base, buildings: { ...base.buildings, lighthouse: 4 }, troops: { boarders: 200, harpooners: 200, crossbowmen: 200 }, shards: { sel: 9 } }, "camp-1");
      if (!sent.ok) throw new Error(sent.reason);
      const poor: PlayerState = { ...advance(sent.state, 8 * HOUR), stock: { oil: 50, fish: 50, wood: 50, rope: 0 } };
      page = await frozenGame(size, poor);
      await page.locator('.sheet[aria-label="Combat report"]:not([hidden])').waitFor();
      await look(page, sheet(page), `report-${w}`);
      await close(page);
      await page.clock.runFor(200);
      await openSheet(page, "Refinery");
      await look(page, sheet(page), `refinery-refused-${w}`);
      await close(page);
      const free = slotsOnScreen(4, size.width, size.height)[0]!;
      await page.mouse.click(free.x, free.y);
      await page.locator(".raft-sheet:not([hidden])").waitFor();
      await look(page, page.locator(".raft-sheet"), `raft-slot-${w}`);
      await close(page);
      await page.context().close();
      // At sea, on a page whose clock runs: finding a site needs drawn frames, and a site's sheet holds no time.
      const seaPlayer = await newPlayer(false, size);
      await injectCity(seaPlayer.context, { ...poor, reports: poor.reports.map((r) => ({ ...r, read: true })) });
      page = await openGame(seaPlayer.context);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.nav button[data-v="sea"]').click();
      await page.waitForTimeout(1500);
      for (const kind of ["camp", "wreck"] as const) {
        if (kind === "wreck") {
          // Farther out: the wrecks are beyond the first view.
          await page.mouse.move(size.width / 2, size.height / 2);
          await page.mouse.wheel(0, 1500);
          await page.waitForTimeout(1000);
        }
        const labels = page.locator(`.labels.sea .sl.${kind}:visible`);
        const site = page.locator(".sheet:not([hidden])", { has: page.locator('[data-act="sail"]') });
        let found = false;
        for (let i = 0; i < (await labels.count()) && !found; i++) {
          const box = (await labels.nth(i).boundingBox())!;
          for (const dy of [30, 45, 60, 15, 8]) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height + dy);
            if (await site.isVisible()) {
              found = true;
              break;
            }
          }
        }
        if (!found) await page.screenshot({ path: `${OUT}/debug-${kind}-${w}.png` });
        expect(found, kind).toBe(true);
        await look(page, site, `${kind}-${w}`);
        await close(page);
      }
      await page.context().close();

      // Six works: the queue folded, then unfolded.
      let busy: PlayerState = {
        ...base,
        buildings: { ...base.buildings, lighthouse: 6, barracks: 3, observatory: 3, infirmary: 1 },
        techs: { veterans: 1 },
        troops: { boarders: 25, harpooners: 25, crossbowmen: 25 },
        wounded: { boarders: 12, harpooners: 5, crossbowmen: 3 },
        stock: { oil: 50_000, fish: 50_000, wood: 50_000, rope: 3 },
      };
      busy = ok(upgrade(busy, "observatory"));
      busy = ok(upgrade(busy, "infirmary"));
      busy = ok(research(busy, "warehouses"));
      busy = ok(promote(busy, "crossbowmen"));
      busy = ok(heal(busy));
      busy = ok(sail(busy, "camp-1"));
      page = await frozenGame(size, busy);
      await look(page, page.locator(".queue"), `queue-folded-${w}`);
      await page.locator(".queue .more").click();
      await look(page, page.locator(".queue"), `queue-open-${w}`);
      await page.context().close();

      // The celebrations (week 6, task 3): a work that ends, the Lighthouse, a captain who rises a level.
      const ending: PlayerState = {
        ...base,
        buildings: { ...base.buildings, lighthouse: 4, refinery: 2 },
        stock: { oil: 9000, fish: 9000, wood: 9000, rope: 10 },
        pearls: 500,
        queue: [
          { id: "refinery", left: 600, duration: 900 },
          { id: "lighthouse", left: 1200, duration: 1800 },
        ],
        captains: { ...base.captains, [base.lead!]: { level: 1, xp: 79, stars: 1 } },
      };
      page = await frozenGame(size, ending);
      await page.clock.fastForward(600_000);
      await page.clock.runFor(200);
      await look(page, page.locator(".celebration.float"), `celebrate-work-${w}`);
      await page.clock.runFor(1300);
      await page.clock.fastForward(600_000);
      await page.clock.runFor(200);
      // The top bar and the line under it are hidden under the veil: the CI draws their rounded bars there in two ways
      // (week 6), and they have their own captures.
      await look(page, page.locator(".celebration.lighthouse"), `celebrate-lighthouse-${w}`, ".hud,.sub{visibility:hidden!important}");
      await page.locator(".celebration.lighthouse").click();
      await page.locator('.nav button[data-v="captains"]').click();
      await page.locator('.sheet.captains [data-act="logbook"]').click();
      await page.clock.runFor(100);
      const card = page.locator(".celebration.captain");
      await expect.poll(() => card.locator("img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth === 512)).toBe(true);
      await look(page, card.locator(".cel-card"), `celebrate-captain-${w}`);
      await page.context().close();
    }
    writeFileSync(`${OUT}/pairs.txt`, [...pairs].sort().join("\n") + "\n");
    // Two CI machines can draw a rounded corner a little differently (week 6): which processor drew these captures.
    const flags = existsSync("/proc/cpuinfo") ? readFileSync("/proc/cpuinfo", "utf8") : "";
    console.log(`Drawn on: ${cpus()[0]?.model ?? "?"}, AVX-512 ${/\bavx512f\b/.test(flags) ? "yes" : "no"}`);
    console.log(`References matched: ${matched.join(", ") || "none"}`);
    console.log(`Neighbor buttons sharing their 44 px squares:\n${[...pairs].sort().join("\n")}`);
    expect(missed).toEqual([]);
    if (strict) expect(problems).toEqual([]);
    else if (problems.length) console.warn(`The look differs from the CI's references on this machine (LOOK=strict to fail):\n${problems.join("\n")}`);
  });
});

describe("signed in", () => {
  it("the account has its own city: one message; an upgrade goes to the server, and is found again after a reload", async () => {
    const p = await newPlayer(true);
    const page = await openGame(p.context);
    await page.locator(".hud .lvl").click();
    await page.screenshot({ path: "e2e/.shots/shot-profile-sign-in.png" });
    await page.locator('.profile [data-act="close"]').click();
    // Played on this device first: that city stays here, and never goes to the account.
    await upgradeBuilding(page, "Refinery");
    await signIn(page);
    await page.locator(".toast", { hasText: TEXT.ownCity }).waitFor();
    await page.screenshot({ path: "e2e/.shots/shot-own-city.png" });
    const { token, playerId } = (await session(page))!;
    await expect.poll(() => shownJobs(page), NET).toEqual([]);

    await upgradeBuilding(page, "Fishery");
    await expect.poll(() => shownJobs(page), NET).toEqual(["Fishery"]);
    await serverHas(token, ["fishery"]);
    expect(queued(await localCity(page))).toEqual(["refinery"]);

    await page.reload();
    await page.waitForSelector(".labels.city .bl b");
    await expect.poll(() => shownJobs(page), NET).toEqual(["Fishery"]);
    expect((await copyOf(page, playerId))?.pending).toEqual([]);
    expect(queued(await localCity(page))).toEqual(["refinery"]);
    await page.screenshot({ path: "e2e/.shots/shot-signed-in.png" });
    expect(p.problems).toEqual([]);
    await p.context.close();
  });

  it("an action sent as the page goes away (fetch keepalive, with Authorization) passes CORS and reaches the server, once", async () => {
    const p = await signedInPlayer();
    // Chromium keeps a CORS check 5 s (no Access-Control-Max-Age): past that, the action needs a new, slow preflight.
    await p.page.waitForTimeout(6000);
    await upgradeBuilding(p.page, "Refinery");
    // A real navigation away, no help from the test: the page is hidden and unloaded, so only a keepalive request can finish.
    await p.page.goto("about:blank");
    const first = await serverHas(p.token, ["refinery"]);
    // The page never got the answer: back, it sends the action again with the same id, and the server applies nothing twice.
    const back = await openGame(p.context);
    await expect.poll(async () => (await copyOf(back, p.playerId))?.pending.length, NET).toBe(0);
    expect(p.actionIds).toHaveLength(2);
    expect(new Set(p.actionIds).size).toBe(1);
    expect((await serverCity(p.token))?.version).toBe(first.version);
    await expect.poll(() => shownJobs(back), NET).toEqual(["Refinery"]);
    expect(p.problems).toEqual([]);
    await p.context.close();
  });

  it("two tabs: an action in each, both applied by the server; each tab shows both", async () => {
    const p = await signedInPlayer();
    const a = p.page;
    const b = await openGame(p.context);
    await upgradeBuilding(a, "Refinery");
    await serverHas(p.token, ["refinery"]);
    await upgradeBuilding(b, "Fishery");
    await serverHas(p.token, ["fishery", "refinery"]);
    await expect.poll(() => shownJobs(b), NET).toEqual(["Fishery", "Refinery"]);
    // The other tab learns it when it is shown again.
    await show(a);
    await expect.poll(() => shownJobs(a), NET).toEqual(["Fishery", "Refinery"]);
    expect(p.problems).toEqual([]);
    await p.context.close();
  });

  it("signing out shows the city of this device again; the account's city stays on this device", async () => {
    const p = await signedInPlayer();
    await upgradeBuilding(p.page, "Refinery");
    await serverHas(p.token, ["refinery"]);
    await signOut(p.page);
    expect(await session(p.page)).toBeNull();
    await expect.poll(() => shownJobs(p.page), NET).toEqual([]);
    expect(queued((await copyOf(p.page, p.playerId))?.server?.state ?? null)).toEqual(["refinery"]);
    await hide(p.page);
    expect(queued(await localCity(p.page))).toEqual([]);
    await p.context.close();
  });

  it("two upgrades tapped quickly with a slow server: both stay on screen, without flickering, until the server has both", async () => {
    const p = await signedInPlayer();
    holdActions(1500);
    try {
      // Every frame, the number of upgrades on screen.
      await p.page.evaluate(() => {
        const w = window as unknown as { __jobs: number[] };
        w.__jobs = [];
        const frame = () => {
          w.__jobs.push([...document.querySelectorAll(".queue .n")].filter((e) => !(e.textContent ?? "").startsWith("Fleet")).length);
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      await upgradeBuilding(p.page, "Refinery");
      await upgradeBuilding(p.page, "Fishery");
      await serverHas(p.token, ["fishery", "refinery"]);
      await expect.poll(async () => (await copyOf(p.page, p.playerId))?.pending.length, NET).toBe(0);
      await p.page.waitForTimeout(500);
      const jobs = await p.page.evaluate(() => (window as unknown as { __jobs: number[] }).__jobs);
      const drops = jobs.filter((n, i) => n < Math.max(...jobs.slice(0, i + 1)));
      expect(jobs.at(-1)).toBe(2);
      expect(Math.max(...jobs)).toBe(2);
      expect(drops, `on screen, frame after frame: ${jobs.join("")}`).toEqual([]);
      // The second action left only once the first had its answer.
      expect(p.actionIds).toHaveLength(2);
    } finally {
      holdActions(0);
    }
    await p.context.close();
  });

  it("offline: the actions wait on this device, then leave in order when the network is back", async () => {
    const p = await signedInPlayer();
    await p.context.setOffline(true);
    await upgradeBuilding(p.page, "Refinery");
    await upgradeBuilding(p.page, "Fishery");
    await expect.poll(() => shownJobs(p.page), NET).toEqual(["Fishery", "Refinery"]);
    expect((await copyOf(p.page, p.playerId))?.pending).toHaveLength(2);
    await p.page.screenshot({ path: "e2e/.shots/shot-offline.png" });
    expect(queued((await serverCity(p.token))?.state ?? null)).toEqual([]);
    await p.context.setOffline(false);
    await show(p.page);
    const city = await serverHas(p.token, ["fishery", "refinery"]);
    expect(city.state.queue.map((j) => j.id)).toEqual(["refinery", "fishery"]);
    await expect.poll(async () => (await copyOf(p.page, p.playerId))?.pending.length, NET).toBe(0);
    await expect.poll(() => shownJobs(p.page), NET).toEqual(["Fishery", "Refinery"]);
    await p.context.close();
  });

  it("a city edited in localStorage: the server refuses the action, the city goes back to the server's, with the reason", async () => {
    const p = await signedInPlayer();
    await upgradeBuilding(p.page, "Refinery");
    await upgradeBuilding(p.page, "Fishery");
    await serverHas(p.token, ["fishery", "refinery"]);
    await expect.poll(async () => (await copyOf(p.page, p.playerId))?.pending.length, NET).toBe(0);
    // The server cannot be reached while the copy is edited (builders free, stock × 100) and the page reloaded.
    await p.page.route(`${API}/**`, (r) => r.abort("internetdisconnected"));
    await p.page.evaluate((k) => {
      const copy = JSON.parse(localStorage.getItem(k)!);
      const state = copy.server.state;
      state.queue = [];
      for (const r of Object.keys(state.stock)) state.stock[r] *= 100;
      localStorage.setItem(k, JSON.stringify(copy));
    }, `${CITY_KEY_PREFIX}${p.playerId}`);
    await p.page.reload();
    await p.page.waitForSelector(".labels.city .bl b");
    await expect.poll(() => shownJobs(p.page), NET).toEqual([]);
    await upgradeBuilding(p.page, "Lumberyard");
    await expect.poll(() => shownJobs(p.page), NET).toEqual(["Lumberyard"]);
    await p.page.unroute(`${API}/**`);
    await show(p.page);
    await p.page.locator(".toast", { hasText: "Your 2 builders are busy" }).waitFor({ timeout: 15_000 });
    await expect.poll(() => shownJobs(p.page), NET).toEqual(["Fishery", "Refinery"]);
    await p.page.screenshot({ path: "e2e/.shots/shot-refused.png" });
    const server = await serverHas(p.token, ["fishery", "refinery"]);
    const copy = (await copyOf(p.page, p.playerId))!;
    expect(copy.pending).toEqual([]);
    // The server's stock, not the edited one (× 100): equal, give or take what was produced since its answer.
    for (const [r, v] of Object.entries(server.state.stock)) expect(copy.server!.state.stock[r], r).toBeCloseTo(v, 0);
    await p.context.close();
  });

  it("a session that ended with actions waiting: they are kept, and leave with their ids once you sign in again", async () => {
    const p = await signedInPlayer();
    await p.context.setOffline(true);
    await upgradeBuilding(p.page, "Refinery");
    await expect.poll(() => shownJobs(p.page), NET).toEqual(["Refinery"]);
    // The session ends on the server meanwhile (as when it expires).
    expect((await fetch(`${API}/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${p.token}` } })).status).toBe(200);
    await p.context.setOffline(false);
    await show(p.page);
    await p.page.locator(".toast", { hasText: TEXT.signInAgain }).waitFor({ timeout: 15_000 });
    await p.page.screenshot({ path: "e2e/.shots/shot-session-ended.png" });
    expect(await session(p.page)).toBeNull();
    expect((await copyOf(p.page, p.playerId))?.pending).toHaveLength(1);
    await expect.poll(() => shownJobs(p.page), NET).toEqual([]);

    await signIn(p.page);
    await p.page.locator(".toast", { hasText: TEXT.signedIn }).waitFor();
    const again = (await session(p.page))!;
    expect(again.playerId).toBe(p.playerId);
    await serverHas(again.token, ["refinery"]);
    await expect.poll(() => shownJobs(p.page), NET).toEqual(["Refinery"]);
    expect(new Set(p.actionIds).size).toBe(1);
    expect((await copyOf(p.page, p.playerId))?.pending).toEqual([]);
    await p.context.close();
  });

  it("a modified client (city edited, clock 1000 times faster, actions sent by hand) gets the server's city, as the rules make it", async () => {
    const p = await newPlayer(true);
    // The cheat: from the next load, this page's clocks run 1000 times faster.
    await p.context.addInitScript(() => {
      if (!localStorage.getItem("e2e-fast-clock")) return;
      const perf = performance.now.bind(performance);
      const start = perf();
      const wall = Date.now();
      performance.now = () => start + (perf() - start) * 1000;
      Date.now = () => wall + (perf() - start) * 1000;
    });
    const page = await openGame(p.context);
    await signIn(page);
    await page.locator(".toast", { hasText: TEXT.signedIn }).waitFor();
    const { token, playerId } = (await session(page))!;
    await serverHas(token, []);
    await expect.poll(async () => (await copyOf(page, playerId))?.server !== null, NET).toBe(true);

    // The saved city edited: stock × 100, every level at 30; and the clock sped up.
    await page.evaluate(
      ({ key }) => {
        const copy = JSON.parse(localStorage.getItem(key)!);
        const state = copy.server.state;
        for (const r of Object.keys(state.stock)) state.stock[r] *= 100;
        for (const b of Object.keys(state.buildings)) state.buildings[b] = 30;
        localStorage.setItem(key, JSON.stringify(copy));
        localStorage.setItem("e2e-fast-clock", "1");
      },
      { key: `${CITY_KEY_PREFIX}${playerId}` },
    );
    await page.reload();
    await page.waitForSelector(".labels.city .bl b");

    // Actions sent by hand, past the game's own rules: one carrying the edited city, one plain.
    const sent = await page.evaluate(
      async ({ api, token, key }) => {
        const post = async (body: unknown) => {
          const res = await fetch(`${api}/city/actions`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
          return { status: res.status, body: await res.json() };
        };
        const edited = JSON.parse(localStorage.getItem(key)!).server.state;
        const withCity = await post({ action: { id: crypto.randomUUID(), type: "upgrade", building: "harbor" }, state: edited });
        const plain = await post({ action: { id: crypto.randomUUID(), type: "upgrade", building: "refinery" } });
        return [withCity, plain];
      },
      { api: API, token, key: `${CITY_KEY_PREFIX}${playerId}` },
    );
    expect(sent.map((r) => r.status)).toEqual([400, 200]);
    for (const r of sent) {
      expect(r.body.state.buildings.refinery).toBeLessThan(30);
      expect(r.body.state.stock.oil).toBeLessThan(1000);
    }

    // A few real seconds later, by a clock 1000 times faster: the server's upgrade has moved by those seconds only.
    await page.waitForTimeout(3000);
    const server = await serverHas(token, ["refinery"]);
    const job = server.state.queue[0] as Job & { left: number; duration: number };
    expect(job.duration - job.left).toBeLessThan(60);
    expect(server.state.buildings.refinery).toBe(1);
    expect(Math.max(...Object.values(server.state.stock))).toBeLessThan(1000);
    // Shown again, the page takes the server's city: the edit is gone.
    await show(page);
    await expect.poll(async () => (await copyOf(page, playerId))?.server?.state.buildings.refinery, NET).toBe(1);
    await expect.poll(() => shownJobs(page), NET).toEqual(["Refinery"]);
    await page.screenshot({ path: "e2e/.shots/shot-cheat.png" });
    await p.context.close();
  });

  it("research at the Observatory: started from its sheet, applied by the server, and done when its time is up", async () => {
    const p = await signedInPlayer();
    // The account's city gets an Observatory (straight in the test database: the e2e harness only).
    const base = newPlayerState();
    await h.putCity(p.playerId, { ...base, buildings: { ...base.buildings, observatory: 1 }, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 } });
    await show(p.page);
    await p.page.locator(".labels.city .bl", { hasText: "Observatory" }).first().waitFor();
    await openSheet(p.page, "Observatory");
    await p.page.locator('[data-act="research"][data-tech="refining"]').click();
    await expect.poll(async () => (await serverCity(p.token) as { state: { research: { id: string } | null } } | null)?.state.research?.id, NET).toBe("refining");
    await expect.poll(() => p.page.locator(".sheet", { hasText: "In progress: Refining" }).count(), NET).toBe(1);
    await p.page.screenshot({ path: "e2e/.shots/shot-research.png" });

    // The same research, 3 seconds from its end: the server finishes it on its own clock, the screen follows.
    const now = (await serverCity(p.token))!.state as unknown as PlayerState;
    await h.putCity(p.playerId, { ...now, research: { ...now.research!, left: 3 } });
    await show(p.page);
    await p.page.waitForTimeout(4000);
    const done = (await serverCity(p.token))!.state as unknown as PlayerState;
    expect(done.techs).toEqual({ refining: 1 });
    expect(done.research).toBeNull();
    await show(p.page);
    await expect.poll(() => p.page.locator('[data-tech-row="refining"] .dots').textContent(), NET).toBe("●○○");
    await p.context.close();
  });

  it("the Mist: the banner counts down, the order to stoke goes from the Lighthouse's sheet to the server, and the Mist lifts by the server's clock", async () => {
    const p = await signedInPlayer();
    // A city 10 seconds before the Mist of 04:00 UTC, on its own clock, with one raft (the e2e harness only).
    const before = 1_792_281_600 + 4 * HOUR - 10;
    const base = newPlayerState(before);
    const slot = RAFT_SLOTS[0]!.key;
    await h.putCity(p.playerId, { ...base, buildings: { ...base.buildings, lighthouse: 4 }, rafts: { [slot]: { hp: 100, building: null, level: 0 } } });
    await show(p.page);
    const banner = p.page.locator('.sub [data-k="mist"]');
    await expect.poll(() => banner.innerText(), NET).toBe("Mist in 1 min · enough oil");
    await expect.poll(() => banner.innerText(), { timeout: 20_000, interval: 250 }).toBe("Mist · 2 h 00 left · Lighthouse stoked");
    await calm(p.page);
    await openSheet(p.page, "Lighthouse");
    const order = p.page.locator('[data-act="stoke"]');
    await expect.poll(() => order.innerText(), NET).toBe("On");
    await order.click();
    await expect.poll(async () => ((await serverCity(p.token)) as { state: PlayerState } | null)?.state.mist, NET).toMatchObject({ stoke: false, dark: true });
    await expect.poll(() => banner.innerText(), NET).toMatch(/^Mist · 2 h 00 left · Lighthouse dark$|^Mist · 1 h 59 left · Lighthouse dark$/);
    await p.page.screenshot({ path: "e2e/.shots/shot-mist-dark.png" });
    // Found again after a reload.
    await p.page.reload();
    await p.page.waitForSelector(".loading", { state: "detached", timeout: 60_000 });
    await openSheet(p.page, "Lighthouse");
    await expect.poll(() => p.page.locator('[data-act="stoke"]').innerText(), NET).toBe("Off");

    // The same city 3 seconds before the Mist lifts: the server ends it on its own clock, not held, and the raft is damaged.
    const now = (await serverCity(p.token))!.state as unknown as PlayerState;
    await h.putCity(p.playerId, { ...now, clock: 1_792_281_600 + 6 * HOUR - 3 });
    await show(p.page);
    await p.page.waitForTimeout(4000);
    await show(p.page);
    const after = (await serverCity(p.token))!.state as unknown as PlayerState;
    expect(after.mist).toMatchObject({ held: 0, missed: 1, dark: false, damaged: 1 });
    expect(after.rafts[slot]!.hp).toBe(65);
    await expect.poll(() => p.page.locator(".celebration", { hasText: "Your Lighthouse went dark in the Mist · 1 raft damaged" }).count(), NET).toBe(1);
    await p.context.close();
  });

  it("training at the Barracks: started from its sheet, found again after a reload, and the soldiers join the city by the server's clock", async () => {
    const p = await signedInPlayer();
    const base = newPlayerState();
    await h.putCity(p.playerId, { ...base, buildings: { ...base.buildings, barracks: 1 }, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 } });
    await show(p.page);
    await p.page.locator(".labels.city .bl", { hasText: "Barracks" }).first().waitFor();
    await openSheet(p.page, "Barracks");
    await expect.poll(() => p.page.locator('[data-troop-row="harpooners"] .ph').textContent(), NET).toBe("25");
    await p.page.screenshot({ path: "e2e/.shots/shot-barracks.png" });
    await p.page.locator('[data-act="train"][data-troop="harpooners"]').click();
    await expect.poll(async () => ((await serverCity(p.token))?.state as unknown as PlayerState).training?.troop, NET).toBe("harpooners");
    await expect.poll(() => p.page.locator(".queue .n", { hasText: "20 harpooners" }).count(), NET).toBe(1);

    // Reloaded: the training is the server's, and still there.
    await p.page.reload();
    await p.page.waitForSelector(".labels.city .bl b");
    await expect.poll(() => p.page.locator(".queue .n", { hasText: "20 harpooners" }).count(), NET).toBe(1);
    expect(((await copyOf(p.page, p.playerId))?.server?.state as unknown as PlayerState).training).toMatchObject({ kind: "train", troop: "harpooners", count: 20 });
    await openSheet(p.page, "Barracks");
    await expect.poll(() => p.page.locator(".sheet", { hasText: "In progress: 20 harpooners" }).count(), NET).toBe(1);
    await p.page.screenshot({ path: "e2e/.shots/shot-training.png" });

    // 3 seconds from its end: the server adds the soldiers to the city on its own clock, the sheet follows.
    const now = (await serverCity(p.token))!.state as unknown as PlayerState;
    await h.putCity(p.playerId, { ...now, training: { ...now.training!, left: 3 } });
    await show(p.page);
    await p.page.waitForTimeout(4000);
    const done = (await serverCity(p.token))!.state as unknown as PlayerState;
    expect(done.troops).toEqual({ ...now.troops, harpooners: now.troops.harpooners + 20 });
    expect(done.training).toBeNull();
    await show(p.page);
    await expect.poll(() => p.page.locator('[data-troop-row="harpooners"] .ph').textContent(), NET).toBe(String(now.troops.harpooners + 20));
    await expect.poll(() => p.page.locator(".queue .n", { hasText: "harpooners" }).count(), NET).toBe(0);
    await p.page.screenshot({ path: "e2e/.shots/shot-trained.png" });
    expect(p.problems).toEqual([]);
    await p.context.close();
  });

  it("veterans at the Barracks: promoted from its sheet, found again after a reload, and in the city by the server's clock", async () => {
    const p = await signedInPlayer();
    const base = newPlayerState();
    await h.putCity(p.playerId, {
      ...base,
      buildings: { ...base.buildings, barracks: 3 },
      techs: { veterans: 1 },
      stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 },
    });
    await show(p.page);
    await expect.poll(async () => ((await copyOf(p.page, p.playerId))?.server?.state as unknown as PlayerState | undefined)?.buildings.barracks, NET).toBe(3);
    await p.page.locator(".labels.city .bl", { hasText: "Barracks" }).first().waitFor();
    await openSheet(p.page, "Barracks");
    const row = p.page.locator('[data-vet-row="boarders"]');
    await expect.poll(() => row.locator("small").textContent(), NET).toBe("25 soldiers · 0 veterans");
    await p.page.locator(".sheet .vets").scrollIntoViewIfNeeded();
    await p.page.screenshot({ path: "e2e/.shots/shot-veterans.png" });
    await row.locator('[data-act="promote"]').click();
    await expect.poll(async () => ((await serverCity(p.token))?.state as unknown as PlayerState).training, NET).toMatchObject({ kind: "promote", troop: "boarders", count: 10 });
    await expect.poll(() => p.page.locator(".queue .n", { hasText: "10 veteran boarders" }).count(), NET).toBe(1);
    expect(((await serverCity(p.token))!.state as unknown as PlayerState).troops.boarders).toBe(15);

    // Reloaded: the promotion is the server's, and still there.
    await p.page.reload();
    await p.page.waitForSelector(".labels.city .bl b");
    await expect.poll(() => p.page.locator(".queue .n", { hasText: "10 veteran boarders" }).count(), NET).toBe(1);
    await openSheet(p.page, "Barracks");
    await expect.poll(() => p.page.locator(".sheet", { hasText: "In progress: 10 veteran boarders" }).count(), NET).toBe(1);
    await p.page.screenshot({ path: "e2e/.shots/shot-promoting.png" });

    // 3 seconds from its end: the server adds the veterans to the city on its own clock, the sheet follows.
    const now = (await serverCity(p.token))!.state as unknown as PlayerState;
    expect(now.training!.duration).toBe(PROMOTE_TIME);
    await h.putCity(p.playerId, { ...now, training: { ...now.training!, left: 3 } });
    await show(p.page);
    await p.page.waitForTimeout(4000);
    const done = (await serverCity(p.token))!.state as unknown as PlayerState;
    expect(done.veterans).toEqual({ boarders: 10, harpooners: 0, crossbowmen: 0 });
    expect(done.troops).toEqual(now.troops);
    expect(done.training).toBeNull();
    await show(p.page);
    await expect.poll(() => row.locator("small").textContent(), NET).toBe("15 soldiers · 10 veterans");
    await expect.poll(() => p.page.locator(".queue .n", { hasText: "veteran" }).count(), NET).toBe(0);
    await p.page.locator(".sheet .vets").scrollIntoViewIfNeeded();
    await p.page.screenshot({ path: "e2e/.shots/shot-promoted.png" });
    expect(p.problems).toEqual([]);
    await p.context.close();
  });

  it("healing at the Infirmary: started from its sheet, found again after a reload, and the soldiers back in the city by the server's clock", async () => {
    const p = await signedInPlayer();
    const base = newPlayerState();
    const wounded = { boarders: 12, harpooners: 5, crossbowmen: 3 };
    await h.putCity(p.playerId, { ...base, buildings: { ...base.buildings, infirmary: 1 }, wounded, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 } });
    await show(p.page);
    await expect.poll(async () => ((await copyOf(p.page, p.playerId))?.server?.state as unknown as PlayerState | undefined)?.buildings.infirmary, NET).toBe(1);
    await p.page.locator(".labels.city .bl", { hasText: "Infirmary" }).first().waitFor();
    await openSheet(p.page, "Infirmary");
    await expect.poll(() => p.page.locator(".sheet", { hasText: "Beds in use" }).textContent(), NET).toContain("20 / 60");
    await p.page.screenshot({ path: "e2e/.shots/shot-infirmary.png" });
    await p.page.locator('[data-act="heal"]').click();
    await expect.poll(async () => ((await serverCity(p.token))?.state as unknown as PlayerState).healing?.wounded, NET).toEqual(wounded);
    await expect.poll(() => p.page.locator(".queue .n", { hasText: "Healing · 20 wounded" }).count(), NET).toBe(1);

    // Reloaded: the healing is the server's, and still there.
    await p.page.reload();
    await p.page.waitForSelector(".labels.city .bl b");
    await expect.poll(() => p.page.locator(".queue .n", { hasText: "Healing · 20 wounded" }).count(), NET).toBe(1);
    await openSheet(p.page, "Infirmary");
    await expect.poll(() => p.page.locator(".sheet", { hasText: "Healing: 20 soldiers" }).count(), NET).toBe(1);
    await p.page.screenshot({ path: "e2e/.shots/shot-healing.png" });

    // 3 seconds from its end: the server brings the soldiers back on its own clock, the sheet follows.
    const now = (await serverCity(p.token))!.state as unknown as PlayerState;
    await h.putCity(p.playerId, { ...now, healing: { ...now.healing!, left: 3 } });
    await show(p.page);
    await p.page.waitForTimeout(4000);
    const done = (await serverCity(p.token))!.state as unknown as PlayerState;
    expect(done.troops).toEqual({ boarders: now.troops.boarders + 12, harpooners: now.troops.harpooners + 5, crossbowmen: now.troops.crossbowmen + 3 });
    expect(done.healing).toBeNull();
    await show(p.page);
    await expect.poll(() => p.page.locator(".sheet", { hasText: "No wounded." }).count(), NET).toBe(1);
    await expect.poll(() => p.page.locator(".queue .n", { hasText: "Healing" }).count(), NET).toBe(0);
    await p.page.screenshot({ path: "e2e/.shots/shot-healed.png" });
    expect(p.problems).toEqual([]);
    await p.context.close();
  });

  it("a raft: a lit slot tapped around the island, the raft started from its sheet, then moored by the server's clock", async () => {
    const p = await signedInPlayer();
    const base = newPlayerState();
    await h.putCity(p.playerId, { ...base, buildings: { ...base.buildings, lighthouse: 4 }, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 20 } });
    await show(p.page);
    await expect.poll(async () => (await copyOf(p.page, p.playerId))?.server?.state.buildings.lighthouse, NET).toBe(4);
    await p.page.waitForTimeout(500);
    await calm(p.page);

    // Where a slot of the first ring is on screen, from the game's own starting camera for this Lighthouse level.
    const { slot, x, y } = slotOnScreen(4);
    await p.page.mouse.click(x, y);
    const sheet = p.page.locator(".raft-sheet:not([hidden])");
    await sheet.waitFor();
    await expect(sheet.textContent()).resolves.toContain("You can moor a raft here");
    await p.page.screenshot({ path: "e2e/.shots/shot-raft-slot.png" });
    await sheet.locator('[data-act="dock"]').click();
    await expect.poll(async () => ((await serverCity(p.token))?.state as unknown as PlayerState).yard, NET).toMatchObject({ kind: "raft", slot });
    await expect.poll(() => p.page.locator(".queue .n", { hasText: "Shipyard · raft" }).count(), NET).toBe(1);

    // 3 seconds from the end of the work: the server moors the raft on its own clock.
    const now = (await serverCity(p.token))!.state as unknown as PlayerState;
    await h.putCity(p.playerId, { ...now, yard: { ...now.yard!, left: 3 } });
    await show(p.page);
    await p.page.waitForTimeout(4000);
    const done = (await serverCity(p.token))!.state as unknown as PlayerState;
    expect(done.rafts).toEqual({ [slot]: { hp: 100, building: null, level: 0 } });
    await show(p.page);
    await expect.poll(async () => ((await copyOf(p.page, p.playerId))?.server?.state as unknown as PlayerState | undefined)?.rafts[slot], NET).toEqual(done.rafts[slot]);
    await p.page.waitForTimeout(500);
    await p.page.mouse.click(x, y);
    await expect.poll(() => p.page.locator(".raft-sheet:not([hidden])").textContent(), NET).toContain("Sturdiness");
    await p.page.screenshot({ path: "e2e/.shots/shot-raft.png" });
    await p.context.close();
  });

  it("captains: Sel unlocked with 10 shards, found again after a reload, then leading; a Logbook for Sel", async () => {
    const p = await signedInPlayer();
    const base = newPlayerState();
    await h.putCity(p.playerId, { ...base, shards: { sel: 10 } });
    await show(p.page);
    await expect.poll(async () => ((await copyOf(p.page, p.playerId))?.server?.state as unknown as PlayerState | undefined)?.shards, NET).toEqual({ sel: 10 });
    await p.page.locator('.nav button[data-v="captains"]').click();
    const sheet = p.page.locator(".sheet.captains:not([hidden])");
    await sheet.waitFor();
    await sheet.locator('[data-act="unlock"][data-captain="sel"]').click();
    await expect.poll(async () => ((await serverCity(p.token))?.state as unknown as PlayerState).captains.sel, NET).toEqual({ level: 1, xp: 0, stars: 1 });

    await p.page.reload();
    await p.page.waitForSelector(".labels.city .bl b");
    await p.page.locator('.nav button[data-v="captains"]').click();
    await sheet.waitFor();
    await expect.poll(() => sheet.locator('[data-captain-row="sel"] small').last().textContent(), NET).toBe("Lv 1 · 0/80 XP · shards 0/10");
    await sheet.locator('[data-act="lead"][data-captain="sel"]').click();
    await expect.poll(async () => ((await serverCity(p.token))?.state as unknown as PlayerState).lead, NET).toBe("sel");
    await expect.poll(() => sheet.locator('[data-captain-row="sel"] .chip').textContent(), NET).toBe("Leading");
    await sheet.locator('[data-act="logbook"]').click();
    await expect.poll(async () => ((await serverCity(p.token))?.state as unknown as PlayerState).captains.sel, NET).toEqual({ level: 1, xp: 40, stars: 1 });
    expect(((await serverCity(p.token))!.state as unknown as PlayerState).pearls).toBe(base.pearls - 50);
    expect(p.problems).toEqual([]);
    await p.context.close();
  });

  it("repairing the rafts: from a raft's sheet, all damaged rafts at once, paid in oil, sound again by the server's clock", async () => {
    const p = await signedInPlayer();
    const base = newPlayerState();
    const { slot, x, y } = slotOnScreen(4);
    const other = RAFT_SLOTS.find((s) => s.ring === 3 && s.key !== slot)!.key;
    // Two rafts after Mists not held (the e2e harness only).
    await h.putCity(p.playerId, { ...base, buildings: { ...base.buildings, lighthouse: 4 }, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 20 }, rafts: { [slot]: { hp: 65, building: null, level: 0 }, [other]: { hp: 25, building: null, level: 0 } } });
    await show(p.page);
    await expect.poll(async () => Object.keys(((await copyOf(p.page, p.playerId))?.server?.state as unknown as PlayerState | undefined)?.rafts ?? {}).length, NET).toBe(2);
    await p.page.waitForTimeout(500);
    await calm(p.page);
    await p.page.mouse.click(x, y);
    const sheet = p.page.locator(".raft-sheet:not([hidden])");
    await sheet.waitFor();
    await expect.poll(() => sheet.locator(".box", { hasText: "Repair the 2 damaged rafts" }).count(), NET).toBe(1);
    await p.page.screenshot({ path: "e2e/.shots/shot-repair.png" });
    await sheet.locator('[data-act="repair"]').click();
    // 110 points at Lighthouse 4: 880 oil and 110 wood, paid at once.
    await expect.poll(async () => ((await serverCity(p.token))?.state as unknown as PlayerState).yard, NET).toMatchObject({ kind: "repair" });
    const started = (await serverCity(p.token))!.state as unknown as PlayerState;
    expect(started.stock.oil).toBeLessThan(5000 - 880 + 50);
    await expect.poll(() => p.page.locator(".queue .n", { hasText: "Shipyard · repairing 2 rafts" }).count(), NET).toBe(1);
    // 3 seconds from its end: the server makes them sound on its own clock.
    await h.putCity(p.playerId, { ...started, yard: { ...started.yard!, left: 3 } });
    await show(p.page);
    await p.page.waitForTimeout(4000);
    const done = (await serverCity(p.token))!.state as unknown as PlayerState;
    expect([done.rafts[slot]!.hp, done.rafts[other]!.hp]).toEqual([100, 100]);
    expect(done.yard).toBeNull();
    expect(p.problems).toEqual([]);
    await p.context.close();
  });

  it("the Leviathan: its sheet at sea, the fleet sent to the server, and the hunt's report when it dives by the server's clock", async () => {
    const p = await signedInPlayer();
    // A city at 13:01 UTC, a hunt on, with 100 boarders (the e2e harness only).
    const rise = 1_792_281_600 + 13 * HOUR;
    const base = newPlayerState(rise + 60);
    await h.putCity(p.playerId, { ...base, troops: { boarders: 100, harpooners: 0, crossbowmen: 0 } });
    await show(p.page);
    await expect.poll(async () => ((await copyOf(p.page, p.playerId))?.server?.state as unknown as PlayerState | undefined)?.troops.boarders, NET).toBe(100);
    await calm(p.page);
    await p.page.locator('.nav button[data-v="sea"]').click();
    await p.page.waitForTimeout(1500);
    const label = p.page.locator(".labels.sea .sl.leviathan.up");
    await expect.poll(() => label.innerText(), NET).toMatch(/^Leviathan · 1 h 5\d left$/);
    const sheet = p.page.locator(".sheet:not([hidden])", { hasText: "Send my fleet" });
    const box = (await label.boundingBox())!;
    for (const dy of [30, 45, 60, 15, 8]) {
      await p.page.mouse.click(box.x + box.width / 2, box.y + box.height + dy);
      if (await sheet.isVisible()) break;
    }
    await expect.poll(() => sheet.locator(".kv span", { hasText: "Health" }).count(), NET).toBe(1);
    expect(await sheet.innerText()).toContain("20 + 180 × your share of its health");
    await p.page.screenshot({ path: "e2e/.shots/shot-leviathan.png" });
    await sheet.locator('[data-act="sail"]').click();
    await expect.poll(async () => ((await serverCity(p.token))?.state as unknown as PlayerState).fleets, NET).toMatchObject([{ site: "leviathan", kind: "hunt" }]);
    const sent = (await serverCity(p.token))!.state as unknown as PlayerState;
    expect(sent.troops.boarders).toBe(0);

    // 3 seconds before the hunt ends, the fleet on site: the server ends the hunt on its own clock.
    const end = rise + 2 * HOUR;
    await h.putCity(p.playerId, { ...sent, clock: end - 3, fleets: [{ ...sent.fleets[0]!, phase: "stay", left: 3 }], leviathan: { level: 1, hunt: rise, damage: 150, over: false } });
    await show(p.page);
    await p.page.waitForTimeout(4000);
    await show(p.page);
    const after = (await serverCity(p.token))!.state as unknown as PlayerState;
    expect(after.leviathan).toMatchObject({ level: 1, hunt: rise, over: true });
    expect(after.reports.at(-1)).toMatchObject({ site: "leviathan", win: false, loot: { pearls: 27 } });
    expect(after.fleets).toMatchObject([{ site: "leviathan", phase: "back" }]);
    const report = p.page.locator(".sheet:not([hidden])", { hasText: "It dived · Leviathan level 1" });
    await expect.poll(() => report.count(), NET).toBe(1);
    expect(await report.innerText()).toContain("your fleet brings every troop home");
    await p.page.screenshot({ path: "e2e/.shots/shot-hunt-report.png" });
    expect(p.problems).toEqual([]);
    await p.context.close();
  });

  it("a building on a raft: put from the raft's sheet, found again after a reload, standing by the server's clock, then upgraded", async () => {
    const p = await signedInPlayer();
    const base = newPlayerState();
    const { slot, x, y } = slotOnScreen(4);
    await h.putCity(p.playerId, { ...base, buildings: { ...base.buildings, lighthouse: 4 }, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 20 }, rafts: { [slot]: { hp: 100, building: null, level: 0 } } });
    await show(p.page);
    await expect.poll(async () => Object.keys(((await copyOf(p.page, p.playerId))?.server?.state as unknown as PlayerState | undefined)?.rafts ?? {}), NET).toEqual([slot]);
    await p.page.waitForTimeout(500);
    // The Lighthouse rose to level 4 on the server: its celebration goes first.
    await calm(p.page);
    await p.page.mouse.click(x, y);
    const sheet = p.page.locator(".raft-sheet:not([hidden])");
    await sheet.waitFor();
    await sheet.locator('[data-act="install"][data-building="greenhouse"]').click();
    await expect.poll(async () => ((await serverCity(p.token))?.state as unknown as PlayerState).yard, NET).toMatchObject({ slot, kind: "install", building: "greenhouse" });
    await expect.poll(() => p.page.locator(".queue .n", { hasText: "Shipyard · Kelp Greenhouse" }).count(), NET).toBe(1);

    // Reloaded: the work is the server's, and still there.
    await p.page.reload();
    await p.page.waitForSelector(".labels.city .bl b");
    await expect.poll(() => p.page.locator(".queue .n", { hasText: "Shipyard · Kelp Greenhouse" }).count(), NET).toBe(1);

    // 3 seconds from its end: the server puts the building on the raft on its own clock.
    const now = (await serverCity(p.token))!.state as unknown as PlayerState;
    expect(now.yard!.duration).toBe(RAFT_INSTALL_TIME);
    await h.putCity(p.playerId, { ...now, yard: { ...now.yard!, left: 3 } });
    await show(p.page);
    await p.page.waitForTimeout(4000);
    const done = (await serverCity(p.token))!.state as unknown as PlayerState;
    expect(done.rafts[slot]).toEqual({ hp: 100, building: "greenhouse", level: 1 });
    expect(done.yard).toBeNull();
    await show(p.page);
    await expect.poll(async () => ((await copyOf(p.page, p.playerId))?.server?.state as unknown as PlayerState | undefined)?.rafts[slot]?.building, NET).toBe("greenhouse");
    await p.page.waitForTimeout(500);
    await p.page.mouse.click(x, y);
    await expect.poll(() => p.page.locator(".raft-sheet:not([hidden]) h2").textContent(), NET).toBe("Kelp Greenhouse");
    await p.page.locator('.raft-sheet:not([hidden]) [data-act="upgrade-raft"]').click();
    await expect.poll(async () => ((await serverCity(p.token))?.state as unknown as PlayerState).yard, NET).toMatchObject({ slot, kind: "upgrade", duration: raftUpgradeTime(1) });
    await expect.poll(() => p.page.locator(".queue .n", { hasText: "Shipyard · Kelp Greenhouse Lv 2" }).count(), NET).toBe(1);
    expect(p.problems).toEqual([]);
    await p.context.close();
  });
});

/**
 * Where a lit slot of the first ring is on the 412 × 915 screen, with the game's starting camera (frameCity) for this
 * Lighthouse level: the one lowest on screen that stays clear of the top bar and the bottom menu.
 */
function slotOnScreen(lighthouse: number): { slot: string; x: number; y: number } {
  const clear = slotsOnScreen(lighthouse, 412, 915);
  if (!clear[0]) throw new Error("No raft slot clear on screen");
  return clear[0];
}

/** The game's starting camera (frameCity) for this Lighthouse level, on a w × h screen, and a point's place on that screen. */
function cityCamera(lighthouse: number, w: number, hgt: number) {
  const camera = new THREE.PerspectiveCamera(40, w / hgt, 0.1, 200);
  const target = new THREE.Vector3();
  frameCity(camera, { target, update: () => camera.lookAt(target) } as unknown as Parameters<typeof frameCity>[1], w / hgt, lighthouse);
  camera.updateMatrixWorld();
  return (x: number, y: number, z: number) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * hgt };
  };
}

/** The slots of the first ring clear of the top bar and the bottom menu on a w × h screen, lowest on screen first. */
function slotsOnScreen(lighthouse: number, w: number, hgt: number): { slot: string; x: number; y: number }[] {
  const at = cityCamera(lighthouse, w, hgt);
  return RAFT_SLOTS.filter((s) => s.ring === 3)
    .map((s) => ({ slot: s.key, ...at(2 * (s.q + s.r / 2), 0, 1.732 * s.r) }))
    .filter((p) => p.x > 40 && p.x < w - 40 && p.y > 200 && p.y < hgt - 140)
    .sort((a, b) => b.y - a.y);
}

/** The island's shore (its meadow's edge, SHORE_RADIUS from the center) on a w × h screen, every 5 degrees. */
function shoreOnScreen(lighthouse: number, w: number, hgt: number): { x: number; y: number }[] {
  const at = cityCamera(lighthouse, w, hgt);
  return Array.from({ length: 72 }, (_, i) => at(SHORE_RADIUS * Math.cos((i * Math.PI) / 36), 0, SHORE_RADIUS * Math.sin((i * Math.PI) / 36)));
}
