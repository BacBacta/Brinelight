/**
 * What the city fabric paints on the ground (owner, 21 October): its streets in the era's ground (dirt, then cobbles,
 * then paving), the yards of trodden earth around the houses, the square around the Lighthouse, and the fields on the
 * plots won (gardens in rows, orchards, kelp racks, parks). No mesh and no draw call: the island's terrain and the land
 * won read it in their own shader (paintGround), from a small texture of the streets and yards drawn when the city
 * changes, a tiny one of each plot's field (one read a pixel, however many fields), and a few numbers.
 */
import * as THREE from "three";
import type { FabricPlan, FieldKind } from "./plan.js";
import { BEDS, BED_GAP, FIELD_BORDER, FIELD_REACH, GRASS, KELP, ROW_SPACING, VEG, fieldBytes } from "./fields.js";

/** The ground the texture covers: a square of 2 × SPAN around the Lighthouse, at SIZE pixels a side. */
export const SPAN = 10;
export const SIZE = 512;
const FIELD_KIND: Record<FieldKind, number> = { garden: 1, orchard: 2, kelp: 3, park: 4 };
/** The plots' fields, a texel each: plot (q, r) at (q + FIELD_AT, r + FIELD_AT), its kind times FIELD_STEP in red, its shape's bytes in green, blue and alpha (fields.ts). */
export const FIELD_SIZE = 16;
const FIELD_AT = 8;
const FIELD_STEP = 60;

/** The streets' ground by era: dirt, then cobbles, then paving; and the square's. */
export const STREET = ["#9A7448", "#A5835A", "#9C968B", "#9C968B", "#DDD5C4", "#DDD5C4"] as const;
const STREET_KIND = [0, 0, 1, 1, 2, 2] as const;
/** The streets' width (game units), a little wider with the eras. */
export const streetWidth = (era: number): number => 0.18 + 0.04 * era;

const empty = new THREE.DataTexture(new Uint8Array(4), 1, 1);
empty.needsUpdate = true;
const fieldData = new Uint8Array(FIELD_SIZE * FIELD_SIZE * 4);
const fieldKinds = new THREE.DataTexture(fieldData, FIELD_SIZE, FIELD_SIZE);
fieldKinds.magFilter = THREE.NearestFilter;
fieldKinds.minFilter = THREE.NearestFilter;
fieldKinds.needsUpdate = true;

export const FABRIC_PAINT = {
  uFabricMap: { value: empty as THREE.Texture },
  uFabricBox: { value: new THREE.Vector3(-SPAN, -SPAN, 1 / (2 * SPAN)) },
  uStreetCol: { value: new THREE.Color(STREET[0]) },
  uStreetKind: { value: 0 },
  uYardCol: { value: new THREE.Color("#9A7448") },
  uSquare: { value: 0 },
  uSquareCol: { value: new THREE.Color(STREET[0]) },
  uFieldKinds: { value: fieldKinds as THREE.Texture },
};

