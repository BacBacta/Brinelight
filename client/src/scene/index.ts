import * as THREE from "three";
import type { BuildingId } from "@brinelight/shared";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadBuildings, tierOf, type BuildingModels } from "./buildings.js";
import { ISLAND_ANISOTROPY, filterTexture, fitIsland, loadModels, loadRaftBuildings, type Models, type RaftBuildingModels } from "./models.js";
import { createCamera, createControls, frameCity } from "./camera.js";
import { shapeCoast } from "./coast.js";
import { blenderLook, cityModelUrl, gridIsland } from "./cityLook.js";
import { CITY_ANGLE, cityFraming, clearView, type Volume } from "./framing.js";
import { createIsland, type Kit } from "./island.js";
import { createLighthouse, lighthouseScale } from "./lighthouse.js";
import { applyQualityStep, createQualityMonitor, type QualityStep } from "./quality.js";
import { createRenderer } from "./renderer.js";
import { createSky } from "./sky.js";
import { CITY_CALM, CITY_MIST, CITY_WATER, SEA_CALM, SEA_MIST, addLook, applyLook, mixLook, type SeaMood } from "./look.js";
import { createVeil } from "./veil.js";
import { createSeaView } from "./sea.js";
import { createWater } from "./water.js";
import { createShore, type Disc } from "./shore.js";

export type { Kit } from "./island.js";
export { BUILDING_FIX, buildingUrl, normalizeBuilding, type BuildingModel, type BuildingModels } from "./buildings.js";
export { ISLAND_TURN, MODEL_IDS, RAFT_BUILDING_IDS, SHORE_RADIUS, bakeModel, fitIsland, modelUrl, type Models, type RaftBuildingModels } from "./models.js";
export { hexGeometry, hexX, hexZ, kitModel } from "./island.js";
export { createLighthouse, lighthouseScale } from "./lighthouse.js";
export { WAVE_HEIGHT } from "./water.js";

export type View = "city" | "sea";
export type { QualityStep } from "./quality.js";
export type { Disc } from "./shore.js";
export type { SeaMood } from "./look.js";
export { forcedQuality } from "./quality.js";

/** What the ?fps counter shows about rendering. */
export type RenderStats = { step: QualityStep; forced: boolean; mood: SeaMood; calls: number; triangles: number };

/** A point on screen; `depth` grows with the distance from the camera (normalized device depth). */
export type ScreenPoint = { x: number; y: number; depth: number; visible: boolean };

export type SceneHandle = {
  /** Resizes the Lighthouse for this level, and puts the camera back on the normal view. */
  setLighthouseLevel(level: number): void;
  /** The Lighthouse's model made in Blender for its level's stage, at its own size, its lantern at `lantern`. */
  useLighthouseStage(object: THREE.Object3D, lantern: number, top: number): void;
  /** The Lighthouse's radar (its Modern era), turning at `at` on its mast; null takes it off. */
  useLighthouseRadar(object: THREE.Object3D | null, at?: readonly [number, number, number]): void;
  /**
   * The close view (week 8): the camera glides toward a building, so it fills about half of the screen above its sheet,
   * going around it if need be until none of the `others` hides it; `unfocus` glides back to the normal view. With
   * reduced motion, it jumps.
   */
  focus(building: Volume, others: readonly Volume[]): void;
  unfocus(): void;
  /** Shows the city or the sea; only the shown view moves with your fingers. */
  setView(view: View): void;
  /** The sea's models, fetched once (at once, unless `seaLater` held them back): the kit and all the models. */
  loadSea(): Promise<{ kit: Kit; models: Models }>;
  readonly view: View;
  /** Adds an object to the city (default) or to the sea. */
  add(object: THREE.Object3D, view?: View): void;
  /** Objects under a screen point (client pixels) in the shown view, nearest first. */
  pick(clientX: number, clientY: number, targets: THREE.Object3D[]): THREE.Intersection[];
  /** Screen position (CSS pixels) of a point of the shown view. */
  project(x: number, y: number, z: number): ScreenPoint;
  /** Called on every drawn frame, before rendering, with the scene clock in seconds and the shown view. */
  onFrame(cb: (now: number, view: View) => void): void;
  /** How much nearer the city's camera is than in the normal view: 1 there, more when zoomed in or in the close view. */
  closeness(): number;
  /** The city's camera, to tell what is on screen. */
  readonly cityCamera: THREE.Camera;
  /**
   * The sea's mood, calm or the Mist (its look only): the light, the fog, the water, the veil and the Lighthouses' beams
   * fade to it in 1.5 s, or at once (`now`, or with reduced motion on the device).
   */
  setMood(mood: SeaMood, now?: boolean): void;
  /** How much the Lighthouses' beams show, 0 to 1 (the sea map's Lighthouses follow it). */
  readonly beams: number;
  /** The rafts moored around the island (and the shipyard at work): the foam goes around them, and the normal view keeps them on screen. */
  setMoored(discs: readonly Disc[]): void;
  /** Quality step and the last frame's draw calls and triangles (renderer.info). */
  stats(): RenderStats;
  /** Stops the loop and removes the listeners. */
  dispose(): void;
};

