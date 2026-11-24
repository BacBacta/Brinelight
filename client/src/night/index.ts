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
  /** Stops it and takes its shapes off the water. */
  dispose(): void;
};

/** Starts a Night on the island's water; `onChange` hears each step that changed what the screen shows. */
export function startNight(scene: SceneHandle, canvas: HTMLCanvasElement, opts: { seed: number; night: number; onChange?(n: N.NightState): void }): NightHandle {
  document.body.classList.add("night");
  // Fingers steer the beam: they no longer turn the camera.
  scene.lockCamera(true);
  // The camera steps back until the edge of the Night's sea is on screen.
  scene.setReach(Array.from({ length: 12 }, (_, i) => seaToWorld(i * 30, N.SEA_RADIUS, coastAt)));
  const y = SHORE.waterY + SEA_RISE + 0.04;

  const raiders = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 0.3, 0.9), new THREE.MeshLambertMaterial({ color: 0x8e2b22 }), MAX_DRAWN);
  raiders.count = 0;
  raiders.frustumCulled = false;
  scene.add(raiders);

  // The beam: a wedge of light on the water from the Lighthouse's foot to the edge of the sea, pointing north at 0°.
  const wedge = new THREE.RingGeometry(1, NIGHT_REACH, 24, 1, (90 - N.BEAM_WIDTH / 2) * RAD, N.BEAM_WIDTH * RAD).rotateX(-Math.PI / 2);
  const beam = new THREE.Mesh(wedge, new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.y = y + 0.02;
  scene.add(beam);

  let clock: N.NightClock = { night: N.newNight(opts.seed, opts.night), spare: 0 };
  let aimed = 0;
  let last: number | null = null;
  let shown = -1;
  const place = new THREE.Object3D();

  const draw = () => {
    const n = clock.night;
    beam.rotation.y = -n.beam * RAD;
    let i = 0;
    for (const e of n.enemies) {
      if (i >= MAX_DRAWN) break;
      // Between two steps: where it will be at the next one, so it moves smoothly at any screen rate.
      const d = Math.max(N.COAST_RADIUS, e.distance - clock.spare * N.FAMILY[e.family].speed * N.STEP);
      const p = seaToWorld(e.bearing, d, coastAt);
      place.position.set(p.x, y + 0.12, p.z);
      place.lookAt(0, y + 0.12, 0);
      place.updateMatrix();
      raiders.setMatrixAt(i++, place.matrix);
    }
    raiders.count = i;
    raiders.instanceMatrix.needsUpdate = true;
  };

  // The hand: the beam follows the mouse, or the finger on the water. The city's own taps (a building's sheet) wait.
  const water = y - 0.04;
  const follow = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" && e.buttons === 0 && e.type === "pointermove") return;
    const b = pointerBearing(e.clientX, e.clientY, canvas.getBoundingClientRect(), scene.cityCamera, water);
    if (b !== null) aimed = b;
  };
  const hold = (e: PointerEvent) => {
    e.stopImmediatePropagation();
    follow(e);
  };
  canvas.addEventListener("pointermove", follow);
  canvas.addEventListener("pointerdown", hold);
  canvas.addEventListener("pointerup", hold);
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

  scene.onFrame((now) => {
    if (document.hidden) return;
    const dt = last === null ? 0 : now - last;
    last = now;
    aimed = turnBy(aimed, keyTurn(), dt);
    clock = N.feedTime(clock, dt, { beam: aimed });
    draw();
    if (clock.night.step !== shown) {
      shown = clock.night.step;
      opts.onChange?.(clock.night);
    }
  });

  return {
    state: () => clock.night,
    aim(bearing) {
      aimed = bearing;
    },
    dispose() {
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", follow);
      canvas.removeEventListener("pointerdown", hold);
      canvas.removeEventListener("pointerup", hold);
      removeEventListener("keydown", onKey);
      removeEventListener("keyup", onKey);
      canvas.style.touchAction = "";
      scene.lockCamera(false);
      document.body.classList.remove("night");
      raiders.removeFromParent();
      beam.removeFromParent();
      raiders.geometry.dispose();
      (raiders.material as THREE.Material).dispose();
      wedge.dispose();
      (beam.material as THREE.Material).dispose();
      scene.setReach([]);
    },
  };
}
