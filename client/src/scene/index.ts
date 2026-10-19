import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadBuildings, tierOf, type BuildingModels } from "./buildings.js";
import { ISLAND_ANISOTROPY, filterTexture, fitIsland, loadModels, loadRaftBuildings, type Models, type RaftBuildingModels } from "./models.js";
import { createCamera, createControls, frameCity } from "./camera.js";
import { shapeCoast } from "./coast.js";
import { cityFraming } from "./framing.js";
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
  /** Shows the city or the sea; only the shown view moves with your fingers. */
  setView(view: View): void;
  readonly view: View;
  /** Adds an object to the city (default) or to the sea. */
  add(object: THREE.Object3D, view?: View): void;
  /** Objects under a screen point (client pixels) in the shown view, nearest first. */
  pick(clientX: number, clientY: number, targets: THREE.Object3D[]): THREE.Intersection[];
  /** Screen position (CSS pixels) of a point of the shown view. */
  project(x: number, y: number, z: number): ScreenPoint;
  /** Called on every drawn frame, before rendering, with the scene clock in seconds and the shown view. */
  onFrame(cb: (now: number, view: View) => void): void;
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
  /** Called once phare.glb, the nine buildings and the other models are loaded. */
  onLoaded?: (kit: Kit, buildings: BuildingModels, models: Models) => void;
  /** The buildings on rafts, loaded after the city shows. */
  onRaftBuildings?: (models: RaftBuildingModels) => void;
  onError?: (err: unknown) => void;
  /** The band of the screen the city's normal view must fit in, in CSS pixels: below the top panels, above the bottom ones. */
  band?: () => { top: number; bottom: number };
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
  const water = createWater(CITY_WATER);
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
  const layout = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    const band = options.band?.() ?? { top: 0, bottom: innerHeight };
    const framing = cityFraming({ width: innerWidth, height: innerHeight, ...band }, moored);
    frameCity(camera, controls, innerWidth / innerHeight, framing);
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
  Promise.all([loader.loadAsync(KIT_URL), loadBuildings(loader), loadModels(loader)]).then(
    ([gltf, buildings, models]) => {
      if (disposed) return;
      const kit: Kit = {};
      gltf.scenes.forEach((sc) => (kit[sc.name] = sc));
      filterTexture(models.island, Math.min(ISLAND_ANISOTROPY, renderer.capabilities.getMaxAnisotropy()));
      const island = fitIsland(models.island);
      shapeCoast(island);
      scene.add(createIsland(island));
      shore = createShore(island);
      water.setShore(shore.distances(moored));
      lighthouse.useModel(buildings.lighthouse);
      sizeLighthouse();
      options.onLoaded?.(kit, buildings, models);
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
  function sizeLighthouse(): void {
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
