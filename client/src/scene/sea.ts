import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PORTRAIT_ASPECT } from "./camera.js";
import { skyTexture } from "./sky.js";
import { createWater, type Water } from "./water.js";

/** How far the sea camera can pan from the center of the map (prototype). */
export const SEA_PAN_LIMIT = 34;

export type SeaView = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  water: Water;
  /** First framing over your city; later resizes keep where you looked. */
  layout(aspect: number, home: { x: number; z: number }): void;
};

/** The sea scene of the prototype: wide water, its own sky and lights, a camera that pans and zooms but never turns. */
export function createSeaView(dom: HTMLElement): SeaView {
  const scene = new THREE.Scene();
  scene.background = skyTexture("#4FA6E3", "#9ED5F5", "#DDF1FF");
  scene.fog = new THREE.Fog("#BFE3F8", 55, 120);
  scene.add(new THREE.HemisphereLight("#EAF6FF", "#3A6B8A", 1.1));
  const sun = new THREE.DirectionalLight("#FFF1D6", 2.3);
  sun.position.set(-20, 30, 12);
  scene.add(sun);
  const water = createWater(400, "#2287CC");
  scene.add(water.mesh);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  controls.enableRotate = false;
  controls.screenSpacePanning = false;
  controls.minDistance = 18;
  controls.maxDistance = 80;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.addEventListener("change", () => {
    const t = controls.target;
    const dx = Math.min(SEA_PAN_LIMIT, Math.max(-SEA_PAN_LIMIT, t.x)) - t.x;
    const dz = Math.min(SEA_PAN_LIMIT, Math.max(-SEA_PAN_LIMIT, t.z)) - t.z;
    t.x += dx;
    t.z += dz;
    camera.position.x += dx;
    camera.position.z += dz;
    t.y = 0;
  });

  let framed = false;
  return {
    scene,
    camera,
    controls,
    water,
    layout(aspect, home) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      if (framed) return;
      framed = true;
      const h = aspect < PORTRAIT_ASPECT ? 54 : 40;
      controls.target.set(home.x + 6, 0, home.z - 6);
      camera.position.set(home.x + 6, h, home.z - 6 + h * 0.42);
      controls.update();
    },
  };
}
