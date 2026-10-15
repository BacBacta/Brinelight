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

export type SceneHandle = {
  /** Moves the camera back and resizes the Lighthouse for this level. */
  setLighthouseLevel(level: number): void;
  /** Stops the loop and removes the listeners. */
  dispose(): void;
};

export type SceneOptions = {
  onLoaded?: () => void;
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
      options.onLoaded?.();
    },
    undefined,
    (err) => {
      console.error(err);
      if (!disposed) options.onError?.(err);
    },
  );

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
    renderer.render(scene, camera);
  };

  const handle: SceneHandle = {
    setLighthouseLevel(l) {
      level = l;
      lighthouse.group.scale.setScalar(lighthouseScale(l));
      layout();
    },
    dispose() {
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
