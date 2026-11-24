/**
 * The Night on screen (Hold the Light, docs/design/hold-the-light.md): the rules' Night (shared/src/rules/night) run by
 * the frames' time, its enemies and its beam drawn on the island's water in plain shapes. One InstancedMesh for the
 * Raiders, one mesh for the beam; nothing is allocated in the frame loop.
 */
import * as THREE from "three";
import { night as N } from "@brinelight/shared";
import { SEA_RISE } from "../scene/cityLook.js";
import { coastAt } from "../scene/coast.js";
import type { SceneHandle } from "../scene/index.js";
import { SHORE } from "../scene/shore.js";
import { cardsHtml, postButtonHtml, troopsHtml } from "./choices.js";
import { createNightHud } from "./hud.js";
import { NIGHT_REACH, pointerBearing, seaToWorld, turnBy } from "./view.js";
import "./night.css";

/** The most Raiders drawn at once: far more than a wave sends. */
const MAX_DRAWN = 256;
const RAD = Math.PI / 180;

export type NightHandle = {
  /** The Night as the rules have it now. */
  state(): N.NightState;
  /** Where the beam is told to point, in degrees. */
  aim(bearing: number): void;
  /** A finger down or up on the 3D view: the portal hands it over (it keeps those taps from the city's own sheets). */
  hold(e: PointerEvent): void;
  /** Stops it and takes its shapes off the water. */
  dispose(): void;
};

