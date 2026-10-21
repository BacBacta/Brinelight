/**
 * What the city fabric paints on the ground (owner, 21 October): its streets in the era's ground (dirt, then cobbles,
 * then paving), the yards of trodden earth around the houses, the square around the Lighthouse, and the fields on the
 * plots won (gardens in rows, orchards, kelp racks, parks). No mesh and no draw call: the island's terrain and the land
 * won read it in their own shader (paintGround), from a small texture of the streets and yards drawn when the city
 * changes, and a few numbers.
 */
import * as THREE from "three";
import type { FabricPlan, FieldKind } from "./plan.js";

/** The ground the texture covers: a square of 2 × SPAN around the Lighthouse, at SIZE pixels a side. */
export const SPAN = 10;
export const SIZE = 512;
/** The most fields painted at once (the plots won: 39 at most). */
export const MAX_FIELDS = 40;
const FIELD_KIND: Record<FieldKind, number> = { garden: 1, orchard: 2, kelp: 3, park: 4 };

/** The streets' ground by era: dirt, then cobbles, then paving; and the square's. */
export const STREET = ["#9A7448", "#A5835A", "#9C968B", "#9C968B", "#DDD5C4", "#DDD5C4"] as const;
const STREET_KIND = [0, 0, 1, 1, 2, 2] as const;
/** The streets' width (game units), a little wider with the eras. */
export const streetWidth = (era: number): number => 0.18 + 0.04 * era;

const empty = new THREE.DataTexture(new Uint8Array(4), 1, 1);
empty.needsUpdate = true;

export const FABRIC_PAINT = {
  uFabricMap: { value: empty as THREE.Texture },
  uFabricBox: { value: new THREE.Vector3(-SPAN, -SPAN, 1 / (2 * SPAN)) },
  uStreetCol: { value: new THREE.Color(STREET[0]) },
  uStreetKind: { value: 0 },
  uYardCol: { value: new THREE.Color("#9A7448") },
  uSquare: { value: 0 },
  uSquareCol: { value: new THREE.Color(STREET[0]) },
  uFields: { value: Array.from({ length: MAX_FIELDS }, () => new THREE.Vector4()) },
  uFieldCount: { value: 0 },
};

const VERTEX = /* glsl */ `
varying vec2 vFabricXZ;
`;
const FRAGMENT = /* glsl */ `
varying vec2 vFabricXZ;
uniform sampler2D uFabricMap;
uniform vec3 uFabricBox;
uniform vec3 uStreetCol, uYardCol, uSquareCol;
uniform int uStreetKind;
uniform float uSquare;
uniform vec4 uFields[${MAX_FIELDS}];
uniform int uFieldCount;
`;
const PAINT = /* glsl */ `
{
  vec2 p = vFabricXZ;
  vec4 fm = texture2D(uFabricMap, (p - uFabricBox.xy) * uFabricBox.z);
  vec3 fc = diffuseColor.rgb;
  fc = mix(fc, uYardCol, fm.b * .35);
  float h = max(abs(p.x), max(abs(p.x * .5 + p.y * .866), abs(-p.x * .5 + p.y * .866)));
  float sq = clamp((uSquare - h) / .03, 0., 1.) * clamp((h - .6) / .05, 0., 1.);
  vec3 sc = uSquareCol;
  if (uStreetKind == 1 && sin(p.x * 80.) * sin(p.y * 80.) > .55) sc *= .84;
  if (uStreetKind == 2 && (abs(fract(p.x * 6.) - .5) < .03 || abs(fract(p.y * 6.) - .5) < .03)) sc *= .9;
  fc = mix(fc, sc, sq);
  vec3 st = uStreetCol;
  if (uStreetKind == 1 && sin(p.x * 90.) * sin(p.y * 90.) > .6) st *= .82;
  fc = mix(fc, st, fm.r * (uStreetKind == 0 ? .85 : 1.));
  if (uStreetKind == 2) fc = mix(fc, st * .9, clamp(fm.r * (1. - fm.r) * 3., 0., 1.));
  for (int i = 0; i < ${MAX_FIELDS}; i++) {
    if (i >= uFieldCount) break;
    vec4 f = uFields[i];
    float r = length(p - f.xy) + .06 * sin(p.x * 3.1 + p.y * 2.3);
    float inside = clamp((.8 - r) / .06, 0., 1.);
    if (inside <= 0.) continue;
    vec3 c;
    if (f.z < 1.5) c = sin((p.x - f.x) * 38.) > 0. ? vec3(.157, .27, .05) : vec3(.25, .144, .058);
    else if (f.z < 2.5) c = vec3(.235, .42, .095);
    else if (f.z < 3.5) c = sin((p.y - f.y) * 30.) > .3 ? vec3(.33, .26, .17) : vec3(.47, .39, .25);
    else c = mix(vec3(.38, .63, .16), vec3(.72, .66, .55), clamp((.045 - abs(length(p - f.xy) - .45)) / .015, 0., 1.));
    fc = mix(fc, c, inside);
  }
  diffuseColor.rgb = fc;
}
`;

