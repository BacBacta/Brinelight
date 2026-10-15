import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createCamera, createControls, frameCity } from "./camera.js";
import { createIsland, type Kit } from "./island.js";
import { createLighthouse, lighthouseScale } from "./lighthouse.js";
import { addCityLights } from "./lights.js";
import { applyQualityStep, createQualityMonitor } from "./quality.js";
import { createRenderer } from "./renderer.js";
import { addCitySky } from "./sky.js";
import { createWater } from "./water.js";

export type { Kit } from "./island.js";
export { hexX, hexZ, kitModel } from "./island.js";
export { lighthouseScale } from "./lighthouse.js";

export type ScreenPoint = { x: number; y: number; visible: boolean };

export type SceneHandle = {
  /** Moves the camera back and resizes the Lighthouse for this level. */
  setLighthouseLevel(level: number): void;
  /** Adds an object to the city. */
  add(object: THREE.Object3D): void;
  /** Objects under a screen point (client pixels), nearest first. */
  pick(clientX: number, clientY: number, targets: THREE.Object3D[]): THREE.Intersection[];
  /** Screen position (CSS pixels) of a point of the city. */
  project(x: number, y: number, z: number): ScreenPoint;
  /** Called on every drawn frame, before rendering, with the scene clock in seconds. */
  onFrame(cb: (now: number) => void): void;
  /** Stops the loop and removes the listeners. */
  dispose(): void;
};

export type SceneOptions = {
  /** Called once phare.glb is loaded, with its models. */
  onLoaded?: (kit: Kit) => void;
  onError?: (err: unknown) => void;
};

const KIT_URL = `${import.meta.env.BASE_URL}prototype/assets/phare.glb`;

/** The city scene of the prototype, without buildings: island, sea, sky and Lighthouse. */
export function startScene(canvas: HTMLCanvasElement, options: SceneOptions = {}): SceneHandle {
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  addCitySky(scene);
  const { sun } = addCityLights(scene);
  const water = createWater(160, "#2A9AD8");
  scene.add(water.mesh);
  const lighthouse = createLighthouse();
  scene.add(lighthouse.group);

  const camera = createCamera();
  const controls = createControls(camera, canvas);
  // Set by setLighthouseLevel before the first frame is drawn.
  let level = 0;

  const layout = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    frameCity(camera, controls, innerWidth / innerHeight, level);
  };
  addEventListener("resize", layout);

  let disposed = false;
  new GLTFLoader().load(
    KIT_URL,
    (gltf) => {
      if (disposed) return;
      const kit: Kit = {};
      gltf.scenes.forEach((sc) => (kit[sc.name] = sc));
      scene.add(createIsland(kit));
      options.onLoaded?.(kit);
    },
    undefined,
    (err) => {
      console.error(err);
      if (!disposed) options.onError?.(err);
    },
  );

  const frameCallbacks: ((now: number) => void)[] = [];
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const v3 = new THREE.Vector3();

  const quality = createQualityMonitor();
  const clock = new THREE.Clock();
  let frame = 0;
  const loop = () => {
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.1, clock.getDelta());
    const now = clock.elapsedTime;
    const step = quality.tick(dt);
    if (step !== null) {
      applyQualityStep(renderer, sun, step);
      layout();
    }
    water.setTime(now);
    lighthouse.animate(now);
    controls.update();
    for (const cb of frameCallbacks) cb(now);
    renderer.render(scene, camera);
  };

  const handle: SceneHandle = {
    setLighthouseLevel(l) {
      level = l;
      lighthouse.group.scale.setScalar(lighthouseScale(l));
      layout();
    },
    add(object) {
      scene.add(object);
    },
    pick(clientX, clientY, targets) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObjects(targets, true);
    },
    project(x, y, z) {
      v3.set(x, y, z).project(camera);
      const r = canvas.getBoundingClientRect();
      return {
        x: r.left + ((v3.x + 1) / 2) * r.width,
        y: r.top + ((1 - v3.y) / 2) * r.height,
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
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => mat.dispose());
      });
      (scene.background as THREE.Texture | null)?.dispose();
      renderer.dispose();
    },
  };
  layout();
  frame = requestAnimationFrame(loop);
  return handle;
}
