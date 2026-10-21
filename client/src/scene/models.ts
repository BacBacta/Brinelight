/**
 * The sea's models generated from the art direction (client/public/models, made by assets/make-models.py): the wreck,
 * the pirate camp and your boat, loaded on your first visit at sea. And what the city's models share: the raft
 * buildings' names, a model baked for an InstancedMesh, a texture filtered at a slant.
 */
import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RAFT_BUILDINGS, type RaftBuildingId } from "@brinelight/shared";

export const MODEL_IDS = ["wreck", "camp", "boat"] as const;
export type ModelId = (typeof MODEL_IDS)[number];
export type Models = Record<ModelId, THREE.Object3D>;

export const modelUrl = (id: string): string => `${import.meta.env.BASE_URL}models/${id}.glb`;

/** Loads the models in parallel with the scene's loader. */
export async function loadModels(loader: GLTFLoader): Promise<Models> {
  const loaded = await Promise.all(MODEL_IDS.map((id) => loader.loadAsync(modelUrl(id))));
  const out = {} as Models;
  MODEL_IDS.forEach((id, i) => (out[id] = loaded[i]!.scene));
  return out;
}

export const RAFT_BUILDING_IDS = Object.keys(RAFT_BUILDINGS) as RaftBuildingId[];

/** The island's texture is filtered along the slant up to this many samples (anisotropy), where the device allows. */
export const ISLAND_ANISOTROPY = 8;

/**
 * The island's texture as the camera sees it, at a slant (its shore most of all): mipmaps with trilinear filtering
 * (the file's sampler asks for it; set again here), and anisotropic filtering up to `anisotropy`.
 */
export function filterTexture(model: THREE.Object3D, anisotropy: number): void {
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const map = (m as THREE.MeshStandardMaterial).map;
      if (!map) continue;
      map.generateMipmaps = true;
      map.minFilter = THREE.LinearMipmapLinearFilter;
      map.anisotropy = anisotropy;
      map.needsUpdate = true;
    }
  });
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
