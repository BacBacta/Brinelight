/**
 * The city fabric in the game (owner, 21 October; plan.ts says what grows where). Three meshes at most, whatever the
 * city: every still piece merged in one (one material, the palette's colors on its vertices), their windows in a second
 * that lights in the Mist (more windows with the eras), and the wind turbines' rotors, which turn. Streets, yards, the
 * square and the fields are painted on the ground (paint.ts): no mesh. Built again only when the city changes (a level,
 * a plot, the era), from the era's models (fabric-<era>.bin, fetched once). Decor: nothing here answers a tap.
 */
import * as THREE from "three";
import { reducedMotion } from "../../scene/motion.js";
import type { PlayerState } from "../../state/index.js";
import { ground, type LandSlots } from "../land/field.js";
import { plantLook } from "../life/plants.js";
import { AFLOAT, LIT, eraOf, fabricPlan, type FabricPlan, type Piece } from "./plan.js";
import { mergeFabric, readFabric, type FabricModels, type Merged } from "./models.js";
import { SIZE, drawGround, usePaint } from "./paint.js";

/** The fabric's last rebuild, in ms on the display's thread (the ?fps counter could show it; the tests read it). */
export const fabricClock: { last: number | null } = { last: null };

const YARD = { wild: "#9A7448", garden: "#A5835A", modern: "#B9AB92" } as const;

const files = new Map<number, Promise<FabricModels>>();
/** The era's models, fetched once (and ahead, while the Lighthouse's upgrade toward the next era runs). */
export function fabricModels(era: number): Promise<FabricModels> {
  let f = files.get(era);
  if (!f) {
    f = fetch(`${import.meta.env.BASE_URL}city/fabric-${era}.bin`)
      .then((r) => {
        if (!r.ok) throw new Error(`fabric-${era}: ${r.status}`);
        return r.arrayBuffer();
      })
      .then(readFabric);
    files.set(era, f);
  }
  return f;
}

const WINDOWS_VERTEX = /* glsl */ `
attribute float aLit;
varying float vLit;
`;
const WINDOWS_FRAGMENT = /* glsl */ `
varying float vLit;
uniform float uGlow;
uniform float uShare;
`;

function geometry(m: Merged, lit: boolean): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(m.position, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(m.normal, 3));
  g.setAttribute("color", new THREE.BufferAttribute(m.color, 3));
  if (lit) g.setAttribute("aLit", new THREE.BufferAttribute(m.lit, 1));
  g.setIndex(new THREE.BufferAttribute(m.index, 1));
  g.computeBoundingSphere();
  return g;
}

/** Decor: never under a tap (the city picks only its buildings and raft slots; this makes sure). */
const untouchable = (o: THREE.Object3D) => {
  o.raycast = () => {};
  return o;
};

export type CityFabric = ReturnType<typeof createFabric>;

/**
 * The fabric of a city: `update` plans it when the city changes and builds it once the era's models are there;
 * `onPlan` hears each new plan (the plants give way, the smoke rises from its chimneys).
 */
export function createFabric(add: (o: THREE.Object3D) => void) {
  const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const glow = { value: 0 };
  const share = { value: LIT[0] as number };
  const glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 });
  glass.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glow;
    shader.uniforms.uShare = share;
    shader.vertexShader = (WINDOWS_VERTEX + shader.vertexShader).replace("#include <begin_vertex>", "#include <begin_vertex>\nvLit = aLit;");
    // Lit as the light falls: the windows of the era's share, each at its own threshold; the others go dark.
    shader.fragmentShader = (WINDOWS_FRAGMENT + shader.fragmentShader).replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
