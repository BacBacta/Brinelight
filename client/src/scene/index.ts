import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { tierOf } from "./buildings.js";
import { ISLAND_ANISOTROPY, filterTexture, loadModels, type Models } from "./models.js";
import { createCamera, createControls, frameCity } from "./camera.js";
import { CITY_MANIFEST, SEA_RISE, cityModelUrl, gridIsland } from "./cityLook.js";
import { CITY_ANGLE, CITY_FILL, buildingPoints, cityFraming, clearView, type Volume } from "./framing.js";
import type { Kit } from "./island.js";
import { createLighthouse, lighthouseScale } from "./lighthouse.js";
import { QUALITY_STEPS, applyQualityStep, createQualityMonitor, type QualityStep } from "./quality.js";
import { createPost, type Post } from "./post.js";
import { createRenderer } from "./renderer.js";
import { createSky } from "./sky.js";
import { CITY_MIST, CITY_STYLE, STYLE_EXPOSURE, CITY_WATER_STYLE, SEA_CALM, SEA_MIST, addLook, applyLook, mixLook, type SeaMood } from "./look.js";
import { createVeil } from "./veil.js";
import { createSeaView } from "./sea.js";
import { createWater } from "./water.js";
import { SHORE, landOf, shoreDistances, type Disc } from "./shore.js";
import { shoreJob } from "../city/land/jobs.js";
import { terrainCoast } from "./terrainCoast.js";

export type { Kit } from "./island.js";
export { normalizeBuilding, type BuildingModel } from "./buildings.js";
export { RAFT_BUILDING_IDS, bakeModel, modelUrl, type Models } from "./models.js";
export { hexGeometry, hexX, hexZ, kitModel } from "./island.js";
export { createLighthouse, lighthouseScale } from "./lighthouse.js";
export { WAVE_HEIGHT } from "./water.js";

export type View = "city" | "sea";
export type { QualityStep } from "./quality.js";
export type { Disc } from "./shore.js";
export type { SeaMood } from "./look.js";
export { forcedQuality } from "./quality.js";

/** What the ?fps counter shows about rendering. */
export type RenderStats = {
  step: QualityStep;
  forced: boolean;
  mood: SeaMood;
  calls: number;
  triangles: number;
  /** The draw calls of the full quality's finish (post.ts), when it drew the last frame. */
  post?: number;
  /** When the city's first image was drawn, in ms from the page's start (its navigation), or null before. */
  firstImage: number | null;
};

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
  /** The sea's models, fetched at your first visit at sea: the prototype's kit, the wreck, the camp and your boat. */
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
  /** The island after the style pass in another look (the Lighthouse crossed into it): fetched, then it replaces the one shown. */
  useTerrain(name: string): void;
  /** How far the light has fallen: 0 in the calm's late afternoon, 1 in the Mist (as its look fades). */
  dimness(): number;
  /**
   * The sea's mood, calm or the Mist (its look only): the light, the fog, the water, the veil and the Lighthouses' beams
   * fade to it in 1.5 s, or at once (`now`, or with reduced motion on the device).
   */
  setMood(mood: SeaMood, now?: boolean): void;
  /** How much the Lighthouses' beams show, 0 to 1 (the sea map's Lighthouses follow it). */
  readonly beams: number;
  /** The buildings' room at their levels: each one's top and foot stays in the normal view's band. */
  setBuildings(volumes: readonly Volume[]): void;
  /**
   * The band or the buildings changed (a card came or went, a building grew): the normal view follows, gliding there if
   * the camera was on it.
   */
  reframe(): void;
  /** The rafts moored around the island (and the shipyard at work): the foam goes around them, and the normal view keeps them on screen. */
  setMoored(discs: readonly Disc[]): void;
  /**
   * The land won on the sea (city/land, from the Lighthouse 5): its ground takes the island's place (the
   * island's own model hidden) and the shore's foam is measured from it; null gives the island back. `edge`: points of
   * its outline the normal view keeps on screen; `grid`: where it stands above the water (measured with it, else here).
   */
  useLand(ground: THREE.Object3D | null, edge?: readonly { x: number; z: number }[], grid?: Uint8Array | null): void;
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
  /** Called once the island and what `ready` waits for are there: the city's first image follows. */
  onLoaded?: () => void;
  /**
   * The models the city's first image waits for (its buildings' current era, its rafts or its land): they are there from
   * the first image. The sea's models (the prototype's kit, 2.9 MB, the wreck, the camp, your boat) wait for your first
   * visit at sea: `loadSea` fetches them.
   */
  ready?: Promise<unknown>;
  /**
   * The island after the style pass (assets/blender/terrain.py), in the Lighthouse's look: one continuous land, its
   * ground painted on it, no plot outlines.
   */
  terrain: string;
  onError?: (err: unknown) => void;
  /** The band of the screen the city's close view must fit in, in CSS pixels: below the top panels, above the bottom ones. */
  band?: () => { top: number; bottom: number };
  /** The normal view's band, if it is narrower (below the cards at the top too, above the quest card). */
  cityBand?: () => { top: number; bottom: number };
  /** The top of the sheet open at the bottom of the screen, if one is (CSS pixels): the close view stays above it. */
  sheetTop?: () => number | null;
};

