import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { BUILDING_IDS, RAFT_SLOTS } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { PLOT_OUTLINE, createIsland } from "../src/scene/island.js";
import { ISLAND_TURN, MODEL_IDS, SHORE_RADIUS, fitIsland, modelUrl } from "../src/scene/models.js";
import { buildingUrl } from "../src/scene/buildings.js";
import { plotPosition } from "../src/city/buildings.js";
import { RAFT_WIDTH, slotPosition } from "../src/city/rafts.js";

const PUBLIC = fileURLToPath(new URL("../public", import.meta.url));
/** Every model the game serves or keeps for later: the buildings, then the other models. */
const FILES = [...BUILDING_IDS.map(buildingUrl), ...[...MODEL_IDS, "greenhouse", "smokehouse", "watchtower"].map(modelUrl)];

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

describe("the model files", () => {
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

  it("the other models: under 1.5 MB together, each under 3 000 triangles", () => {
    let total = 0;
    for (const id of [...MODEL_IDS, "greenhouse", "smokehouse", "watchtower"]) {
      const file = `${PUBLIC}${modelUrl(id)}`;
      total += statSync(file).size;
      const gltf = gltfOf(file);
      expect(gltf.accessors[gltf.meshes[0]!.primitives[0]!.indices]!.count / 3, id).toBeLessThan(3100);
    }
    expect(total).toBeLessThan(1.5 * 1024 * 1024);
  });
});

describe("the island under the city", () => {
  /** A stand-in for the island: its meadow at y = 0 as make-models.py leaves it, off center, with a pine above it. */
  const islandModel = () => {
    const ground = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 1.8));
    ground.position.set(0.3, -0.15, -0.2);
    const pine = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1));
    pine.position.set(-0.4, 0.2, 0.3);
    const g = new THREE.Group();
    g.add(ground, pine);
    return g;
  };

  it("centered, its meadow at y = 0 where the buildings stand, its shore SHORE_RADIUS from the center, turned", () => {
    const island = fitIsland(islandModel());
    island.updateMatrixWorld(true);
    // The meadow's corner stays on the ground; the pine stands above it.
    const corner = new THREE.Vector3(0.3 + 0.95, 0, -0.2 + 0.9);
    island.children[0]!.localToWorld(corner);
    expect(corner.y).toBeCloseTo(0, 6);
    const box = new THREE.Box3().setFromObject(island);
    expect(box.max.y).toBeGreaterThan(1);
    expect(island.rotation.y).toBe(ISLAND_TURN);
    // Unturned, the box is centered and SHORE_RADIUS wide on each side.
    island.rotation.y = 0;
    island.updateMatrixWorld(true);
    const flat = new THREE.Box3().setFromObject(island.children[0]!.children[0]!);
    expect((flat.min.x + flat.max.x) / 2).toBeCloseTo(0, 6);
    expect((flat.min.z + flat.max.z) / 2).toBeCloseTo(0, 6);
    expect(flat.max.x - flat.min.x).toBeCloseTo(2 * SHORE_RADIUS, 6);
    expect(flat.max.y).toBeCloseTo(0, 6);
    // On ring 3: its tiles are 5.2 to 6 from the center.
    expect(SHORE_RADIUS).toBeGreaterThanOrEqual(5.2);
    expect(SHORE_RADIUS).toBeLessThanOrEqual(6);
  });

  it("the outlines of the 19 plots in one mesh, cream and half transparent, just above the ground", () => {
    const island = createIsland(fitIsland(islandModel()));
    const outline = island.getObjectByName("plot-outlines") as THREE.Mesh;
    // A hexagonal ring of one segment has 14 vertices.
    expect(outline.geometry.getAttribute("position").count).toBe(19 * 14);
    const m = outline.material as THREE.MeshBasicMaterial;
    expect("#" + m.color.getHexString().toUpperCase()).toBe(PLOT_OUTLINE.color);
    expect(m.opacity).toBe(PLOT_OUTLINE.opacity);
    outline.geometry.computeBoundingBox();
    expect(outline.geometry.boundingBox!.min.y).toBeGreaterThan(0);
  });

  it("no relief of the island (its pine) stands on a building plot or a raft slot", () => {
    // The island file read as the game places it: decoded, centered, scaled by fitIsland, turned by ISLAND_TURN.
    const file = `${PUBLIC}${modelUrl("island")}`;
    const bytes = readFileSync(file);
    const gltf = gltfOf(file);
    const pos = gltf.accessors[gltf.meshes[0]!.primitives[0]!.attributes.POSITION]! as Gltf["accessors"][number] & { bufferView: number };
    const view = (gltf as unknown as { bufferViews: { byteOffset?: number; byteStride?: number }[] }).bufferViews[pos.bufferView]!;
    const bin = 20 + bytes.readUInt32LE(12) + 8 + (view.byteOffset ?? 0);
    const m = gltf.nodes[0]!.matrix;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i++) {
      const at = bin + i * (view.byteStride ?? 6);
      const q = [0, 1, 2].map((k) => bytes.readInt16LE(at + 2 * k) / 32767);
      points.push(new THREE.Vector3(q[0]! * m[0]! + m[12]!, q[1]! * m[5]! + m[13]!, q[2]! * m[10]! + m[14]!));
    }
    const box = new THREE.Box3().setFromPoints(points);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = (2 * SHORE_RADIUS) / Math.max(size.x, size.z);
    const turn = new THREE.Matrix4().makeRotationY(ISLAND_TURN);
    // Above the meadow (at y = 0 in the file) stand only reliefs: today, one windswept pine.
    const reliefs = points.filter((p) => p.y > 0.02).map((p) => new THREE.Vector3((p.x - center.x) * scale, p.y * scale, (p.z - center.z) * scale).applyMatrix4(turn));
    expect(reliefs.length).toBeGreaterThan(100);
    // A plot is a hexagon 2 / sqrt(3) from its center to a corner; a raft is RAFT_WIDTH wide.
    const plots = BUILDING_IDS.map(plotPosition);
    const rafts = RAFT_SLOTS.map((s) => slotPosition(s.key));
    let nearestPlot = Infinity;
    let nearestRaft = Infinity;
    for (const r of reliefs) {
      for (const p of plots) nearestPlot = Math.min(nearestPlot, Math.hypot(r.x - p.x, r.z - p.z));
      for (const p of rafts) nearestRaft = Math.min(nearestRaft, Math.hypot(r.x - p.x, r.z - p.z));
    }
    expect(nearestPlot).toBeGreaterThan(2 / Math.sqrt(3));
    expect(nearestRaft).toBeGreaterThan(RAFT_WIDTH / 2);
  });
});