float on = step(vLit, uShare) * uGlow;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * .35, uGlow * (1. - on));
totalEmissiveRadiance += vec3(1., .74, .38) * 2.4 * on;`,
    );
  };
  glass.customProgramCacheKey = () => "brinelight-fabric-windows";
  const body = untouchable(new THREE.Mesh(new THREE.BufferGeometry(), solid)) as THREE.Mesh;
  body.name = "fabric";
  body.castShadow = true;
  body.receiveShadow = true;
  const windows = untouchable(new THREE.Mesh(new THREE.BufferGeometry(), glass)) as THREE.Mesh;
  windows.name = "fabric-windows";
  let rotors: THREE.InstancedMesh | null = null;
  let hubs: { x: number; y: number; z: number; turn: number }[] = [];
  for (const m of [body, windows]) {
    m.visible = false;
    add(m);
  }
  const canvas = typeof document !== "undefined" ? Object.assign(document.createElement("canvas"), { width: SIZE, height: SIZE }) : null;
  const map = canvas ? new THREE.CanvasTexture(canvas) : null;
  if (map) {
    // Row 0 is z = -SPAN (paint.ts): read as drawn.
    map.flipY = false;
    map.colorSpace = THREE.NoColorSpace;
  }
  let key = "";
  let plan: FabricPlan | null = null;
  let triangles = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const still = reducedMotion();

  const self = {
    /** The meshes drawn (draw calls). */
    get meshes(): THREE.Object3D[] {
      return [body, windows, ...(rotors ? [rotors] : [])].filter((m) => m.visible);
    },
    get plan(): FabricPlan | null {
      return plan;
    },
    get triangles(): number {
      return triangles;
    },
    onPlan: null as ((plan: FabricPlan) => void) | null,
    /** Plans the fabric again when the city changed: a level (the houses stay in sight of the buildings), its land (`L`, none before the Lighthouse 5). */
    update(state: PlayerState, L: LandSlots) {
      const next = JSON.stringify([state.buildings, L.won, L.flooded, L.filling, Object.entries(state.rafts).map(([k, r]) => [k, !!r.building])]);
      if (next === key) return;
      key = next;
      const p = fabricPlan(state, L);
      const look = plantLook(state.buildings.lighthouse);
      // What does not wait for the models: the ground's paint, and the plants giving way.
      if (canvas && map) {
        drawGround(p, canvas);
        map.needsUpdate = true;
      }
      usePaint(p, { yard: YARD[look] }, map);
      plan = p;
      self.onPlan?.(p);
      share.value = LIT[p.era]!;
      void fabricModels(p.era).then((models) => {
        if (key !== next) return;
        const t0 = performance.now();
        const height = (piece: Piece) => AFLOAT[piece.model] ?? (piece.model === "quay" ? 0 : ground(piece.x, piece.z, L).y);
        const merged = mergeFabric(p, models, height);
        body.geometry.dispose();
        windows.geometry.dispose();
        body.geometry = geometry(merged.body, false);
        windows.geometry = geometry(merged.windows, true);
        body.visible = merged.body.index.length > 0;
        windows.visible = merged.windows.index.length > 0;
        hubs = merged.rotors;
        const rotor = models["turbine-rotor"]?.body;
        if (rotor && hubs.length && !rotors) {
          const g = geometry({ ...rotor, lit: new Float32Array(rotor.position.length / 3), index: new Uint32Array(rotor.index) }, false);
          rotors = untouchable(new THREE.InstancedMesh(g, solid, 8)) as THREE.InstancedMesh;
          rotors.name = "fabric-rotors";
          rotors.castShadow = true;
          rotors.frustumCulled = false;
          add(rotors);
        }
        if (rotors) {
          rotors.count = hubs.length;
          rotors.visible = hubs.length > 0;
          self.animate(0);
        }
        triangles = merged.triangles;
        fabricClock.last = performance.now() - t0;
      });
      // The next era's models, ahead, while the Lighthouse's upgrade toward it runs.
      if (eraOf(state.buildings.lighthouse + 1) !== p.era && state.queue.some((j) => j.id === "lighthouse")) void fabricModels(eraOf(state.buildings.lighthouse + 1));
    },
    /** How far the light has fallen (0 the late afternoon, 1 the Mist): the windows light as much. */
    setDimness(dimness: number) {
      glow.value = dimness;
    },
    /** The rotors turn, slowly (still with reduced motion). */
    animate(now: number) {
      if (!rotors || !hubs.length) return;
      const a = still ? 0.4 : now * 1.4;
      hubs.forEach((h, i) => {
        q.setFromEuler(e.set(0, h.turn, a + i * 0.9, "YXZ"));
        rotors!.setMatrixAt(i, m4.compose(v.set(h.x, h.y, h.z), q, one));
      });
      rotors.instanceMatrix.needsUpdate = true;
    },
  };
  return self;
}

export { eraOf };
