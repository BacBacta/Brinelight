/**
 * The survivors' body (week 8, meeting 4; assets/blender/life.py): one model for all, its parts found by where its
 * vertices are in its rest pose, and moved in the shader: a whole crowd is one draw call, and the processor only places
 * them. Each instance has its action, its phase in it, and the colors of its shirt, its trousers and its skin. A tool
 * held in the right hand is another mesh drawn with the same shader, every vertex of it turning with that arm.
 */
import * as THREE from "three";

/** Where the parts are in the rest pose (life.py): the survivor stands on y = 0 and faces +z. */
export const BODY = { HIP: 0.09, SHOULDER: 0.155, NECK: 0.162, HAT: 0.193, LEG_X: 0.03, ARM_X: 0.03, PACK_Z: -0.0175, ARM: 0.039, LEG: 0.016, HAND_TOP: 0.098, BOOT_TOP: 0.012 } as const;

/** What a survivor does; the shader moves its arms, legs and head for it. */
export const ANIM = { walk: 0, hammer: 1, carry: 2, fish: 3, chop: 4, water: 5, watch: 6, stoke: 7, idle: 8 } as const;
export type Anim = keyof typeof ANIM;

/** The tools a survivor may hold (life.py: TOOLS), each a model of its own. */
export const TOOLS = ["hammer", "axe", "barrel", "rod", "can", "spyglass", "poker"] as const;
export type Tool = (typeof TOOLS)[number];

/** A part of the body, as the shader finds it (0 the body, 1 and 2 the arms, 3 and 4 the legs, 5 the head, 6 the hat, 7 the pack). */
export function partOf(x: number, y: number, z: number): number {
  const { HIP, NECK, HAT, ARM_X, PACK_Z } = BODY;
  if (y > HAT) return 6;
  if (y > NECK && Math.abs(x) < ARM_X) return 5;
  if (Math.abs(x) > ARM_X && y > 0.08) return x > 0 ? 1 : 2;
  if (y < HIP) return x > 0 ? 3 : 4;
  if (z < PACK_Z) return 7;
  return 0;
}

const f = (n: number) => n.toFixed(4);

const VERTEX_HEAD = /* glsl */ `
attribute float aAnim;
attribute float aPhase;
attribute vec3 aShirt;
attribute vec3 aPants;
attribute vec3 aSkin;
uniform float uTime;
uniform float uTool;
varying vec3 vTint;
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
`;

/** The pose at a time: the right arm, the left arm, the right leg, the left leg (turns around x), the head's turn, a lift. */
const POSE = /* glsl */ `
float t = uTime + aPhase;
vec4 a = vec4(0.);
float yaw = 0.;
float lift = 0.;
int k = int(aAnim + .5);
if (k == ${ANIM.walk} || k == ${ANIM.carry}) {
  float w = sin(t * 7.);
  a.zw = vec2(-.5 * w, .5 * w);
  lift = abs(w) * .004;
  a.xy = k == ${ANIM.walk} ? vec2(.5 * w, -.5 * w) : vec2(-1.);
} else if (k == ${ANIM.hammer}) {
  float h = pow(max(0., sin(t * 5.)), 2.);
  a.x = -1.3 - .9 * h;
  a.y = -.6;
} else if (k == ${ANIM.fish}) {
  a.xy = vec2(-1.2 + .05 * sin(t * 1.3));
} else if (k == ${ANIM.chop}) {
  float c = fract(t * .8);
  float s = c < .7 ? c / .7 : 1. - (c - .7) / .3;
  a.xy = vec2(-.6 - 2. * s);
} else if (k == ${ANIM.water}) {
  a.x = -1. + .15 * sin(t * 2.);
  a.y = .1;
} else if (k == ${ANIM.watch}) {
  a.x = -2.2;
  yaw = .5 * sin(t * .5);
} else if (k == ${ANIM.stoke}) {
  a.xy = vec2(-.9 + .35 * sin(t * 3.));
} else {
  a.xy = vec2(.05 * sin(t * 1.1), -.05 * sin(t * 1.1));
}
`;

const PARTS = /* glsl */ `
vec3 p = position;
float part = 0.;
if (uTool > .5) part = 1.;
else if (p.y > ${f(BODY.HAT)}) part = 6.;
else if (p.y > ${f(BODY.NECK)} && abs(p.x) < ${f(BODY.ARM_X)}) part = 5.;
else if (abs(p.x) > ${f(BODY.ARM_X)} && p.y > .08) part = p.x > 0. ? 1. : 2.;
else if (p.y < ${f(BODY.HIP)}) part = p.x > 0. ? 3. : 4.;
else if (p.z < ${f(BODY.PACK_Z)}) part = 7.;
mat3 r = mat3(1.);
vec3 pivot = vec3(0.);
if (part == 1. || part == 2.) {
  r = rotX(part == 1. ? a.x : a.y);
  pivot = vec3(part == 1. ? ${f(BODY.ARM)} : -${f(BODY.ARM)}, ${f(BODY.SHOULDER)}, 0.);
} else if (part == 3. || part == 4.) {
  r = rotX(part == 3. ? a.z : a.w);
  pivot = vec3(part == 3. ? ${f(BODY.LEG)} : -${f(BODY.LEG)}, ${f(BODY.HIP)}, 0.);
} else if (part == 5. || part == 6.) {
  r = rotY(yaw);
  pivot = vec3(0., ${f(BODY.NECK)}, 0.);
}
`;

/**
 * The material of the survivors (or, with `tool`, of a tool they hold): the model's own, its vertices moved by the
 * pose and its shirt, trousers and skin tinted per instance. `time` is shared: set it each frame (or keep it still).
 */
export function bodyMaterial(base: THREE.Material, time: { value: number }, tool: boolean): THREE.Material {
  const material = (base as THREE.MeshStandardMaterial).clone();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uTool = { value: tool ? 1 : 0 };
    shader.vertexShader = (VERTEX_HEAD + shader.vertexShader)
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
${POSE}
${PARTS}
objectNormal = r * objectNormal;
vTint = vec3(1.);
if (uTool < .5) {
  if (part == 0. || ((part == 1. || part == 2.) && p.y > ${f(BODY.HAND_TOP)})) vTint = aShirt;
  else if (part == 1. || part == 2. || part == 5.) vTint = aSkin;
  else if ((part == 3. || part == 4.) && p.y > ${f(BODY.BOOT_TOP)}) vTint = aPants;
}`,
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed = pivot + r * (position - pivot);\ntransformed.y += lift;");
    shader.fragmentShader = "varying vec3 vTint;\n" + shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb *= vTint;");
  };
  // One program for the body and the tools: they differ only by a uniform.
  material.customProgramCacheKey = () => "brinelight-body";
  return material;
}

/** Shirts, trousers and skins: the survivors' colors (docs/art-direction.md: faded cloth, never neon). */
export const SHIRTS = ["#C9A77A", "#5E9E8C", "#B9674A", "#8E979C", "#E0B06A", "#6F8FAF", "#A7B58A", "#C8C1B4"] as const;
export const PANTS = ["#4E4A45", "#5B4636", "#3E5A6E", "#6B5D4A", "#4A5A44"] as const;
export const SKINS = ["#F1D2B4", "#D9A77F", "#B67F5A", "#8A5A3C", "#E8BE98"] as const;