const KIT_URL = `${import.meta.env.BASE_URL}prototype/assets/phare.glb`;

/** The two views of the prototype: the city (island, Lighthouse) and the sea map. */
export function startScene(canvas: HTMLCanvasElement, options: SceneOptions): SceneHandle {
  const renderer = createRenderer(canvas);
  // The city's finish at full quality only (post.ts): made the first time it is drawn, a few seconds after
  // the city's first image, once the island's life has come (its passes would slow those first frames down).
  let post: Post | null = null;
  let posted = false;
  let shownAt: number | null = null;
  let firstImage: number | null = null;
  let cityDrawn = false;
  const FINISH_AFTER = 4;
  /** The finish fades in over this many seconds: it never pops in. */
  const FINISH_FADE = 1;
  /**
   * Until the city's first image, the sea behind "Loading your city…" is drawn twice a second at most:
   * drawn at every frame at full quality, it slowed the models' loading down by seconds (week 8, the first image).
   */
  const LOADING_FRAME = 0.5;
  let loadingDrawn = -Infinity;

  const scene = new THREE.Scene();
  // The city's light after the style pass (look.ts), a little brighter (owner, on the S22).
  const calm = CITY_STYLE;
  renderer.toneMappingExposure = STYLE_EXPOSURE;
  const look = addLook(scene, createSky(calm.sky), calm, true);
  const { sun } = look;
  const veil = createVeil();
  scene.add(veil.mesh);
  // The city's water has 64 subdivisions at most (meeting 4: room for the island's life).
  const water = createWater({ ...CITY_WATER_STYLE, maxSegments: 64, lapping: true, y: SHORE.waterY + SEA_RISE });
  scene.add(water.mesh);
  water.useRenderer(renderer);
  // The foam goes along the island's shore and around the rafts moored there (setMoored). Its distances are measured
  // away from the display (city/land's worker; the first ones here, before the first image), only when they change.
  let shoreGrid: Uint8Array | null = null;
  let landGrid: Uint8Array | null = null;
  let gridNew = false;
  let shoreSent = "";
  let shoreAsk = 0;
  let shoreShown = false;
  const discsKey = (discs: readonly Disc[]) => discs.map((d) => `${d.x.toFixed(2)},${d.z.toFixed(2)},${d.r}${d.still ? "s" : ""}`).join(";");
  const measureShore = () => {
    if (!shoreGrid) return;
    const k = discsKey(moored);
    if (!gridNew && k === shoreSent) return;
    shoreSent = k;
    const grid = gridNew ? shoreGrid.slice() : null;
    gridNew = false;
    if (!shoreShown) {
      shoreShown = true;
      water.setShore(shoreDistances(shoreGrid, moored));
    }
    const id = ++shoreAsk;
    void shoreJob({ kind: "shore", grid, discs: moored.map((d) => ({ ...d })) }).then((d) => {
      if (id === shoreAsk) water.setShore(d.distances);
    });
  };
  const setShoreGrid = (grid: Uint8Array) => {
    shoreGrid = grid;
    gridNew = true;
    measureShore();
  };
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
  // The buildings' room: each one's top and foot stays in the normal view's band.
  let volumes: readonly Volume[] = [];
  let framedBand = { top: 0, bottom: 0 };
  let stale = false;
  const cityFramingNow = () => {
    const band = (options.cityBand ?? options.band)?.() ?? { top: 0, bottom: innerHeight };
    framedBand = band;
    // The Lighthouse made in Blender is taller: its top stays on screen too.
    const tops = [...(lighthouseStaged ? [{ x: 0, y: lighthouseTop, z: 0 }] : []), ...volumes.flatMap(buildingPoints), ...landEdge.map((p) => ({ x: p.x, y: 0, z: p.z }))];
    // The city spans three quarters of the screen's width (owner, after the style pass).
    return cityFraming({ width: innerWidth, height: innerHeight, ...band }, moored, tops, { share: CITY_FILL, coast: terrainCoast });
  };
  const layout = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    post?.setSize(innerWidth, innerHeight, renderer.getPixelRatio());
    const framing = cityFramingNow();
    normal = framing;
    stale = false;
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
    const city = mixLook(calm, CITY_MIST, t);
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
  // One loader: the island in the Lighthouse's look and the models the first image waits for (`ready`); the sea's own
  // models wait for your first visit at sea.
  const loader = new GLTFLoader();
  let terrainShown = CITY_MANIFEST[options.terrain] ? options.terrain : null;
  let land: THREE.Object3D | null = null;
  // The land won on the sea, when it shows: its ground, and the edge the framing keeps on screen.
  let wonLand: THREE.Object3D | null = null;
  let landEdge: readonly { x: number; z: number }[] = [];
  let cityLoaded = () => {};
  const cityDone = new Promise<void>((resolve) => (cityLoaded = resolve));
  let seaModels: Promise<{ kit: Kit; models: Models }> | null = null;
  const kitOf = (gltf: { scenes: THREE.Group[] }): Kit => {
    const kit: Kit = {};
    gltf.scenes.forEach((sc) => (kit[sc.name] = sc));
    return kit;
  };
  Promise.all([terrainShown ? loader.loadAsync(cityModelUrl(terrainShown)) : null, options.ready]).then(
    ([gridModel]) => {
      if (disposed) return;
      cityLoaded();
      if (gridModel) {
        const anisotropy = Math.min(ISLAND_ANISOTROPY, renderer.capabilities.getMaxAnisotropy());
        filterTexture(gridModel.scene, anisotropy);
        // The terrain's relief has its shade baked (terrain.py): it only receives the buildings' shadows.
        land = gridIsland(gridModel.scene, false);
        scene.add(land);
        setShoreGrid(landOf(land, SHORE.waterY + SEA_RISE));
      }
      sizeLighthouse();
      renderer.setPixelRatio(Math.min(QUALITY_STEPS[step].maxPixelRatio, devicePixelRatio || 1));
      layout();
      options.onLoaded?.();
      shownAt = clock.elapsedTime;
    },
    (err: unknown) => {
      console.error(err);
      if (!disposed) options.onError?.(err);
    },
  );

  /** Its tier's lantern, and its level's size until its stage's model (which has its own size) is there. */
  let lighthouseStaged = false;
  let lighthouseTop = 0;
  function sizeLighthouse(): void {
    lighthouse.setTier(tierOf(level));
    lighthouse.group.scale.setScalar(lighthouseStaged ? 1 : lighthouseScale(level));
  }
  /**
   * The city's camera, as the screen shows it: its projection times its view, on the canvas (data-view), written only
   * when it moves. The end-to-end tests tap where the game draws, never where a copy of its framing would.
   */
  let toldView = "";
  const viewMatrix = new THREE.Matrix4();
  const tellView = (cam: THREE.Camera) => {
    cam.updateMatrixWorld();
    const told = viewMatrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).elements.map((x) => +x.toFixed(5)).join(",");
    if (told === toldView) return;
    toldView = told;
    canvas.dataset.view = told;
  };
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
    // The city's first image is on screen once the frame after it starts (its drawing done, on a slow graphics chip too).
    if (cityDrawn && firstImage === null) firstImage = performance.now();
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
      if (t >= 1) {
        glide = null;
        // Zooming out stops at the normal view again, once the camera is back there.
        if (!focused) controls.maxDistance = Math.max(40, normal.distance);
      }
    }
    v.controls.update();
    if (view === "city" && shownAt !== null) tellView(v.camera);
    for (const cb of frameCallbacks) cb(now, view);
    if (shownAt === null) {
      if (now - loadingDrawn < LOADING_FRAME) return;
      loadingDrawn = now;
      // Under "Loading your city…", at one pixel per CSS pixel too; the city's first image has its step's pixels.
      if (renderer.getPixelRatio() !== 1) {
        renderer.setPixelRatio(1);
        layout();
      }
    }
    posted = QUALITY_STEPS[step].finish && view === "city" && shownAt !== null && now - shownAt > FINISH_AFTER;
    if (posted) {
      if (!post) {
        post = createPost(renderer);
        post.setSize(innerWidth, innerHeight, renderer.getPixelRatio());
      }
      post.setStrength(Math.min(1, (now - shownAt! - FINISH_AFTER) / FINISH_FADE));
      post.render(v.scene, v.camera);
    } else renderer.render(v.scene, v.camera);
    // The city's first image: the first frame drawn once it is loaded (performance.now counts from the page's start).
    if (shownAt !== null && view === "city") cityDrawn = true;
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
      seaModels ??= Promise.all([loader.loadAsync(KIT_URL), loadModels(loader), cityDone]).then(([gltf, models]) => ({ kit: kitOf(gltf), models }));
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
    setBuildings(next) {
      const same = next.length === volumes.length && next.every((v, i) => v.x === volumes[i]!.x && v.z === volumes[i]!.z && v.height === volumes[i]!.height && v.reach === volumes[i]!.reach);
      if (same) return;
      volumes = next;
      stale = true;
    },
    reframe() {
      const band = (options.cityBand ?? options.band)?.() ?? { top: 0, bottom: innerHeight };
      if (!stale && Math.abs(band.top - framedBand.top) <= 1 && Math.abs(band.bottom - framedBand.bottom) <= 1) return;
      stale = false;
      const before = normal;
      const atNormal = camera.position.distanceTo(before.target.clone().addScaledVector(CITY_ANGLE, before.distance)) < 0.05 && controls.target.distanceTo(before.target) < 0.05;
      normal = cityFramingNow();
      fogScale = Math.max(1, normal.distance / FOG_SET_AT);
      showMood(moodAt);
      if (focused) return;
      // Before the city's first image, at once; then it glides there, unless you had moved the camera.
      if (shownAt === null) frameCity(camera, controls, innerWidth / innerHeight, normal);
      else if (atNormal) {
        controls.maxDistance = Math.max(40, normal.distance, before.distance);
        glideTo(normal.target.clone().addScaledVector(CITY_ANGLE, normal.distance), normal.target.clone());
      } else controls.maxDistance = Math.max(40, normal.distance);
    },
    useLand(ground, edge = [], grid = null) {
      wonLand = ground;
      if (land) land.visible = !ground;
      const nextEdge = ground ? edge : [];
      const edgeChanged = nextEdge.length !== landEdge.length || nextEdge.some((p, i) => p.x !== landEdge[i]!.x || p.z !== landEdge[i]!.z);
      landEdge = nextEdge;
      landGrid = ground ? grid : null;
      const from = ground ?? land;
      if (from) setShoreGrid(landGrid ?? landOf(from, SHORE.waterY + SEA_RISE));
      if (edgeChanged) layout();
    },
    setMoored(discs) {
      const changed = discs.length !== moored.length || discs.some((d, i) => d.x !== moored[i]!.x || d.z !== moored[i]!.z);
      moored = discs;
      measureShore();
      if (changed) layout();
    },
    stats() {
      if (posted && post) return { step, forced: forced !== null, mood, ...post.scene, post: post.passes, firstImage };
      return { step, forced: forced !== null, mood, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, firstImage };
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
    dimness: () => moodAt,
    useTerrain(name) {
      if (name === terrainShown || !CITY_MANIFEST[name]) return;
      terrainShown = name;
      void loader.loadAsync(cityModelUrl(name)).then((g) => {
        if (terrainShown !== name || disposed) return;
        filterTexture(g.scene, Math.min(ISLAND_ANISOTROPY, renderer.capabilities.getMaxAnisotropy()));
        const next = gridIsland(g.scene, false);
        if (land) scene.remove(land);
        land = next;
        scene.add(next);
        next.visible = !wonLand;
        setShoreGrid(wonLand ? (landGrid ?? landOf(wonLand, SHORE.waterY + SEA_RISE)) : landOf(next, SHORE.waterY + SEA_RISE));
      });
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
