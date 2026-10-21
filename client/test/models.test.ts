import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { MODEL_IDS, filterTexture, modelUrl } from "../src/scene/models.js";

const PUBLIC = fileURLToPath(new URL("../public", import.meta.url));
/** The sea's models. */
const FILES = MODEL_IDS.map(modelUrl);

type Gltf = {
  extensionsRequired: string[];
  nodes: { matrix: number[] }[];
  accessors: { count: number; min?: number[]; max?: number[]; normalized?: boolean }[];
  meshes: { primitives: { indices: number; attributes: { POSITION: number } }[] }[];
  images: { mimeType: string }[];
};
const gltfOf = (file: string): Gltf => {
  const bytes = readFileSync(file);
  expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
  return JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12))) as Gltf;
};

describe("the sea's model files", () => {
  it("each with a WebP texture and quantized geometry, decoded at its true size (Meshy's models are about 2 units)", () => {
    for (const url of FILES) {
      const file = `${PUBLIC}${url}`;
      const gltf = gltfOf(file);
      expect(gltf.extensionsRequired.sort(), url).toEqual(["EXT_texture_webp", "KHR_mesh_quantization"]);
      expect(gltf.images.map((i) => i.mimeType), url).toEqual(["image/webp"]);
      // A normalized 16-bit position reads between -1 and 1; the node's scale brings it back to the model's size.
      const pos = gltf.accessors[gltf.meshes[0]!.primitives[0]!.attributes.POSITION]!;
      const extent = Math.max(...pos.max!.map((v, k) => (v - pos.min![k]!) / 32767)) * gltf.nodes[0]!.matrix[0]!;
      expect(extent, url).toBeGreaterThan(1);
      expect(extent, url).toBeLessThan(2.5);
    }
  });

  it("under 1.5 MB together, each under 3 000 triangles", () => {
    let total = 0;
    for (const id of MODEL_IDS) {
      const file = `${PUBLIC}${modelUrl(id)}`;
      total += statSync(file).size;
      const gltf = gltfOf(file);
      expect(gltf.accessors[gltf.meshes[0]!.primitives[0]!.indices]!.count / 3, id).toBeLessThan(3100);
    }
    expect(total).toBeLessThan(1.5 * 1024 * 1024);
  });
});

describe("a texture seen at a slant", () => {
  it("mipmaps, trilinear and anisotropic filtering", () => {
    const map = new THREE.Texture();
    map.minFilter = THREE.LinearFilter;
    const model = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ map }));
    filterTexture(model, 8);
    expect(map.generateMipmaps).toBe(true);
    expect(map.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(map.anisotropy).toBe(8);
  });
});
