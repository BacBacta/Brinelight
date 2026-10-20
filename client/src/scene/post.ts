/**
 * The city's finish at full quality only (style pass, after meeting 4, with ?blender): a soft bloom around what glows
 * (the lamps, the lanterns, the Lighthouse's light) and a color grade (golden lights, slightly blue shadows, A's
 * contrast). three.js's own example modules, no dependency. At quality steps 1 and 2 the city is drawn without it.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";

/** Only the lit lamps, brighter than white (village.ts, details.ts), glow: never the sunlit walls, the foam or the sea. */
export const BLOOM = { strength: 0.2, radius: 0.35, threshold: 2.2 } as const;

/** The grade, on the screen's colors: contrast, saturation, and the tint of the lights and of the shadows. */
export const GRADE = { contrast: 1.07, saturation: 1.08, lights: [0.035, 0.012, -0.03], shadows: [-0.012, 0.0, 0.03] } as const;

/** The grade, applied after the tone mapping and the screen's color space, in the same full-screen pass (OutputPass). */
const GRADE_GLSL = /* glsl */ `
{
  vec3 c = gl_FragColor.rgb;
  float l = dot(c, vec3(.2126, .7152, .0722));
  c = mix(vec3(l), c, uSaturation);
  c = (c - .5) * uContrast + .5;
  c += uLights * smoothstep(.35, 1., l) + uShadows * (1. - smoothstep(0., .5, l));
  gl_FragColor.rgb = clamp(c, 0., 1.);
}`;

/** three.js's OutputPass (tone mapping, the screen's colors) with the grade at its end: one full-screen pass for both. */
export function gradedOutput(): OutputPass {
  const output = new OutputPass();
  Object.assign(output.uniforms, {
    uContrast: { value: GRADE.contrast },
    uSaturation: { value: GRADE.saturation },
    uLights: { value: new THREE.Vector3(...GRADE.lights) },
    uShadows: { value: new THREE.Vector3(...GRADE.shadows) },
  });
  output.material.fragmentShader = output.material.fragmentShader
    .replace("uniform sampler2D tDiffuse;", "uniform sampler2D tDiffuse;\nuniform float uContrast, uSaturation;\nuniform vec3 uLights, uShadows;")
    .replace(/(#ifdef SRGB_TRANSFER[\s\S]*?#endif)/, `$1\n${GRADE_GLSL}`);
  return output;
}

/**
 * Notes the draw calls and triangles of the scene itself (the shadow pass left out, as the game's counter does), then
 * counts the finish's own passes from there.
 */
class CountPass extends Pass {
  calls = 0;
  triangles = 0;
  constructor() {
    super();
    this.needsSwap = false;
  }
  override render(renderer: THREE.WebGLRenderer) {
    this.calls = renderer.info.render.calls;
    this.triangles = renderer.info.render.triangles;
    renderer.info.reset();
    renderer.info.autoReset = false;
  }
}

export type Post = {
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  /** The scene's own draw calls and triangles at the last frame, without the finish's passes. */
  readonly scene: { calls: number; triangles: number };
  /** The finish's passes' draw calls at the last frame. */
  readonly passes: number;
};

export function createPost(renderer: THREE.WebGLRenderer): Post {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  // Half floats keep the lights over 1 for the bloom; 4 samples keep the edges as smooth as without the finish.
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const scenePass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const count = new CountPass();
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  // The glow is soft: drawn at half the screen's size (a quarter of its pixels), it costs a quarter as much.
  const bloomSize = bloom.setSize.bind(bloom);
  bloom.setSize = (width: number, height: number) => bloomSize(Math.round(width / 2), Math.round(height / 2));
  composer.addPass(scenePass);
  composer.addPass(count);
  composer.addPass(bloom);
  composer.addPass(gradedOutput());
  let passes = 0;
  return {
    render(scene, camera) {
      scenePass.scene = scene;
      scenePass.camera = camera;
      composer.render();
      passes = renderer.info.render.calls;
      renderer.info.autoReset = true;
    },
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    get scene() {
      return { calls: count.calls, triangles: count.triangles };
    },
    get passes() {
      return passes;
    },
  };
}
