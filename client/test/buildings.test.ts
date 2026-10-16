import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { BUILDING_IDS } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { BUILDING_FIX, LIGHTHOUSE_FIT, TILE_FIT, buildingUrl, normalizeBuilding } from "../src/scene/buildings.js";

const PUBLIC = fileURLToPath(new URL("../public", import.meta.url));
const boxOf = (o: THREE.Object3D) => {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
};
/** A model as an image-to-3D tool may give it: off center, below the ground, far too big. */
const raw = (w: number, h: number, d: number) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d));
  mesh.position.set(5, -3, 7);
  const scene = new THREE.Group();
  scene.add(mesh);
  return scene;
};

describe("a building model brought to its tile", () => {
  it("centered, standing on y = 0, its widest side and its height within the room it may take", () => {
    const m = normalizeBuilding(raw(40, 20, 30), TILE_FIT, { scale: 1, turn: 0 });
    const box = boxOf(m.object);
    expect(box.min.y).toBeCloseTo(0, 6);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 6);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 6);
    // 40 wide: the width decides. 1.6 / 40 = 0.04, so 0.8 high.
    expect(box.max.x - box.min.x).toBeCloseTo(TILE_FIT.width, 6);
    expect(m.height).toBeCloseTo(0.8, 6);
    expect(box.max.y).toBeCloseTo(m.height, 6);
  });

  it("a tall model is limited by the height; proportions are kept", () => {
    const m = normalizeBuilding(raw(1, 10, 2), TILE_FIT, { scale: 1, turn: 0 });
    const size = boxOf(m.object).getSize(new THREE.Vector3());
    expect(size.y).toBeCloseTo(TILE_FIT.height, 6);
    expect(size.z / size.y).toBeCloseTo(2 / 10, 6);
  });

  it("the hand corrections: a scale, and a turn around the vertical axis", () => {
    const m = normalizeBuilding(raw(4, 1, 2), TILE_FIT, { scale: 0.5, turn: Math.PI / 2 });
    const size = boxOf(m.object).getSize(new THREE.Vector3());
    // Turned a quarter: the long side now runs along z.
    expect(size.z).toBeCloseTo(TILE_FIT.width * 0.5, 6);
    expect(size.x).toBeCloseTo(TILE_FIT.width * 0.25, 6);
    expect(m.height).toBeCloseTo(0.2, 6);
  });

  it("every shadow is cast and received, as for the kit's models", () => {
    const m = normalizeBuilding(raw(1, 1, 1), TILE_FIT, { scale: 1, turn: 0 });
    const meshes: THREE.Mesh[] = [];
    m.object.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh));
    expect(meshes.every((x) => x.castShadow && x.receiveShadow)).toBe(true);
  });

  it("a correction for each of the nine buildings, and a lantern height for the Lighthouse", () => {
    expect(Object.keys(BUILDING_FIX).sort()).toEqual([...BUILDING_IDS].sort());
    expect(BUILDING_FIX.lighthouse.lantern).toBeGreaterThan(0.5);
    expect(LIGHTHOUSE_FIT.height).toBeGreaterThan(TILE_FIT.height);
  });
});

describe("the nine model files", () => {
  /** The JSON part of a GLB file. */
  const gltfOf = (bytes: Buffer) => {
    expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
    return JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12))) as {
      extensionsRequired: string[];
      accessors: { count: number }[];
      meshes: { primitives: { indices: number }[] }[];
      images: { mimeType: string }[];
    };
  };

  it("all there, together under 3 MB, with a WebP texture and quantized geometry", () => {
    let total = 0;
    for (const id of BUILDING_IDS) {
      const file = `${PUBLIC}${buildingUrl(id)}`;
      total += statSync(file).size;
      const gltf = gltfOf(readFileSync(file));
      expect(gltf.extensionsRequired.sort(), id).toEqual(["EXT_texture_webp", "KHR_mesh_quantization"]);
      expect(gltf.images.map((i) => i.mimeType), id).toEqual(["image/webp"]);
      const triangles = gltf.accessors[gltf.meshes[0]!.primitives[0]!.indices]!.count / 3;
      expect(triangles, id).toBeGreaterThan(2000);
      expect(triangles, id).toBeLessThan(3000);
    }
    expect(total).toBeLessThan(3 * 1024 * 1024);
  });
});
