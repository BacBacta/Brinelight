/**
 * Sign in from the game, end to end: the real server (PGlite), the built client in Chromium, and a test wallet.
 * Signed in, every action goes to the server, which decides; the city shown is the server's.
 */
import type { BrowserContext, Page } from "playwright-core";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HOUR, advance, newPlayerState, sail, type PlayerState } from "@brinelight/shared";
import { CITY_KEY_PREFIX } from "../client/src/account/actions.js";
import { PROFILE_TEXT } from "../client/src/account/profile.js";
import { TEXT } from "../client/src/account/index.js";
import { installFakeWallet, type TestWallet } from "./fakeWallet.js";
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
async function newPlayer(withWallet: boolean): Promise<{ context: BrowserContext; wallet: TestWallet | null; apiCalls: string[]; actionIds: string[]; problems: string[] }> {
  const context = await h.browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
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
});
