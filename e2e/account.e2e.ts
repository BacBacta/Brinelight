/**
 * Sign in from the game, end to end: the real server (PGlite), the built client in Chromium, and a test wallet.
 */
import type { BrowserContext, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PROFILE_TEXT } from "../client/src/account/profile.js";
import { TEXT } from "../client/src/account/index.js";
import { installFakeWallet, type TestWallet } from "./fakeWallet.js";
import { API, GAME, startHarness, type Harness } from "./harness.js";

const SAVE_KEY = "brinelight-client-v1";
const ACCOUNT_KEY = "brinelight-account-v1";
type Job = { id: string };
type City = { buildings: Record<string, number>; queue: Job[] };

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h?.close();
});

/** A browser profile of its own (its own localStorage); with a test wallet when asked. */
async function newPlayer(withWallet: boolean): Promise<{ context: BrowserContext; wallet: TestWallet | null; apiCalls: string[]; problems: string[] }> {
  const context = await h.browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
  const wallet = withWallet ? await installFakeWallet(context) : null;
  const apiCalls: string[] = [];
  const problems: string[] = [];
  context.on("request", (r) => {
    if (!r.url().startsWith(API)) return;
    apiCalls.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  // A keepalive request still on its way when the page goes is reported "ERR_ABORTED" by the page, though the
  // server gets it (the tests check the server). Anything else, and any CORS refusal, is a problem.
  context.on("requestfailed", (r) => {
    const why = r.failure()?.errorText ?? "";
    if (r.url().startsWith(API) && why !== "net::ERR_ABORTED") problems.push(`failed ${r.method()} ${r.url()} ${why}`);
  });
  context.on("console", (m) => /CORS|blocked|keepalive|preflight/i.test(m.text()) && problems.push(m.text()));
  return { context, wallet, apiCalls, problems };
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
const session = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null") as { token: string; version: number } | null, ACCOUNT_KEY);

async function accountCity(token: string): Promise<{ state: City; version: number } | { city: null }> {
  const res = await fetch(`${API}/city`, { headers: { authorization: `Bearer ${token}` } });
  return res.json();
}
/** Waits until the account city has reached at least this version. */
async function accountAt(token: string, version: number): Promise<{ state: City; version: number }> {
  for (let i = 0; i < 50; i++) {
    const c = await accountCity(token);
    if ("version" in c && c.version >= version) return c;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`The account city never reached version ${version}`);
}
/** As when you switch apps: the page is hidden, and saves. */
const hide = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

async function signIn(page: Page): Promise<void> {
  await page.locator(".hud .lvl").click();
  await page.locator('.profile [data-act="sign-in"]').click();
}

const queued = (c: City | null) => (c?.queue ?? []).map((j) => j.id).sort();

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

/** A new player with a test wallet, signed in: the account starts with the (untouched) city of this device. */
async function signedInPlayer() {
  const p = await newPlayer(true);
  const page = await openGame(p.context);
  await signIn(page);
  await page.locator(".toast", { hasText: TEXT.signedIn }).waitFor();
  const token = (await session(page))!.token;
  await accountAt(token, 1);
  return { ...p, page, token };
}

describe("signed in", () => {
  it("signing in sends the city of this device; an upgrade is saved when the page is hidden; reloading finds the city", async () => {
    const p = await newPlayer(true);
    const page = await openGame(p.context);
    await page.locator(".hud .lvl").click();
    await page.screenshot({ path: "e2e/.shots/shot-profile-sign-in.png" });
    await page.locator('.profile [data-act="close"]').click();
    await upgradeBuilding(page, "Refinery");
    await signIn(page);
    await page.locator(".toast", { hasText: TEXT.signedIn }).waitFor();
    const token = (await session(page))!.token;
    expect(queued((await accountAt(token, 1)).state)).toEqual(["refinery"]);

    await upgradeBuilding(page, "Fishery");
    await hide(page);
    const saved = await accountAt(token, 2);
    expect(queued(saved.state)).toEqual(["fishery", "refinery"]);

    // The city on this device is removed: after a reload, it can only come from the account.
    await page.evaluate((k) => localStorage.removeItem(k), SAVE_KEY);
    await page.reload();
    await page.waitForSelector(".labels.city .bl b");
    await expect.poll(async () => queued(await localCity(page))).toEqual(["fishery", "refinery"]);
    // Only one device here: no conflict message.
    await page.waitForTimeout(500);
    const why = `${await page.evaluate((k) => localStorage.getItem(k), ACCOUNT_KEY)} ${p.apiCalls.join(", ")}`;
    expect(await page.locator(".toast", { hasText: TEXT.conflict }).count(), why).toBe(0);
    await page.screenshot({ path: "e2e/.shots/shot-signed-in.png" });
    expect(p.problems).toEqual([]);
    await p.context.close();
  });

  it("the save made as the page goes away (fetch keepalive, with Authorization) passes CORS and reaches the server", async () => {
    const p = await signedInPlayer();
    // Chromium keeps a CORS check 5 s (no Access-Control-Max-Age): past that, the save needs a new, slow preflight.
    await p.page.waitForTimeout(6000);
    await upgradeBuilding(p.page, "Refinery");
    // A real navigation away, no help from the test: the page is hidden and unloaded, so only a keepalive request can finish.
    await p.page.goto("about:blank");
    expect(queued((await accountAt(p.token, 2)).state)).toEqual(["refinery"]);
    // The page never got the answer; coming back, it recognizes its own save: no conflict message.
    const back = await openGame(p.context);
    await expect.poll(async () => (await session(back))?.version).toBe(2);
    expect(await back.locator(".toast", { hasText: TEXT.conflict }).count(), p.apiCalls.join(", ")).toBe(0);
    expect(p.problems).toEqual([]);
    await p.context.close();
  });

  it("two tabs: the one that saves on an old version loads the latest city, with a message", async () => {
    const p = await signedInPlayer();
    const a = p.page;
    const b = await openGame(p.context);
    await upgradeBuilding(a, "Refinery");
    await hide(a);
    await accountAt(p.token, 2);

    await upgradeBuilding(b, "Fishery");
    await hide(b);
    await b.locator(".toast", { hasText: TEXT.conflict }).waitFor();
    await b.screenshot({ path: "e2e/.shots/shot-conflict.png" });
    const latest = await accountAt(p.token, 2);
    expect(latest.version).toBe(2);
    expect(queued(latest.state)).toEqual(["refinery"]);
    await expect.poll(async () => queued(await localCity(b))).toEqual(["refinery"]);
    expect(p.problems).toEqual([]);
    await p.context.close();
  });

  it("signing out forgets the session, never the city", async () => {
    const p = await signedInPlayer();
    await upgradeBuilding(p.page, "Refinery");
    await p.page.locator(".hud .lvl").click();
    await p.page.locator('.profile [data-act="sign-out"]').click();
    await p.page.locator(".toast", { hasText: TEXT.signedOut }).waitFor();
    expect(await session(p.page)).toBeNull();
    await hide(p.page);
    expect(queued(await localCity(p.page))).toEqual(["refinery"]);
    await p.context.close();
  });
});

describe("an account city and a city on this device", () => {
  it("you choose; replacing asks for a confirmation, then sends this city", async () => {
    const p = await newPlayer(true);
    const page = await openGame(p.context);
    await signIn(page);
    await page.locator(".toast", { hasText: TEXT.signedIn }).waitFor();
    const token = (await session(page))!.token;
    await accountAt(token, 1);
    // Signed out, the city is played on this device; then the same wallet signs in again.
    await page.locator(".hud .lvl").click();
    await page.locator('.profile [data-act="sign-out"]').click();
    await page.locator('.profile [data-act="close"]').click();
    await upgradeBuilding(page, "Harbor");
    await signIn(page);
    const dialog = page.locator(".modal");
    await dialog.waitFor();
    await expect(dialog.textContent()).resolves.toContain(PROFILE_TEXT.ask);
    await page.screenshot({ path: "e2e/.shots/shot-choice.png" });
    await dialog.locator('[data-act="replace"]').click();
    await expect(dialog.textContent()).resolves.toContain(PROFILE_TEXT.lost);
    await page.screenshot({ path: "e2e/.shots/shot-confirm.png" });
    await dialog.locator('[data-act="confirm"]').click();
    const newToken = (await session(page))!.token;
    const replaced = await accountAt(newToken, 2);
    expect(queued(replaced.state)).toEqual(["harbor"]);
    await p.context.close();
  });
});
