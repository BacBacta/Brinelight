import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PORTRAIT_ASPECT } from "./camera.js";
import { createSky } from "./sky.js";
import { SEA_CALM, SEA_WATER, addLook, type LookParts } from "./look.js";
import { createWater, type Water } from "./water.js";

/** How far the sea camera can pan from the center of the map (prototype). */
export const SEA_PAN_LIMIT = 34;

export type SeaView = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  water: Water;
  /** Its sky, fog and lights (the Mist's mood changes them). */
  look: LookParts;
  /** First framing over your city; later resizes keep where you looked. */
  layout(aspect: number, home: { x: number; z: number }): void;
};

/** The sea scene of the prototype: wide water, its own sky and lights, a camera that pans and zooms but never turns. */
export function createSeaView(dom: HTMLElement): SeaView {
  const scene = new THREE.Scene();
  const look = addLook(scene, createSky(SEA_CALM.sky), SEA_CALM, false);
  const water = createWater(SEA_WATER);
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
    look,
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
