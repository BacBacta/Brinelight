/**
 * Week 2: the city scene from the prototype (island, sea, sky, Lighthouse),
 * driven by the player's state, which produces with the shared rules and is saved locally,
 * with the 9 buildings, their sheets, the builders' queue, the top bar and the bottom menu,
 * and the sea view with its pirate camps, wrecks, fleets and combat reports.
 * The week 1 rules table stays available with ?rules.
 * Week 3: sign in with your wallet (Profile, on the Power card) to keep your city on your account.
 * Week 4: signed in, every action is sent to the server, which decides; the city shown is the server's.
 * Week 5: troops are trained at the Barracks, and the wounded healed at the Infirmary.
 * The reference prototype stays playable at /prototype/.
 */
import { HOME, applyAction, type GameAction } from "@brinelight/shared";
import type { Wallet } from "@wallet-standard/base";
import type { ActionInput } from "./account/actions.js";
import { createAccount, isUntouched } from "./account/index.js";
import { apiUrl, createApi } from "./account/api.js";
import { createProfile } from "./account/profile.js";
import { watchWallets } from "./account/wallets.js";
import { createCity, type City } from "./city/index.js";
import { showRules } from "./rules.js";
import { forcedQuality, startScene, type View } from "./scene/index.js";
import { createSea, type Sea } from "./sea/index.js";
import { createFpsCounter } from "./ui/fps.js";
import { fpsWanted } from "./ui/fpsMeter.js";
import { createUi } from "./ui/index.js";
import { DEV_SPEED, SAVE_EVERY_MS, browserStore, elapse, openSave, saveGame, type PlayerState } from "./state/index.js";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

/** What the screen shows: changes here open a report, refresh a sheet, and save the city of this device. */
const signature = (s: PlayerState): string =>
  `${s.queue.map((j) => j.id).join()}|${s.research?.id ?? ""}|${JSON.stringify(s.techs)}|${s.yard ? `${s.yard.kind}${s.yard.slot}` : ""}|${JSON.stringify(s.rafts)}|${s.training ? `${s.training.kind}${s.training.troop}` : ""}|${s.healing ? "h" : ""}|${JSON.stringify(s.troops)}|${JSON.stringify(s.veterans)}|${s.reports.map((r) => `${r.id}${r.read ? "+" : "-"}`).join()}|${s.fleets.map((f) => f.phase).join()}`;