export type SceneOptions = {
  /** A quality step forced for measuring (?quality): automatic tuning is then off. */
  quality?: QualityStep | null;
  /** Where the sea camera first looks: your city on the sea map. */
  home?: { x: number; z: number };
  /** Called once phare.glb, the nine buildings and the other models are loaded (and what `ready` waits for). */
  onLoaded?: (kit: Kit, buildings: BuildingModels, models: Models) => void;
  /**
   * The buildings made in Blender (week 8), with the height they stand in at: their old models are not fetched. The
   * city shows once `ready` is done too: the models of their current era, so they are there from the first image.
   */
  remade?: Partial<Record<BuildingId, number>>;
  ready?: Promise<unknown>;
  /**
   * The sea's models wait for your first visit at sea (with the look made in Blender): the prototype's kit (2.9 MB) and
   * the wreck, the camp and your boat are not fetched for the city's first image; `loadSea` fetches them.
   */
  seaLater?: boolean;
  /** The buildings on rafts, loaded after the city shows. */
  onRaftBuildings?: (models: RaftBuildingModels) => void;
  /** The floating village is made in Blender (city/village.ts): the old raft and buildings on rafts are not fetched. */
  village?: boolean;
  onError?: (err: unknown) => void;
  /** The band of the screen the city's normal view must fit in, in CSS pixels: below the top panels, above the bottom ones. */
  band?: () => { top: number; bottom: number };
  /** The top of the sheet open at the bottom of the screen, if one is (CSS pixels): the close view stays above it. */
  sheetTop?: () => number | null;
};

const KIT_URL = `${import.meta.env.BASE_URL}prototype/assets/phare.glb`;

