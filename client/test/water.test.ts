import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { SHORE, createShore, landOf, shoreDistances } from "../src/scene/shore.js";
import { QUALITY_STEPS, applyQualityStep, type QualityStep } from "../src/scene/quality.js";
import { WAVE_HEIGHT, createWater, type Water } from "../src/scene/water.js";
import { CITY_WATER } from "../src/scene/look.js";
import { ABOVE_WAVES } from "../src/sea/map.js";

const n = SHORE.size;
const cell = (2 * SHORE.extent) / n;
/** The cell under a point of the water. */
const at = (x: number, z: number) => Math.floor((z + SHORE.extent) / cell) * n + Math.floor((x + SHORE.extent) / cell);
/** A square island 4 wide, standing from y = -1 to y = 0.5: its sides cross the water. */
const squareIsland = () => {
  const box = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 4));
  box.position.y = -0.25;
  const g = new THREE.Group();
  g.add(box);
  return g;
};
const meters = (code: number) => (code / 255) * SHORE.reach;
/** Within one cell and a half (the grid's step): the distances are measured from cell to cell. */
const near = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThan(1.5 * cell);

describe("the shore the foam follows", () => {
  it("land is where the island stands above the water; distances grow from its edge, up to SHORE.reach", () => {
    const land = landOf(squareIsland());
    expect(land[at(0, 0)]).toBe(1);
    expect(land[at(1.9, 1.9)]).toBe(1);
    expect(land[at(2.2, 0)]).toBe(0);
    const d = shoreDistances(land, []);
    expect(d[at(0, 0)]).toBe(0);
    near(meters(d[at(2.5, 0)]!), 0.5);
    near(meters(d[at(3, 0)]!), 1);
    expect(meters(d[at(8, 8)]!)).toBe(SHORE.reach);
  });

  it("an island below the water is no land", () => {
    const sunk = squareIsland();
    sunk.position.y = -2;
    expect(landOf(sunk).some((v) => v === 1)).toBe(false);
  });

  it("around the rafts too; built again only when they change", () => {
    const shore = createShore(squareIsland());
    const raft = { x: 8, z: 0, r: 0.875 };
    expect(meters(shore.distances([])[at(9.2, 0)]!)).toBe(SHORE.reach);
    const d = shore.distances([raft]);
    expect(d[at(8, 0)]).toBe(0);
    near(meters(d[at(9.2, 0)]!), 0.325);
    expect(shore.built).toBe(2);
    expect(shore.distances([{ ...raft }])).toBe(d);
    expect(shore.built).toBe(2);
  });

  it("the grid covers the rafts of ring 4 (8 from the center), with their foam", () => {
    expect(SHORE.extent).toBeGreaterThan(8 + 0.875 + 1);
  });
});

describe("what each quality step keeps", () => {
  it("less at each step: pixels, shadows, then the water's reflection, ripples and moving foam", () => {
    const [s0, s1, s2] = [QUALITY_STEPS[0], QUALITY_STEPS[1], QUALITY_STEPS[2]];
    expect(s0).toMatchObject({ maxPixelRatio: 2, shadowMap: 2048, reflections: true, ripples: true, foamMoves: true });
    expect(s1).toMatchObject({ maxPixelRatio: 1, shadowMap: 1024, reflections: true, ripples: true, foamMoves: true });
    expect(s2).toMatchObject({ maxPixelRatio: 1, shadowMap: 0, reflections: false, ripples: false, foamMoves: false });
    expect(s2.waterSegments).toBeLessThan(s1.waterSegments);
  });

  it("set on the renderer, the sun and every water", () => {
    const renderer = { shadowMap: { enabled: true }, setPixelRatio: (r: number) => void (renderer.ratio = r), ratio: 0 };
    const sun = new THREE.DirectionalLight();
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const seen: unknown[] = [];
    const water = { setQuality: (s: unknown) => void seen.push(s) } as unknown as Water;
    const apply = (step: QualityStep) => applyQualityStep(renderer as unknown as THREE.WebGLRenderer, sun, step, [water, water]);
    (globalThis as { devicePixelRatio?: number }).devicePixelRatio = 3;
    apply(1);
    expect([renderer.ratio, sun.shadow.mapSize.x, sun.castShadow]).toEqual([1, 1024, true]);
    apply(2);
    expect([renderer.shadowMap.enabled, sun.castShadow]).toEqual([false, false]);
    expect(seen).toEqual([QUALITY_STEPS[1], QUALITY_STEPS[1], QUALITY_STEPS[2], QUALITY_STEPS[2]]);
    delete (globalThis as { devicePixelRatio?: number }).devicePixelRatio;
  });
});

describe("the water", () => {
  it("a coarser grid at the lowest step; no reflection before a renderer builds it", () => {
    const water = createWater(CITY_WATER);
    const segments = () => (water.mesh.geometry as THREE.PlaneGeometry).parameters.widthSegments;
    expect(segments()).toBe(QUALITY_STEPS[0].waterSegments);
    water.setQuality(QUALITY_STEPS[2]);
    expect(segments()).toBe(QUALITY_STEPS[2].waterSegments);
    expect((water.mesh.material as THREE.MeshStandardMaterial).envMap).toBeNull();
    expect(water.mesh.position.y).toBe(SHORE.waterY);
  });

  it("the sea map's sand and foam lie above the highest wave, where the waves never cross them", () => {
    expect(ABOVE_WAVES).toBeGreaterThan(SHORE.waterY + WAVE_HEIGHT + 0.03);
  });
});