if (new URLSearchParams(location.search).has("rules")) {
  showRules(app);
} else {
  document.body.classList.add("scene");
  app.innerHTML = `<canvas id="cv" aria-label="3D view of your city"></canvas><p class="loading" role="status">Loading your city…</p>`;
  const status = app.querySelector<HTMLParagraphElement>(".loading")!;
  const canvas = app.querySelector<HTMLCanvasElement>("#cv")!;

  const store = browserStore();

  // The account: only with a server address. Without one, or without signing in, nothing goes on the network.
  const server = apiUrl();
  const accountStore = (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();
  const account = server
    ? createAccount({
        api: createApi(server),
        store: accountStore,
        mono: () => performance.now(),
        wall: () => Date.now(),
        toast: (text, kind = "") => ui.toast(text, kind, kind === "bad" ? "!" : "i"),
        onChange: () => switchCity(),
      })
    : null;

  /** Signed in, the account's city is played (the server's); otherwise the city of this device, saved here. */
  let onAccount = !!account?.signedIn;
  const opened = onAccount ? null : openSave(store, Date.now());
  let state: PlayerState = onAccount ? account!.city()! : opened!.state;
  /** Only the city of this device is saved under its key: the account's city has its own copy (account/actions.ts). */
  const save = () => {
    if (!onAccount) saveGame(store, state, Date.now());
  };
  const speed = () => (onAccount && account ? account.speed : DEV_SPEED);

  let city: City | null = null;
  let sea: Sea | null = null;
  const refresh = () => {
    city?.update(state);
    sea?.update(state);
    ui.update(state);
  };

  const showView = (v: View) => {
    scene.setView(v);
    document.body.classList.toggle("at-sea", v === "sea");
    city?.closeSheet();
    sea?.closeSheet();
  };
  const ui = createUi(app, showView, () => {
    city?.closeSheet();
    sea?.closeSheet();
    profile.open();
  });
  ui.update(state);
  if (opened?.rejected) ui.toast("Your saved city could not be read. A copy was kept.", "bad", "!");

  /**
   * An action from a sheet: applied, or refused with the reason of the shared rules in a toast.
   * Signed in, it is also sent to the server; the city of this device needs no id, since nothing is sent.
   */
  const act = (input: ActionInput) => {
    const r = onAccount && account ? account.act(input) : applyAction(state, { ...input, id: "" } as GameAction);
    if (!r.ok) {
      // The sheet shows the reason too; the toast answers the tap.
      ui.toast(r.reason, "bad", "!");
      return;
    }
    state = r.state;
    refresh();
    save();
  };

  /** Signed in or out: the other city takes the screen. The city of this device goes on from its own save. */
  function switchCity(): void {
    const now = !!account?.signedIn;
    if (now !== onAccount) {
      save();
      onAccount = now;
      state = onAccount ? account!.city()! : openSave(store, Date.now()).state;
      city?.closeSheet();
      sea?.closeSheet();
      refresh();
      showLighthouse();
    }
    ui.signedIn(now);
    // Once signed in, the sheet goes away: what follows (a toast) needs the screen.
    if (now) profile.close();
    profile.refresh();
  }

  let fps: ReturnType<typeof createFpsCounter> | null = null;
  const scene = startScene(canvas, {
    home: HOME,
    quality: forcedQuality(location.search),
    onRaftBuildings: (models) => city?.useRaftBuildings(models),
    onLoaded: (kit, buildings, models) => {
      status.remove();
      fps?.modelsLoaded();
      city = createCity(kit, buildings, models, scene, canvas, app, { state: () => state, upgrade: (building) => act({ type: "upgrade", building }), research: (tech) => act({ type: "research", tech }), train: (troop) => act({ type: "train", troop }), promote: (troop) => act({ type: "promote", troop }), heal: () => act({ type: "heal" }), dockRaft: (slot) => act({ type: "dockRaft", slot }), installOnRaft: (slot, building) => act({ type: "installOnRaft", slot, building }), upgradeRaft: (slot) => act({ type: "upgradeRaft", slot }), toCity: () => ui.showView("city"), speed });
      sea = createSea(kit, models, scene, canvas, app, {
        state: () => state,
        sail: (site) => {
          act({ type: "sail", site });
          sea?.closeSheet();
        },
        readReport: (reportId) => act({ type: "readReport", reportId }),
        soon: () => ui.toast("Coming soon", "", "~"),
        speed,
      });
      refresh();
    },
    onError: () => (status.textContent = "Could not load the 3D models. Reload the page."),
  });

  // Measuring on a phone: ?fps shows the counter, ?quality=0|1|2 forces a quality step (docs/perf.md).
  if (fpsWanted(location.search)) fps = createFpsCounter(app, scene);

  let shownLevel = -1;
  function showLighthouse() {
    if (state.buildings.lighthouse === shownLevel) return;
    shownLevel = state.buildings.lighthouse;
    scene.setLighthouseLevel(shownLevel);
  }
  showLighthouse();

  let last = performance.now();
  let frame = 0;
  let uiAt = 0;
  let shown = signature(state);
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    // Signed in: the server's city, advanced since its answer at the server's speed, with the waiting actions.
    state = onAccount && account ? account.city()! : elapse(state, Math.max(0, now - last) / 1000, DEV_SPEED);
    last = now;
    showLighthouse();
    // The interface follows the state 4 times a second, and at once when an upgrade, a fleet step or a combat happens.
    const sig = signature(state);
    const changed = sig !== shown;
    shown = sig;
    if (now - uiAt > 250 || changed) {
      uiAt = now;
      refresh();
      if (changed) save();
    }
  };
  frame = requestAnimationFrame(loop);

  let wallets: readonly Wallet[] = [];
  let signingIn = false;
  const profile = createProfile(app, {
    view: () => ({ available: !!account, wallet: account?.wallet ?? null, wallets, busy: signingIn }),
    signIn: async (wallet) => {
      if (!account || signingIn) return;
      signingIn = true;
      profile.refresh();
      const played = !onAccount && !isUntouched(state);
      const r = await account.signInWith(wallet, { host: location.host, origin: location.origin }, played);
      signingIn = false;
      if (r.ok) profile.close();
      else ui.toast(r.error, "bad", "!");
      profile.refresh();
    },
    signOut: () => {
      void account?.signOut();
      profile.refresh();
    },
  });
  if (account) {
    watchWallets((w) => {
      wallets = w;
      profile.refresh();
    });
    ui.signedIn(account.signedIn);
    void account.start();
  }

  const saveTimer = setInterval(save, SAVE_EVERY_MS);
  // Hidden: the city of this device is saved. Shown again, or back online: what waits is sent now.
  const onVisibility = () => {
    if (document.visibilityState === "hidden") save();
    else account?.wake();
  };
  const onOnline = () => account?.wake();
  document.addEventListener("visibilitychange", onVisibility);
  addEventListener("online", onOnline);
  addEventListener("pagehide", save);

  if (import.meta.env.DEV) Object.defineProperty(window, "__state", { get: () => state, configurable: true });

  import.meta.hot?.dispose(() => {
    save();
    cancelAnimationFrame(frame);
    clearInterval(saveTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    removeEventListener("online", onOnline);
    removeEventListener("pagehide", save);
    scene.dispose();
  });
}
