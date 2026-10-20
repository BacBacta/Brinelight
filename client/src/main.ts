/**
 * Week 2: the city scene from the prototype (island, sea, sky, Lighthouse),
 * driven by the player's state, which produces with the shared rules and is saved locally,
 * with the 9 buildings, their sheets, the builders' queue, the top bar and the bottom menu,
 * and the sea view with its pirate camps, wrecks, fleets and combat reports.
 * The week 1 rules table stays available with ?rules.
 * Week 3: sign in with your wallet (Profile, on the Power card) to keep your city on your account.
 * Week 4: signed in, every action is sent to the server, which decides; the city shown is the server's.
 * Week 5: troops are trained at the Barracks, and the wounded healed at the Infirmary.
 * Week 6: what ends is celebrated, and at launch what ended while you were away (compared with the last city seen here);
 * light sounds of wood and rope, made by the game, that you can turn off in the Profile.
 * The reference prototype stays playable at /prototype/.
 */
import { BUILDING_IDS, HOME, applyAction, yardSlot, type GameAction } from "@brinelight/shared";
import type { Wallet } from "@wallet-standard/base";
import type { ActionInput } from "./account/actions.js";
import { createAccount, isUntouched } from "./account/index.js";
import { apiUrl, createApi } from "./account/api.js";
import { createProfile } from "./account/profile.js";
import { watchWallets } from "./account/wallets.js";
import { createCity, type City } from "./city/index.js";
import { isStaged, loadStage, shownModels, tallestHeight } from "./city/staged.js";
import { raftSlots, raftVariant } from "./city/rafts.js";
import { hasVillage, villageShown } from "./city/village.js";
import { blenderLook } from "./scene/cityLook.js";
import { showRules } from "./rules.js";
import { forcedQuality, startScene, type Kit, type Models, type View } from "./scene/index.js";
import { createSea, type Sea } from "./sea/index.js";
import { createFpsCounter } from "./ui/fps.js";
import { fpsWanted } from "./ui/fpsMeter.js";
import { createCaptainsSheet } from "./ui/captains.js";
import { createCelebrations } from "./ui/celebrate.js";
import { createDailySheet, createQuest, createTasksButton } from "./ui/daily.js";
import { createUi } from "./ui/index.js";
import { mistPreview, seaMood } from "./ui/values.js";
import { createSound, type SoundId } from "./ui/sound.js";
import { DEVICE, DEV_SPEED, SAVE_EVERY_MS, accountOwner, awayEvents, browserStore, elapse, eventsBetween, openSave, readSeen, saveGame, writeSeen, type PlayerState } from "./state/index.js";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

/** The actions that start a work: they knock twice on wood. */
const WORKS = new Set<ActionInput["type"]>(["upgrade", "research", "train", "promote", "heal", "dockRaft", "installOnRaft", "upgradeRaft", "repairRafts", "sail"]);

/** What the screen shows: changes here open a report, refresh a sheet, and save the city of this device. */
const signature = (s: PlayerState): string =>
  `${s.queue.map((j) => j.id).join()}|${s.research?.id ?? ""}|${JSON.stringify(s.techs)}|${s.yard ? `${s.yard.kind}${yardSlot(s.yard) ?? ""}` : ""}|${JSON.stringify(s.rafts)}|${s.training ? `${s.training.kind}${s.training.troop}` : ""}|${s.healing ? "h" : ""}|${JSON.stringify(s.troops)}|${JSON.stringify(s.veterans)}|${s.lead}|${JSON.stringify(s.captains)}|${JSON.stringify(s.shards)}|${s.reports.map((r) => `${r.id}${r.read ? "+" : "-"}`).join()}|${s.fleets.map((f) => f.phase).join()}|${s.mist.stoke}${s.mist.dark}${s.mist.held}.${s.mist.missed}`;