/** Starts a Night on the island's water, with what its city gives it. */
export function startNight(
  scene: SceneHandle,
  canvas: HTMLCanvasElement,
  root: HTMLElement,
  opts: {
    night: number;
    seed: number;
    /** What the city gives this Night. */
    powers: N.NightPowers;
    /** The Night is over, won or lost: once, at once (its loot goes home now, before any tap). */
    onOver(n: N.NightState): void;
    /** "To your city" was tapped on the end card. */
    onDone(): void;
    /** The hand moved the beam (the pointer, a finger or a key). */
    onAim?(): void;
  },
): NightHandle {
  document.body.classList.add("night");
  // Fingers steer the beam: they no longer turn the camera.
  scene.lockCamera(true);
  // The camera steps back until the edge of the Night's sea is on screen.
  scene.setReach(Array.from({ length: 12 }, (_, i) => seaToWorld(i * 30, N.SEA_RADIUS, coastAt)));
  const y = SHORE.waterY + SEA_RISE + 0.04;

  // One shape a family, told apart by shape as well as color: Raiders' skiffs, Beasts' humps, Wraiths' shards (faded: ghostly).
  const shape = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const m = new THREE.InstancedMesh(geometry, material, MAX_DRAWN);
    m.count = 0;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  };
  const meshes = {
    raider: shape(new THREE.BoxGeometry(0.45, 0.3, 0.9), new THREE.MeshLambertMaterial({ color: 0x8e2b22 })),
    beast: shape(new THREE.SphereGeometry(0.55, 10, 6).scale(1, 0.55, 1.4), new THREE.MeshLambertMaterial({ color: 0x2f5d3a })),
    wraith: shape(new THREE.OctahedronGeometry(0.42).scale(1, 1.5, 1), new THREE.MeshLambertMaterial({ color: 0xc9b8ff, emissive: 0x2a1f55 })),
    faded: shape(new THREE.OctahedronGeometry(0.42).scale(1, 1.5, 1), new THREE.MeshBasicMaterial({ color: 0xc9b8ff, transparent: true, opacity: 0.22, depthWrite: false })),
  };

  // The beam: a wedge of light on the water from the Lighthouse's foot to the edge of the sea, pointing north at 0°.
  const wedge = new THREE.RingGeometry(1, NIGHT_REACH, 24, 1, (90 - N.BEAM_WIDTH / 2) * RAD, N.BEAM_WIDTH * RAD).rotateX(-Math.PI / 2);
  const beam = new THREE.Mesh(wedge, new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.y = y + 0.02;
  scene.add(beam);

  let clock: N.NightClock = { night: N.newNight(opts.seed, opts.night, opts.powers), spare: 0 };
  let over = false;
  const hud = createNightHud(root, () => opts.onDone());
  let aimed = 0;
  let last: number | null = null;
  let shown = -1;
  const place = new THREE.Object3D();

  let beamShown = -1;
  const draw = () => {
    const n = clock.night;
    beam.rotation.y = -n.beam * RAD;
    // Where the beam points, on the canvas, for the end-to-end tests (as data-view): written only when it moves.
    const deg = Math.round(n.beam);
    if (deg !== beamShown) canvas.dataset.beam = String((beamShown = deg));
    const counts = { raider: 0, beast: 0, wraith: 0, faded: 0 };
    for (const e of n.enemies) {
      const kind = e.family === "wraith" && e.fade > 0 ? "faded" : e.family;
      if (counts[kind] >= MAX_DRAWN) continue;
      // Between two steps: where it will be at the next one, so it moves smoothly at any screen rate.
      const d = Math.max(N.COAST_RADIUS, e.distance - clock.spare * N.FAMILY[e.family].speed * N.cardMods(n.cards).speed * N.STEP);
      const p = seaToWorld(e.bearing, d, coastAt);
      place.position.set(p.x, y + 0.12, p.z);
      place.lookAt(0, y + 0.12, 0);
      place.updateMatrix();
      meshes[kind].setMatrixAt(counts[kind]++, place.matrix);
    }
    for (const k of ["raider", "beast", "wraith", "faded"] as const) {
      meshes[k].count = counts[k];
      meshes[k].instanceMatrix.needsUpdate = true;
    }
    placePosts(n);
    showCards(n);
  };

  // The rafts' posts: a button over each, ＋ when empty; a tap opens the troops to choose from.
  let pendingPost: { slot: number; troop: "boarders" | "harpooners" | "crossbowmen" } | null = null;
  let pendingCard: N.CardId | null = null;
  const postsLayer = document.createElement("div");
  postsLayer.className = "night-posts";
  const chooser = document.createElement("section");
  chooser.className = "night-troops card";
  chooser.setAttribute("role", "dialog");
  chooser.setAttribute("aria-label", "Choose a troop");
  chooser.hidden = true;
  let choosing = -1;
  chooser.innerHTML = troopsHtml();
  chooser.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-troop]");
    if (!b || choosing < 0) return;
    pendingPost = { slot: choosing, troop: b.dataset.troop as "boarders" };
    chooser.hidden = true;
    choosing = -1;
  });
  postsLayer.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-post]");
    if (!b) return;
    choosing = Number(b.dataset.post);
    chooser.hidden = false;
  });
  root.append(postsLayer, chooser);
  let postsShown = "";
  const placePosts = (n: N.NightState) => {
    const key = n.posts.join();
    if (key !== postsShown || postsLayer.children.length !== n.posts.length) {
      postsShown = key;
      postsLayer.innerHTML = n.posts.map((t, i) => `<button class="night-post" data-post="${i}">${postButtonHtml(t)}</button>`).join("");
    }
    n.posts.forEach((_, i) => {
      const w = seaToWorld(N.postBearing(i, n.posts.length), N.COAST_RADIUS + 1.5, coastAt);
      const p = scene.project(w.x, y, w.z);
      const el = postsLayer.children[i] as HTMLElement | undefined;
      if (el) el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -50%)`;
    });
  };

  // The cards of a pause: the next wave waits for your choice (a tap, or 1, 2, 3).
  const cardsPanel = document.createElement("section");
  cardsPanel.className = "night-cards card";
  cardsPanel.setAttribute("role", "dialog");
  cardsPanel.hidden = true;
  cardsPanel.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-card]");
    if (b) pendingCard = b.dataset.card as N.CardId;
  });
  root.append(cardsPanel);
  let offerShown = "";
  const showCards = (n: N.NightState) => {
    const key = n.offer.join();
    if (key === offerShown) return;
    offerShown = key;
    cardsPanel.hidden = n.offer.length === 0;
    if (n.offer.length) {
      cardsPanel.innerHTML = cardsHtml(n.offer);
      cardsPanel.querySelector<HTMLButtonElement>("[data-card]")?.focus();
    }
  };
  const onCardKey = (e: KeyboardEvent) => {
    const i = ["Digit1", "Digit2", "Digit3", "Numpad1", "Numpad2", "Numpad3"].indexOf(e.code) % 3;
    const offer = clock.night.offer;
    if (i >= 0 && offer[i]) pendingCard = offer[i]!;
  };
  addEventListener("keydown", onCardKey);

  // The hand: the beam follows the mouse, or the finger on the water. The city's own taps (a building's sheet) wait.
  const water = y - 0.04;
  const follow = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" && e.buttons === 0 && e.type === "pointermove") return;
    const b = pointerBearing(e.clientX, e.clientY, canvas.getBoundingClientRect(), scene.cityCamera, water);
    if (b !== null) {
      aimed = b;
      opts.onAim?.();
    }
  };
  canvas.addEventListener("pointermove", follow);
  canvas.style.touchAction = "none";
  // The keys: ← → or A D (by their place on the keyboard: Q D on AZERTY) turn the beam while held.
  const held = new Set<string>();
  const TURN_KEYS: Record<string, -1 | 1> = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
  const onKey = (e: KeyboardEvent) => {
    if (!(e.code in TURN_KEYS)) return;
    e.preventDefault();
    if (e.type === "keydown") held.add(e.code);
    else held.delete(e.code);
  };
  addEventListener("keydown", onKey);
  addEventListener("keyup", onKey);
  const keyTurn = (): -1 | 0 | 1 => {
    let d = 0;
    for (const k of held) d += TURN_KEYS[k]!;
    return d > 0 ? 1 : d < 0 ? -1 : 0;
  };

  // A hidden page stops the Night: no frame comes, and the first one back runs no time.
  const onVisibility = () => {
    last = null;
    held.clear();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const stopFrames = scene.onFrame((now) => {
    if (document.hidden) return;
    const dt = last === null ? 0 : now - last;
    last = now;
    const turn = keyTurn();
    if (turn !== 0) opts.onAim?.();
    aimed = turnBy(aimed, turn, dt);
    clock = N.feedTime(clock, dt, { beam: aimed, ...(pendingCard ? { card: pendingCard } : {}), ...(pendingPost ? { post: pendingPost } : {}) });
    // A choice is given to the steps of one frame (a frame may run none: the next one takes it).
    if (pendingCard && !clock.night.offer.includes(pendingCard)) pendingCard = null;
    if (pendingPost && clock.night.posts[pendingPost.slot] === pendingPost.troop) pendingPost = null;
    draw();
    if (clock.night.step !== shown) {
      shown = clock.night.step;
      hud.update(clock.night);
      const p = clock.night.phase;
      if (!over && (p === "won" || p === "lost")) {
        over = true;
        opts.onOver(clock.night);
      }
    }
  });

  return {
    state: () => clock.night,
    aim(bearing) {
      aimed = bearing;
    },
    hold: follow,
    dispose() {
      stopFrames();
      hud.dispose();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", follow);
      removeEventListener("keydown", onKey);
      removeEventListener("keyup", onKey);
      canvas.style.touchAction = "";
      scene.lockCamera(false);
      document.body.classList.remove("night");
      removeEventListener("keydown", onCardKey);
      postsLayer.remove();
      chooser.remove();
      cardsPanel.remove();
      for (const m of Object.values(meshes)) {
        m.removeFromParent();
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      beam.removeFromParent();
      wedge.dispose();
      (beam.material as THREE.Material).dispose();
      scene.setReach([]);
    },
  };
}