/** A color (sRGB hex) as the shader's linear vec3. */
const vec3 = (hex: string) => {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return `vec3(${[1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(4)).join(", ")})`;
};
const num = (v: number) => v.toFixed(4);

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
uniform sampler2D uFieldKinds;
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
  // The plot under the pixel (scene/island.ts, hexX and hexZ turned back, to the nearest middle), and its field.
  float hr = p.y / 1.732;
  vec3 cube = vec3(p.x * .5 - hr * .5, hr, 0.);
  cube.z = -cube.x - cube.y;
  vec3 rc = floor(cube + .5);
  vec3 dc = abs(rc - cube);
  if (dc.x > dc.y && dc.x > dc.z) rc.x = -rc.y - rc.z;
  else if (dc.y > dc.z) rc.y = -rc.x - rc.z;
  vec4 ft = texture2D(uFieldKinds, (rc.xy + ${FIELD_AT}.5) / ${FIELD_SIZE}.);
  float kind = floor(ft.r * ${(255 / FIELD_STEP).toFixed(4)} + .5);
  if (kind > .5) {
    // The plot's field (fields.ts): its rounded outline, its beds and the grass around them, each bed's rows.
    vec2 fp = p - vec2(2. * (rc.x + rc.y * .5), 1.732 * rc.y);
    float turn = ft.g * 6.28318531;
    float seed = floor(ft.a * 255. + .5);
    float s = seed / 255.;
    float th = atan(fp.y, fp.x);
    float outside = length(fp) - ${num(FIELD_REACH)} * (1. + .13 * cos(2. * th + ft.b * 6.28318531) + .07 * cos(3. * th + s * 6.28318531));
    float inside = clamp(-outside / .03, 0., 1.);
    float grain = .88 + .12 * sin(p.x * 53. + p.y * 31.) * sin(p.x * 17. - p.y * 23.);
    vec3 c;
    if (kind < 1.5 || (kind > 2.5 && kind < 3.5)) {
      // The beds (fields.ts, bedOf and bedAt): the nearest bed's middle, and how far to the line halfway to the others.
      float n = kind < 1.5 ? ${BEDS.garden}. : ${BEDS.kelp}.;
      float bed = 0.;
      vec2 at = vec2(0.);
      float best = 1e3;
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        if (fk >= n) break;
        float a = turn + fk * 6.28318531 / n + (fract(s * (fk + 1.) * .618) - .5) * .9;
        vec2 b = (.22 + .16 * fract(s * (fk + 1.) * 1.37)) * vec2(cos(a), sin(a));
        float d = length(fp - b);
        if (d < best) { best = d; bed = fk; at = b; }
      }
      float edge = 1e3;
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        if (fk >= n) break;
        if (fk == bed) continue;
        float a = turn + fk * 6.28318531 / n + (fract(s * (fk + 1.) * .618) - .5) * .9;
        vec2 b = (.22 + .16 * fract(s * (fk + 1.) * 1.37)) * vec2(cos(a), sin(a));
        edge = min(edge, dot((at + b) * .5 - fp, normalize(b - at)));
      }
      float depth = min(-outside - ${num(FIELD_BORDER)}, edge - ${num(BED_GAP / 2)});
      float a = turn + bed * 6.28318531 / n + (fract(s * (bed + 1.) * .618) - .5) * .9;
      float dir = a + mod(bed, 2.) * 1.57079633 + (fract(ft.b * (bed + 1.) * .41) - .5) * .6;
      float t = dot(fp - at, vec2(-sin(dir), cos(dir))) / (kind < 1.5 ? ${num(ROW_SPACING.garden)} : ${num(ROW_SPACING.kelp)});
      float row = floor(t);
      float fr = fract(t);
      float leaf = smoothstep(.08, .2, fr) * (1. - smoothstep(.8, .92, fr));
      vec3 bc;
      vec3 rim;
      if (kind < 1.5) {
        float v = mod(seed + row * 3. + bed * 2., ${VEG.length}.);
        vec3 veg = v < .5 ? ${vec3(VEG[0])} : v < 1.5 ? ${vec3(VEG[1])} : v < 2.5 ? ${vec3(VEG[2])} : v < 3.5 ? ${vec3(VEG[3])} : v < 4.5 ? ${vec3(VEG[4])} : v < 5.5 ? ${vec3(VEG[5])} : ${vec3(VEG[6])};
        bc = mix(vec3(.16, .10, .05) * grain, veg * grain, leaf);
        rim = ${vec3(GRASS)} * grain;
      } else {
        bc = mix(vec3(.52, .46, .32) * grain, ${vec3(KELP)} * grain, leaf * .85);
        rim = vec3(.60, .55, .40) * grain;
      }
      c = mix(rim, bc, clamp(depth / .025 + .5, 0., 1.));
    } else if (kind < 2.5) c = vec3(.235, .42, .095) * grain;
    else c = mix(vec3(.38, .63, .16), vec3(.72, .66, .55), clamp((.045 - abs(length(fp) - .45)) / .015, 0., 1.));
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
  fieldData.set(fieldTexels(plan));
  fieldKinds.needsUpdate = true;
  if (map) FABRIC_PAINT.uFabricMap.value = map;
}

/** The plan's fields as the texels the ground reads: each field's kind on its plot's texel (red), nothing elsewhere. */
export function fieldTexels(plan: Pick<FabricPlan, "fields">): Uint8Array {
  const out = new Uint8Array(FIELD_SIZE * FIELD_SIZE * 4);
  for (const f of plan.fields) {
    // A plot's middle back to its (q, r): scene/island.ts.
    const r = Math.round(f.z / 1.732);
    const q = Math.round(f.x / 2 - r / 2);
    const [u, v] = [q + FIELD_AT, r + FIELD_AT];
    if (u < 0 || v < 0 || u >= FIELD_SIZE || v >= FIELD_SIZE) continue;
    const at = (v * FIELD_SIZE + u) * 4;
    out[at] = FIELD_KIND[f.kind] * FIELD_STEP;
    out.set(fieldBytes(q, r), at + 1);
  }
  return out;
}
