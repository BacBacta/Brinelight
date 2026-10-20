/**
 * The water (docs/art-direction.md, Sea; week 6, task 4): a wide plane of slow, small waves, turquoise near the island and
 * navy far away, that reflects the sky, with finer ripples drawn pixel by pixel and foam along the shore and around the
 * rafts. All of it in the shader of a MeshStandardMaterial (onBeforeCompile): no texture file, no extra draw call.
 */
import * as THREE from "three";
import { SHORE } from "./shore.js";
import type { QUALITY_STEPS } from "./quality.js";

export type WaterOptions = {
  size: number;
  /** The water's color near the center and far from it, and where one turns into the other. */
  near: string;
  far: string;
  radii: readonly [number, number];
  /** The sky it reflects: top, middle, horizon (as the scene's sky). */
  sky: readonly [string, string, string];
  /** The most subdivisions of its grid, whatever the quality step (the city's water with ?blender, week 8, meeting 4). */
  maxSegments?: number;
  /**
   * The shallows' colors along the shore and around the rafts (the city's water with ?blender, the style pass): at the
   * shore, and a meter out; past two meters, the water's own.
   */
  shallows?: readonly [shore: string, out: string];
  /** Where the water rests (the city's sea with ?blender stands higher: cityLook.ts, SEA_RISE). */
  y?: number;
  /** A ripple that laps against the shore and the rafts, coming and going (the city's water with ?blender, meeting 4). */
  lapping?: boolean;
};

export type Water = {
  mesh: THREE.Mesh;
  setTime(seconds: number): void;
  /** What a quality step keeps of the water. */
  setQuality(step: (typeof QUALITY_STEPS)[keyof typeof QUALITY_STEPS]): void;
  /** The shore's distances (shore.ts), or null: no foam. */
  setShore(distances: Uint8Array | null): void;
  /** Builds the sky's reflection once a renderer is there (PMREM). */
  useRenderer(renderer: THREE.WebGLRenderer): void;
  /** How leaden the water is (the Mist's mood), 0 to 1, and the horizon it shows without its reflection. */
  setLead(amount: number, horizon: string): void;
};

/** The big, slow waves: the height of the water at (x, y) of the plane at time t, and its slopes (vertex shader). */
const WAVES = /* glsl */ `
float waveAt(vec2 p, float t) {
  return sin(p.x * .5 + t * 1.2) * .025 + cos(p.y * .4 + t * .9) * .025 + sin((p.x + p.y) * .9 + t * 2.) * .01;
}
vec2 waveSlope(vec2 p, float t) {
  float d = cos((p.x + p.y) * .9 + t * 2.) * .009;
  return vec2(cos(p.x * .5 + t * 1.2) * .0125 + d, -sin(p.y * .4 + t * .9) * .01 + d);
}
`;

/** How high the waves reach above and below the water's rest level (the sum of their amplitudes). */
export const WAVE_HEIGHT = 0.06;