if (new URLSearchParams(location.search).has("rules")) {
  showRules(app);
} else {
  document.body.classList.add("scene");
  // The look made in Blender (?blender): its sheets take at most half the screen, so the close view shows the building.
  document.body.classList.toggle("era-look", blenderLook());
  app.innerHTML = `<canvas id="cv" aria-label="3D view of your city"></canvas><p class="loading" role="status">Loading your city…</p>`;
  const status = app.querySelector<HTMLParagraphElement>(".loading")!;
  const canvas = app.querySelector<HTMLCanvasElement>("#cv")!;

  const store = browserStore();
  // The last city seen on this device, read before anything writes it: at launch, what ended since is told once.
  const seen = readSeen(store);
  // Sounds: none before your first tap, and none when turned off on this device.
  const sound = createSound(store);

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
  /** Whose city is shown: the city of this device, or the account's. */
  const owner = () => (onAccount && account?.wallet ? accountOwner(account.wallet) : DEVICE);
  /**
   * The city last shown, to tell what ended since; null until the city has arrived (signed in: the server's answer at
   * launch), so that nothing is celebrated twice.
   */
  let shownCity: PlayerState | null = null;
  const remember = () => {
    if (shownCity) writeSeen(store, owner(), state);
  };

  let city: City | null = null;
  let sea: Sea | null = null;
  const refresh = () => {
    city?.update(state);
    sea?.update(state);
    captains.update(state);
    daily.update(state);
    quest.update(state);
    tasks.update(state);
    ui.update(state);
  };

  const showView = (v: View) => {
    if (v === "sea") openSea();
    scene.setView(v);
    document.body.classList.toggle("at-sea", v === "sea");
    city?.closeSheet();
    sea?.closeSheet();
    captains.close();
    daily.close();
  };
  // The sea's mood, for the banner and the 3D view: the Mist when the rules say it is on; ?mist shows its look.
  const preview = mistPreview(location.search);
  let mood = seaMood(state, preview);
  const ui = createUi(
    app,
    showView,
    () => {
      city?.closeSheet();
      sea?.closeSheet();
      captains.close();
      daily.close();
      profile.open();
    },
    // The Captains button opens its sheet over the view you are in.
    () => {
      city?.closeSheet();
      sea?.closeSheet();
      profile.close();
      daily.close();
      captains.open(state);
    },
    preview,
  );
  ui.update(state);
  if (opened?.rejected) ui.toast("Your saved city could not be read. A copy was kept.", "bad", "!");
  const celebrations = createCelebrations(app, (c) => sound.play(c.sound));
  /** The city has arrived: what ended since the last city seen on this device, if it is the same owner's, is told. */
  const arrive = () => {
    if (shownCity) return;
    if (onAccount && account) state = account.city()!;
    celebrations.add(awayEvents(seen, owner(), state), true);
    shownCity = state;
    remember();
  };

  /**
   * An action from a sheet: applied, or refused with the reason of the shared rules in a toast.
   * Signed in, it is also sent to the server; the city of this device needs no id, since nothing is sent.
   */
  const act = (input: ActionInput) => {
    const r = onAccount && account ? account.act(input) : applyAction(state, { ...input, id: "" } as GameAction);
    if (!r.ok) {
      // The sheet shows the reason too; the toast answers the tap.
      ui.toast(r.reason, "bad", "!");
      sound.play("refused");
      return;
    }
    sound.play(WORKS.has(input.type) ? "start" : "tap");
    // What it cost rolls in the top bar; never while a celebration plays: one motion at a time.
    if (!celebrations.playing) ui.roll();
    state = r.state;
    refresh();
    save();
  };

  // A tap on a button that is not an action (the menu, the Power card, "+N more") knocks once; a sheet that opens or
  // closes sounds like a rope.
  app.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button, [role=button]");
    if (b && !b.dataset.act) sound.play("tap");
  });
  new MutationObserver((changes) => {
    for (const c of changes) {
      const el = c.target as HTMLElement;
      if (el.classList.contains("sheet") && (c.oldValue !== null) !== el.hidden) sound.play((el.hidden ? "close" : "open") satisfies SoundId);
    }
  }).observe(app, { subtree: true, attributes: true, attributeFilter: ["hidden"], attributeOldValue: true });

  const captains = createCaptainsSheet(app, {
    setLead: (captain) => act({ type: "setLead", captain }),
    logbook: () => act({ type: "logbook" }),
    unlock: (captain) => act({ type: "unlockCaptain", captain }),
    addStar: (captain) => act({ type: "addStar", captain }),
  });
  // The current objective above the bottom menu, and the daily tasks from the Tasks button: the rules count, you claim.
  const daily = createDailySheet(app, { openChest: (chest) => act({ type: "claimChest", chest }) });
  const quest = createQuest(app, () => act({ type: "claimObjective" }));
  const tasks = createTasksButton(app, () => {
    city?.closeSheet();
    sea?.closeSheet();
    captains.close();
    profile.close();
    daily.open(state);
  });
  // A tap in the 3D view is for the city or the sea: the Captains and Daily Tasks sheets make way.
  canvas.addEventListener("pointerup", () => {
    captains.close();
    daily.close();
  });

  /** Signed in or out: the other city takes the screen. The city of this device goes on from its own save. */
  function switchCity(): void {
    const now = !!account?.signedIn;
    if (now !== onAccount) {
      save();
      onAccount = now;
      state = onAccount ? account!.city()! : openSave(store, Date.now()).state;
      // The other city takes the screen: that is not news, nothing is celebrated.
      if (shownCity) shownCity = state;
      remember();
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
  /** The city's normal view fits below the panels at the top and above the tab bar (scene/framing.ts). */
  function cityBand() {
    let top = 0;
    for (const el of document.querySelectorAll(".hud > *, .sub > *")) {
      const r = el.getBoundingClientRect();
      if (r.height > 0) top = Math.max(top, r.bottom);
    }
    const nav = document.querySelector(".nav")?.getBoundingClientRect();
    return { top: top + 4, bottom: (nav && nav.height > 0 ? nav.top : innerHeight) - 4 };
  }
  // The sea: made at once with the old look; with the look made in Blender, at your first visit at sea, when its models
  // (the prototype's kit, the wreck, the camp, your boat) are fetched.
  const seaLater = blenderLook();
  function makeSea(kit: Kit, models: Models): void {
    if (sea) return;
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
  }
  let seaAsked = false;
  function openSea(): void {
    if (!seaLater || seaAsked) return;
    seaAsked = true;
    scene.loadSea().then(
      ({ kit, models }) => makeSea(kit, models),
      (err: unknown) => {
        seaAsked = false;
        console.error(err);
        ui.toast("Could not load the sea. Try again.", "bad", "!");
      },
    );
  }
  // The look made in Blender (?blender, week 8): the old models of the buildings remade are not fetched, and the city
  // shows once the models of their current era are there.
  const remade = blenderLook() ? Object.fromEntries(BUILDING_IDS.filter(isStaged).map((id) => [id, tallestHeight(id)])) : undefined;
  // The floating village made in Blender: its models of the Lighthouse's age that the city shows, also before its first image.
  const village = blenderLook() && hasVillage();
  const slots = raftSlots(state).map((s) => ({ ...s, variant: raftVariant(s.key) }));
  const afloat = village ? villageShown(slots, state.rafts, state.buildings.lighthouse) : [];
  const ready = blenderLook() ? Promise.all([...shownModels(state), ...afloat].map(loadStage)) : undefined;
  const scene = startScene(canvas, {
    home: HOME,
    // The sheet open at the bottom (on a phone; on a wide screen it stands at the right): its height, not its slide-in.
    sheetTop: () => {
      const open = document.querySelector<HTMLElement>(".sheet:not([hidden])");
      return open && innerWidth < 900 ? innerHeight - open.offsetHeight : null;
    },
    remade,
    ready,
    village,
    seaLater,
    band: cityBand,
    quality: forcedQuality(location.search),
    onRaftBuildings: (models) => city?.useRaftBuildings(models),
    onLoaded: (kit, buildings, models) => {
      status.remove();
      fps?.modelsLoaded();
      if (!seaLater) makeSea(kit, models);
      city = createCity(kit, buildings, models, scene, canvas, app, { state: () => state, upgrade: (building) => act({ type: "upgrade", building }), research: (tech) => act({ type: "research", tech }), train: (troop) => act({ type: "train", troop }), promote: (troop) => act({ type: "promote", troop }), heal: () => act({ type: "heal" }), stoke: (on) => act({ type: "stoke", on }), dockRaft: (slot) => act({ type: "dockRaft", slot }), installOnRaft: (slot, building) => act({ type: "installOnRaft", slot, building }), upgradeRaft: (slot) => act({ type: "upgradeRaft", slot }), repairRafts: () => act({ type: "repairRafts" }), toCity: () => ui.showView("city"), speed });
      refresh();
    },
    onError: () => (status.textContent = "Could not load the 3D models. Reload the page."),
  });

  scene.setMood(mood, true);

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
    // The Mist comes and lifts on the city's clock: the 3D view fades into its look and out of it.
    const m = seaMood(state, preview);
    if (m !== mood) scene.setMood((mood = m));
    // The interface follows the state 4 times a second, and at once when an upgrade, a fleet step or a combat happens.
    const sig = signature(state);
    const changed = sig !== shown;
    shown = sig;
    if (changed && shownCity) {
      celebrations.add(eventsBetween(shownCity, state));
      shownCity = state;
    }
    if (now - uiAt > 250 || changed) {
      uiAt = now;
      // At the lowest quality step, the costly motions stop (the celebrations' beam).
      document.body.classList.toggle("low", scene.stats().step === 2);
      refresh();
      if (changed) {
        save();
        remember();
      }
    }
  };
  frame = requestAnimationFrame(loop);

  let wallets: readonly Wallet[] = [];
  let signingIn = false;
  const profile = createProfile(app, {
    view: () => ({ available: !!account, wallet: account?.wallet ?? null, wallets, busy: signingIn }),
    sound: () => sound.on,
    toggleSound: () => {
      sound.on = !sound.on;
      sound.play("tap");
    },
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
    void account.start().then(arrive, arrive);
  }
  if (!onAccount) arrive();

  const saveTimer = setInterval(() => {
    save();
    remember();
  }, SAVE_EVERY_MS);
  // Hidden: the city of this device is saved. Shown again, or back online: what waits is sent now.
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      save();
      remember();
    } else account?.wake();
  };
  const onOnline = () => account?.wake();
  document.addEventListener("visibilitychange", onVisibility);
  addEventListener("online", onOnline);
  addEventListener("pagehide", save);
  addEventListener("pagehide", remember);

  if (import.meta.env.DEV) Object.defineProperty(window, "__state", { get: () => state, configurable: true });

  import.meta.hot?.dispose(() => {
    save();
    cancelAnimationFrame(frame);
    clearInterval(saveTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    removeEventListener("online", onOnline);
    removeEventListener("pagehide", save);
    removeEventListener("pagehide", remember);
    scene.dispose();
  });
}
