import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { normalizeBuilding, type BuildingFit } from "../src/scene/buildings.js";

/** A room the size of a tile's. */
const TILE_FIT: BuildingFit = { width: 1.6, height: 1.7 };
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

describe("a model brought to its room", () => {
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
});