export function createWater(opts: WaterOptions): Water {
  const uniforms = {
    uT: { value: 0 },
    uNear: { value: new THREE.Color(opts.near) },
    uFar: { value: new THREE.Color(opts.far) },
    uRadii: { value: new THREE.Vector2(...opts.radii) },
    uRipples: { value: 1 },
    uSkyTint: { value: new THREE.Color(opts.sky[2]) },
    uShore: { value: null as THREE.DataTexture | null },
    uShoreBox: { value: new THREE.Vector3(-SHORE.extent, -SHORE.extent, 2 * SHORE.extent) },
    uFoam: { value: 0 },
    uFoamMoves: { value: 1 },
    uLap: { value: opts.lapping ? 1 : 0 },
    uFoamColor: { value: new THREE.Color("#FFF6E6").multiplyScalar(1.05) },
    uLead: { value: 0 },
    uLeadColor: { value: new THREE.Color("#6A7382") },
    uShallows: { value: opts.shallows ? 1 : 0 },
    uShallow: { value: new THREE.Color(opts.shallows?.[0] ?? opts.near) },
    uShallowOut: { value: new THREE.Color(opts.shallows?.[1] ?? opts.near) },
  };
  const ENV = 0.55;
  const material = new THREE.MeshStandardMaterial({ color: opts.far, roughness: 0.12, metalness: 0.05, envMapIntensity: ENV });
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader =
      "uniform float uT;\nvarying vec3 vWPos;\n" +
      WAVES +
      sh.vertexShader
        .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.z += waveAt(position.xy, uT);")
        .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nobjectNormal = normalize(vec3(-waveSlope(position.xy, uT), 1.));")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.)).xyz;");
    sh.fragmentShader =
      [
        "uniform float uT, uRipples, uFoam, uFoamMoves, uLead, uLap, uShallows;",
        "uniform vec3 uNear, uFar, uSkyTint, uFoamColor, uShoreBox, uLeadColor, uShallow, uShallowOut;",
        "uniform vec2 uRadii;",
        "uniform sampler2D uShore;",
        "varying vec3 vWPos;",
        `const float SHORE_REACH = ${SHORE.reach.toFixed(1)};`,
      ].join("\n") +
      "\n" +
      sh.fragmentShader
        // Turquoise near the center, navy far away; with shallows, light turquoise along the shore and the rafts, a
        // little darker right against them (their shade on the water).
        .replace(
          "vec4 diffuseColor = vec4( diffuse, opacity );",
          `vec3 water = mix(uNear, uFar, smoothstep(uRadii.x, uRadii.y, length(vWPos.xz)));
if (uShallows > 0. && uFoam > 0.) {
  vec2 suv = (vWPos.xz - uShoreBox.xy) / uShoreBox.z;
  float sd = (suv.x > 0. && suv.y > 0. && suv.x < 1. && suv.y < 1.) ? texture2D(uShore, suv).r * SHORE_REACH : SHORE_REACH;
  vec3 shallow = mix(uShallow, uShallowOut, smoothstep(0.05, 1., sd));
  water = mix(shallow, water, smoothstep(.6, SHORE_REACH, sd));
  water *= 1. - .22 * (1. - smoothstep(0., .14, sd));
}
vec4 diffuseColor = vec4( mix(water, uLeadColor, uLead * .75), opacity );`,
        )
        // Small ripples: a few crossing sines tilt the normal, pixel by pixel.
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
if (uRipples > 0.) {
  vec2 p = vWPos.xz;
  float a = cos(p.x * 2.1 + p.y * 1.3 + uT * 1.7), b = cos(-p.x * 1.4 + p.y * 2.6 + uT * 2.3), c = cos(p.x * 3.7 - p.y * .9 - uT * 1.1);
  vec2 g = vec2(a * 2.1 - b * 1.4 + c * 1.85, a * 1.3 + b * 2.6 - c * .45) * .014 * uRipples;
  normal = normalize(normal + (viewMatrix * vec4(-g.x, 0., -g.y, 0.)).xyz);
}`,
        )
        // Without the sky's reflection (lowest quality step): a little of the horizon's color at grazing angles.
        // Then the foam, along the shore and around the rafts.
        .replace(
          "#include <opaque_fragment>",
          `#ifndef USE_ENVMAP