/** Paints the fabric on a ground's material (the island's terrain, the land won's), after what it paints itself. */
export function paintGround(material: THREE.Material): void {
  const m = material as THREE.MeshStandardMaterial & { userData: { fabric?: boolean } };
  if (m.userData.fabric) return;
  m.userData.fabric = true;
  const before = m.onBeforeCompile.bind(m);
  const key = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    Object.assign(shader.uniforms, FABRIC_PAINT);
    shader.vertexShader = (VERTEX + shader.vertexShader).replace("#include <begin_vertex>", "#include <begin_vertex>\nvFabricXZ = (modelMatrix * vec4(transformed, 1.)).xz;");
    shader.fragmentShader = (FRAGMENT + shader.fragmentShader).replace("#include <map_fragment>", `#include <map_fragment>\n${PAINT}`);
  };
  m.customProgramCacheKey = () => `${key()}-fabric`;
  m.needsUpdate = true;
}

/** The plan's streets and yards drawn on a canvas, red and blue, its pixels in the ground's (x, z) (row 0 at z = -SPAN). */
export function drawGround(plan: FabricPlan, canvas: { getContext(id: "2d"): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null }): void {
  const g = canvas.getContext("2d");
  if (!g) return;
  const k = SIZE / (2 * SPAN);
  const px = (v: number) => (v + SPAN) * k;
  g.globalCompositeOperation = "source-over";
  g.fillStyle = "#000";
  g.fillRect(0, 0, SIZE, SIZE);
  g.globalCompositeOperation = "lighter";
  g.fillStyle = "rgb(0,0,170)";
  for (const y of plan.yards) {
    g.beginPath();
    g.arc(px(y.x), px(y.z), 0.8 * k, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = "rgb(255,0,0)";
  g.lineCap = "round";
  g.lineJoin = "round";
  g.lineWidth = streetWidth(plan.era) * k;
  for (const line of plan.streets) {
    g.beginPath();
    line.forEach(([x, z], i) => (i ? g.lineTo(px(x), px(z)) : g.moveTo(px(x), px(z))));
    g.stroke();
  }
}

/** Sets the ground's paint for a plan: its colors, its square and fields, and its texture (`map`, already drawn). */
export function usePaint(plan: FabricPlan, look: { yard: string }, map: THREE.Texture | null): void {
  FABRIC_PAINT.uStreetCol.value.set(STREET[plan.era]!);
  FABRIC_PAINT.uStreetKind.value = STREET_KIND[plan.era]!;
  FABRIC_PAINT.uYardCol.value.set(look.yard);
  FABRIC_PAINT.uSquare.value = plan.square;
  FABRIC_PAINT.uSquareCol.value.set(STREET[plan.era]!);
  plan.fields.slice(0, MAX_FIELDS).forEach((f, i) => FABRIC_PAINT.uFields.value[i]!.set(f.x, f.z, FIELD_KIND[f.kind], 0));
  FABRIC_PAINT.uFieldCount.value = Math.min(MAX_FIELDS, plan.fields.length);
  if (map) FABRIC_PAINT.uFabricMap.value = map;
}