/** The two views of the prototype: the city (island, Lighthouse) and the sea map. */
export function startScene(canvas: HTMLCanvasElement, options: SceneOptions = {}): SceneHandle {
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  const look = addLook(scene, createSky(CITY_CALM.sky), CITY_CALM, true);
  const { sun } = look;
  const veil = createVeil();
  scene.add(veil.mesh);
  // With ?blender, the city's water has 64 subdivisions at most (meeting 4: room for the island's life).
  const water = createWater(blenderLook() ? { ...CITY_WATER, maxSegments: 64 } : CITY_WATER);
  scene.add(water.mesh);
  water.useRenderer(renderer);
  // The foam goes along the island's shore and around the rafts moored there (setMoored).
  let shore: ReturnType<typeof createShore> | null = null;
  let moored: readonly Disc[] = [];
  const lighthouse = createLighthouse();
  scene.add(lighthouse.group);

  const camera = createCamera();
  const controls = createControls(camera, canvas);
  // Set by setLighthouseLevel before the first frame is drawn.
  let level = 0;

  const sea = createSeaView(canvas);
  sea.water.useRenderer(renderer);
  sea.controls.enabled = false;
  const home = options.home ?? { x: 0, z: 0 };
  let view: View = "city";

  /** The camera's distance the city's fog was set for (the prototype's farthest view), and how far it is pushed back now. */
  const FOG_SET_AT = 39.6;
  let fogScale = 1;
  // The close view's glide, and the normal view to come back to.
  let normal = { distance: 30, target: new THREE.Vector3() };
  let focused = false;
  // The glide goes around the point looked at (its distance and its angles move), never through the island.
  let glide: { from: [THREE.Spherical, THREE.Vector3]; to: [THREE.Spherical, THREE.Vector3]; start: number } | null = null;
  const GLIDE = 0.6;
  const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const glideTo = (position: THREE.Vector3, target: THREE.Vector3) => {
    if (reduced()) {
      camera.position.copy(position);
      controls.target.copy(target);
      controls.update();
      glide = null;
      return;
    }
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const to = new THREE.Spherical().setFromVector3(position.clone().sub(target));
    // The shorter way around.
    while (to.theta - from.theta > Math.PI) to.theta -= Math.PI * 2;
    while (from.theta - to.theta > Math.PI) to.theta += Math.PI * 2;
    glide = { from: [from, controls.target.clone()], to: [to, target], start: performance.now() };
  };
  const layout = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    const band = options.band?.() ?? { top: 0, bottom: innerHeight };
    // The Lighthouse made in Blender is taller: its top stays on screen too.
    const tops = lighthouseStaged ? [{ x: 0, y: lighthouseTop, z: 0 }] : [];
    const framing = cityFraming({ width: innerWidth, height: innerHeight, ...band }, moored, tops);
    normal = framing;
    if (focused) {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
    } else frameCity(camera, controls, innerWidth / innerHeight, framing);
    // The fog keeps its look at any distance: it was set for the prototype's farthest view.
    fogScale = Math.max(1, framing.distance / FOG_SET_AT);
    showMood(moodAt);
    sea.layout(innerWidth / innerHeight, home);
  };
  const shown = () => (view === "city" ? { scene, camera, controls } : sea);

  // The sea's mood: 0 calm, 1 the Mist; `moodAt` fades to `moodTo`.
  let mood: SeaMood = "calm";
  let moodAt = 0;
  let moodTo = 0;
  let beams = 0;
  const showMood = (t: number) => {
    const city = mixLook(CITY_CALM, CITY_MIST, t);
    applyLook(look, { ...city, fog: { ...city.fog, near: city.fog.near * fogScale, far: city.fog.far * fogScale } });
    const atSea = mixLook(SEA_CALM, SEA_MIST, t);
    applyLook(sea.look, atSea);
    water.setLead(city.lead, city.sky[2]);
    sea.water.setLead(atSea.lead, atSea.sky[2]);
    veil.set(city.veil);
    lighthouse.setBeams(city.beams);
    beams = city.beams;
  };
  /** The mood's fade, in seconds. */
  const MOOD_FADE = 1.5;
  addEventListener("resize", layout);

  let disposed = false;
  // One loader: the kit (scaffolding, the sea's other sites), the nine buildings and the other models, in parallel;
  // the city shows once all are there. The buildings on rafts follow.
  const loader = new GLTFLoader();
  const blender = blenderLook();
  // The island made to the grid replaces the old island: that one is not fetched. With `seaLater`, the sea's own
  // models wait for your first visit at sea.
  const seaOnly = ["wreck", "camp", "boat"] as const;
  const later = !!options.seaLater;
  let city: { kit: Kit; models: Models } | null = null;
  let cityLoaded = () => {};
  const cityDone = new Promise<void>((resolve) => (cityLoaded = resolve));
  let seaModels: Promise<{ kit: Kit; models: Models }> | null = null;
  const kitOf = (gltf: { scenes: THREE.Group[] }): Kit => {
    const kit: Kit = {};
    gltf.scenes.forEach((sc) => (kit[sc.name] = sc));
    return kit;
  };
  Promise.all([
    later ? Promise.resolve({ scenes: [] as THREE.Group[] }) : loader.loadAsync(KIT_URL),
    loadBuildings(loader, options.remade),
    loadModels(loader, [...(blender ? (["island"] as const) : []), ...(options.village ? (["raft"] as const) : []), ...(later ? seaOnly : [])]),
    blender ? loader.loadAsync(cityModelUrl("island")) : null,
    options.ready,
  ]).then(
    ([gltf, buildings, models, gridModel]) => {
      if (disposed) return;
      const kit = kitOf(gltf);
      city = { kit, models };
      cityLoaded();
      const anisotropy = Math.min(ISLAND_ANISOTROPY, renderer.capabilities.getMaxAnisotropy());
      let island: THREE.Object3D;
      if (gridModel) {
        // The island made to the grid: its coast is already where the rafts need it.
        filterTexture(gridModel.scene, anisotropy);
        island = gridIsland(gridModel.scene);
      } else {
        filterTexture(models.island, anisotropy);
        island = fitIsland(models.island);
        shapeCoast(island);
      }
      scene.add(createIsland(island));
      shore = createShore(island);
      water.setShore(shore.distances(moored));
      lighthouse.useModel(buildings.lighthouse);
      sizeLighthouse();
      options.onLoaded?.(kit, buildings, models);
      if (!options.village)
        loadRaftBuildings(loader).then(
          (m) => !disposed && options.onRaftBuildings?.(m),
          (err: unknown) => console.error(err),
        );
    },
    (err: unknown) => {
      console.error(err);
      if (!disposed) options.onError?.(err);
    },
  );

  /** Its level's size, as wide as its plot allows (it then only grows taller), and its tier's lantern. */
  let lighthouseStaged = false;
  let lighthouseTop = 0;
  function sizeLighthouse(): void {
    lighthouse.setTier(tierOf(level));
    // A stage's model has its own size.
    if (lighthouseStaged) return void lighthouse.group.scale.setScalar(1);
    const s = lighthouseScale(level);
    const w = Math.min(s, lighthouse.widthCap);
    lighthouse.group.scale.set(w, s, w);
    lighthouse.setTier(tierOf(level));
  }
  const frameCallbacks: ((now: number, view: View) => void)[] = [];
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const v3 = new THREE.Vector3();

  const forced = options.quality ?? null;
  let step: QualityStep = forced ?? 0;
  if (forced !== null) applyQualityStep(renderer, sun, forced, [water, sea.water]);
  const quality = forced === null ? createQualityMonitor() : null;
  const clock = new THREE.Clock();
  let frame = 0;
  const loop = () => {
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.1, clock.getDelta());
    const now = clock.elapsedTime;
    const next = quality?.tick(dt) ?? null;
    if (next !== null) {
      step = next;
      applyQualityStep(renderer, sun, next, [water, sea.water]);
      layout();
    }
    if (moodAt !== moodTo) {
      moodAt = moodTo > moodAt ? Math.min(moodTo, moodAt + dt / MOOD_FADE) : Math.max(moodTo, moodAt - dt / MOOD_FADE);
      showMood(moodAt);
    }
    const v = shown();
    if (view === "city") {
      water.setTime(now);
      lighthouse.animate(now);
    } else {
      sea.water.setTime(now);
    }
    if (glide && view === "city") {
      const t = Math.min(1, (performance.now() - glide.start) / (GLIDE * 1000));
      const e = t * t * (3 - 2 * t);
      const [a, b] = [glide.from[0], glide.to[0]];
      controls.target.lerpVectors(glide.from[1], glide.to[1], e);
      const at = new THREE.Spherical(a.radius + (b.radius - a.radius) * e, a.phi + (b.phi - a.phi) * e, a.theta + (b.theta - a.theta) * e);
      camera.position.setFromSpherical(at).add(controls.target);
      if (t >= 1) glide = null;
    }
    v.controls.update();
    for (const cb of frameCallbacks) cb(now, view);
    renderer.render(v.scene, v.camera);
  };

  const handle: SceneHandle = {
    setLighthouseLevel(l) {
      level = l;
      sizeLighthouse();
      layout();
    },
    useLighthouseRadar(object, at) {
      lighthouse.useRadar(object, at);
    },
    useLighthouseStage(object, lantern, top) {
      const moved = !lighthouseStaged || top !== lighthouseTop;
      lighthouseStaged = true;
      lighthouseTop = top;
      lighthouse.useStaged(object, lantern);
      sizeLighthouse();
      if (moved) layout();
    },
    focus(building, others) {
      focused = true;
      // Between the top panels and the sheet: its top when it says where it is (a short sheet leaves more room), else
      // 45 % of the screen's height.
      const band = options.band?.() ?? { top: 0, bottom: innerHeight };
      const sheet = options.sheetTop?.();
      const bottom = sheet ? sheet - 8 : innerHeight * 0.45;
      const close = clearView({ width: innerWidth, height: innerHeight, top: band.top, bottom: Math.max(band.top + 80, bottom) }, building, others);
      glideTo(close.target.clone().addScaledVector(close.angle, close.distance), close.target);
    },
    unfocus() {
      if (!focused) return;
      focused = false;
      glideTo(normal.target.clone().addScaledVector(CITY_ANGLE, normal.distance), normal.target.clone());
    },
    loadSea() {
      if (!seaModels) {
        if (!later) seaModels = cityDone.then(() => city!);
        else
          seaModels = Promise.all([loader.loadAsync(KIT_URL), loadModels(loader, ["island", "raft"]), cityDone]).then(([gltf, more]) => {
            const kit = kitOf(gltf);
            // The city's models gain the sea's: the same object, so what holds it sees them.
            for (const id of seaOnly) city!.models[id] = more[id];
            return { kit, models: city!.models };
          });
      }
      return seaModels;
    },
    setView(v) {
      view = v;
      controls.enabled = v === "city";
      sea.controls.enabled = v === "sea";
    },
    get view() {
      return view;
    },
    setMood(next, now = false) {
      mood = next;
      moodTo = next === "mist" ? 1 : 0;
      if (now || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        moodAt = moodTo;
        showMood(moodAt);
      }
    },
    get beams() {
      return beams;
    },
    setMoored(discs) {
      const changed = discs.length !== moored.length || discs.some((d, i) => d.x !== moored[i]!.x || d.z !== moored[i]!.z);
      moored = discs;
      if (shore) water.setShore(shore.distances(discs));
      if (changed) layout();
    },
    stats() {
      return { step, forced: forced !== null, mood, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
    add(object, v = "city") {
      (v === "city" ? scene : sea.scene).add(object);
    },
    pick(clientX, clientY, targets) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, shown().camera);
      return raycaster.intersectObjects(targets, true);
    },
    project(x, y, z) {
      v3.set(x, y, z).project(shown().camera);
      const r = canvas.getBoundingClientRect();
      return {
        x: r.left + ((v3.x + 1) / 2) * r.width,
        y: r.top + ((1 - v3.y) / 2) * r.height,
        depth: v3.z,
        visible: v3.z < 1 && Math.abs(v3.x) < 1.2 && Math.abs(v3.y) < 1.2,
      };
    },
    closeness: () => normal.distance / Math.max(0.001, camera.position.distanceTo(controls.target)),
    cityCamera: camera,
    onFrame(cb) {
      frameCallbacks.push(cb);
    },
    dispose() {
      frameCallbacks.length = 0;
      disposed = true;
      cancelAnimationFrame(frame);
      removeEventListener("resize", layout);
      controls.dispose();
      sea.controls.dispose();
      for (const sc of [scene, sea.scene]) {
        sc.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.geometry.dispose();
          (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => mat.dispose());
        });
        (sc.background as THREE.Texture | null)?.dispose();
      }
      renderer.dispose();
    },
  };
  layout();
  frame = requestAnimationFrame(loop);
  return handle;
}