float fres = pow(1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), 4.);
outgoingLight = mix(outgoingLight, uSkyTint, fres * .45);
#endif
if (uFoam > 0.) {
  vec2 uv = (vWPos.xz - uShoreBox.xy) / uShoreBox.z;
  if (uv.x > 0. && uv.y > 0. && uv.x < 1. && uv.y < 1.) {
    float d = texture2D(uShore, uv).r * SHORE_REACH;
    float t = uT * uFoamMoves;
    float swell = .5 + .5 * sin(d * 9. - t * 2.2);
    float grain = sin(vWPos.x * 7.3 + sin(vWPos.z * 5.1)) * sin(vWPos.z * 6.7 + sin(vWPos.x * 4.3 + t * .4));
    // With the shallows (?blender), a thinner foam: the coast and the rafts never bathe in a pale glow (owner).
    float reach = mix(.28 + .1 * swell, .12 + .05 * swell, uShallows);
    float f = (1. - smoothstep(.03, reach, d)) * smoothstep(-.5, .5, grain + swell * .8 - d * 2.) * (1. - .35 * uShallows);
    // The lapping: a thin line of foam that comes and goes against what floats and the shore.
    f = max(f, uLap * (1. - smoothstep(0., .022, abs(d - .07 - .04 * sin(t * 2.6 + vWPos.x * 2.3 + vWPos.z * 1.7)))) * .85);
    outgoingLight = mix(outgoingLight, mix(uFoamColor, vec3(.86, .95, .97), uShallows) * (1. - uLead * .35), clamp(f, 0., 1.) * .7);
  }
}
#include <opaque_fragment>`,
        );
  };
  const grid = (segments: number) => new THREE.PlaneGeometry(opts.size, opts.size, segments, segments);
  const capped = (segments: number) => Math.min(segments, opts.maxSegments ?? segments);
  let segments = capped(96);
  const mesh = new THREE.Mesh(grid(segments), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = opts.y ?? SHORE.waterY;

  let reflection: THREE.Texture | null = null;
  let reflections = true;
  const setEnv = () => {
    const next = reflections ? reflection : null;
    if (material.envMap === next) return;
    material.envMap = next;
    material.needsUpdate = true;
  };
  let shoreTexture: THREE.DataTexture | null = null;

  return {
    mesh,
    setTime: (s) => void (uniforms.uT.value = s),
    setQuality(step) {
      uniforms.uRipples.value = step.ripples ? 1 : 0;
      uniforms.uFoamMoves.value = step.foamMoves ? 1 : 0;
      reflections = step.reflections;
      setEnv();
      if (capped(step.waterSegments) !== segments) {
        segments = capped(step.waterSegments);
        mesh.geometry.dispose();
        mesh.geometry = grid(segments);
      }
    },
    setShore(distances) {
      if (!distances) {
        uniforms.uFoam.value = 0;
        return;
      }
      if (!shoreTexture) {
        shoreTexture = new THREE.DataTexture(new Uint8Array(distances), SHORE.size, SHORE.size, THREE.RedFormat, THREE.UnsignedByteType);
        shoreTexture.magFilter = THREE.LinearFilter;
        shoreTexture.minFilter = THREE.LinearFilter;
        uniforms.uShore.value = shoreTexture;
      } else shoreTexture.image.data.set(distances);
      shoreTexture.needsUpdate = true;
      uniforms.uFoam.value = 1;
    },
    setLead(amount, horizon) {
      uniforms.uLead.value = amount;
      uniforms.uSkyTint.value.set(horizon);
      // Leaden water reflects less of its sky.
      material.envMapIntensity = ENV * (1 - 0.6 * amount);
    },
    useRenderer(renderer) {
      if (reflection) return;
      reflection = skyReflection(renderer, opts.sky);
      setEnv();
    },
  };
}

/**
 * The sky as the water sees it, for its reflection: the scene's gradient wrapped around (zenith to horizon), the
 * horizon's color below, prefiltered once (PMREM) for every roughness.
 */
export function skyReflection(renderer: THREE.WebGLRenderer, sky: readonly [string, string, string]): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, sky[0]);
  gr.addColorStop(0.3, sky[1]);
  gr.addColorStop(0.5, sky[2]);
  gr.addColorStop(1, sky[2]);
  g.fillStyle = gr;
  g.fillRect(0, 0, 8, 64);
  const equirect = new THREE.CanvasTexture(c);
  equirect.colorSpace = THREE.SRGBColorSpace;
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const out = pmrem.fromEquirectangular(equirect).texture;
  pmrem.dispose();
  equirect.dispose();
  return out;
}
