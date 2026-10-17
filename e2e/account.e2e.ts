/**
 * Sign in from the game, end to end: the real server (PGlite), the built client in Chromium, and a test wallet.
 * Signed in, every action goes to the server, which decides; the city shown is the server's.
 */
import type { BrowserContext, Page } from "playwright-core";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { HOUR, PROMOTE_TIME, RAFT_INSTALL_TIME, RAFT_SLOTS, advance, heal, newPlayerState, promote, raftUpgradeTime, research, sail, upgrade, type ActionResult, type PlayerState, type RaftBuildingId } from "@brinelight/shared";
import { frameCity } from "../client/src/scene/camera.js";
import { SHORE_RADIUS } from "../client/src/scene/models.js";
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

    // Where a slot of the first ring is on screen, from the game's own starting camera for this Lighthouse level.
    const { slot, x, y } = slotOnScreen(4);
    await p.page.mouse.click(x, y);
    const sheet = p.page.locator(".raft-sheet:not([hidden])");
    await sheet.waitFor();
    await expect(sheet.textContent()).resolves.toContain("You can moor a raft here");
    await p.page.screenshot({ path: "e2e/.shots/shot-raft-slot.png" });
    await sheet.locator('[data-act="dock"]').click();
    await expect.poll(async () => ((await serverCity(p.token))?.state as unknown as PlayerState).yard?.slot, NET).toBe(slot);
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

  it("a building on a raft: put from the raft's sheet, found again after a reload, standing by the server's clock, then upgraded", async () => {
    const p = await signedInPlayer();
    const base = newPlayerState();
    const { slot, x, y } = slotOnScreen(4);
    await h.putCity(p.playerId, { ...base, buildings: { ...base.buildings, lighthouse: 4 }, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 20 }, rafts: { [slot]: { hp: 100, building: null, level: 0 } } });
    await show(p.page);
    await expect.poll(async () => Object.keys(((await copyOf(p.page, p.playerId))?.server?.state as unknown as PlayerState | undefined)?.rafts ?? {}), NET).toEqual([slot]);
    await p.page.waitForTimeout(500);
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
