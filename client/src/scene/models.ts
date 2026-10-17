/**
 * The other models generated from the art direction (client/public/models, made by assets/make-models.py):
 * the island, the raft, and at sea the wreck, the pirate camp and your boat. The buildings on rafts (greenhouse,
 * smokehouse, watchtower) are in the same folder, loaded once the city shows (loadRaftBuildings).
 */
import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RAFT_BUILDINGS, type RaftBuildingId } from "@brinelight/shared";

export const MODEL_IDS = ["island", "raft", "wreck", "camp", "boat"] as const;
export type ModelId = (typeof MODEL_IDS)[number];
export type Models = Record<ModelId, THREE.Object3D>;

export const modelUrl = (id: string): string => `${import.meta.env.BASE_URL}models/${id}.glb`;

/** Loads the models in parallel with the scene's loader, as they come (each placed where it is used). */
export async function loadModels(loader: GLTFLoader): Promise<Models> {
  const loaded = await Promise.all(MODEL_IDS.map((id) => loader.loadAsync(modelUrl(id))));
  const out = {} as Models;
  MODEL_IDS.forEach((id, i) => (out[id] = loaded[i]!.scene));
  return out;
}

export type RaftBuildingModels = Record<RaftBuildingId, THREE.Object3D>;
export const RAFT_BUILDING_IDS = Object.keys(RAFT_BUILDINGS) as RaftBuildingId[];

/**
 * The three buildings on rafts, in parallel with the scene's loader. They are not needed for the first screen
 * (+464 kB): the scene loads them after the city shows, and the rafts show their buildings once they are there.
 */
export async function loadRaftBuildings(loader: GLTFLoader): Promise<RaftBuildingModels> {
  const loaded = await Promise.all(RAFT_BUILDING_IDS.map((id) => loader.loadAsync(modelUrl(id))));
  const out = {} as RaftBuildingModels;
  RAFT_BUILDING_IDS.forEach((id, i) => (out[id] = loaded[i]!.scene));
  return out;
}

/**
 * Where the island's shore falls: on ring 3 of the hex grid (its tiles are 5.2 to 6 from the center), a little inside
 * it so the rafts moored on ring 3 float off the rocks. Its meadow then reaches about 5 from the center: every plot of
 * rings 0 to 2 stands on it.
 */
export const SHORE_RADIUS = 5.6;
/**
 * The island's turn around its vertical axis. make-models.py places the island's pine for this turn: on the rim at
 * the pier's gap, clear of every plot's tile and of every raft slot (a test checks it).
 */
export const ISLAND_TURN = -Math.PI / 12;

/**
 * The island under the city: centered, its meadow (at y = 0 in the file: make-models.py puts it there) at y = 0 where
 * the buildings stand, scaled so its widest side reaches SHORE_RADIUS from the center, and turned by ISLAND_TURN.
 * Its pine stands above the meadow, and its sides go down into the sea.
 */
export function fitIsland(model: THREE.Object3D): THREE.Object3D {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const fitted = new THREE.Group();
  fitted.add(model);
  model.position.sub(new THREE.Vector3(center.x, 0, center.z));
  fitted.scale.setScalar((2 * SHORE_RADIUS) / Math.max(size.x, size.z));
  fitted.rotation.y = ISLAND_TURN;
  fitted.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return fitted;
}

/**
 * One geometry and one material from a model, with its own transform baked in, for an InstancedMesh.
 * The model's meshes are merged when it has several; quantized attributes become plain numbers on the way.
 */
export function bakeModel(model: THREE.Object3D): { geometry: THREE.BufferGeometry; material: THREE.Material } {
  model.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  let material: THREE.Material | null = null;
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    material ??= Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material;
    const g = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(mesh.geometry.attributes)) {
      const a = attr as THREE.BufferAttribute;
      const values = new Float32Array(a.count * a.itemSize);
      // getX… read quantized values as the numbers they stand for.
      const get = [a.getX, a.getY, a.getZ, a.getW].slice(0, a.itemSize);
      for (let i = 0; i < a.count; i++) get.forEach((f, k) => (values[i * a.itemSize + k] = f.call(a, i)));
      g.setAttribute(name, new THREE.BufferAttribute(values, a.itemSize));
    }
    if (mesh.geometry.index) g.setIndex(Array.from(mesh.geometry.index.array));
    g.applyMatrix4(mesh.matrixWorld);
    parts.push(g);
  });
  if (!material || parts.length === 0) throw new Error("The model has no mesh");
  const geometry = parts.length === 1 ? parts[0]! : mergeGeometries(parts);
  return { geometry, material };
}
