import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { demoCity } from "../src/demo.js";
import { ground } from "../src/city/land/field.js";
import { landSlotsOf } from "../src/city/land/index.js";
import { runJob, type LandDone } from "../src/city/land/job.js";
import { landData, landGeometry } from "../src/city/land/mesh.js";
import { SHORE, landOf, shoreDistances } from "../src/scene/shore.js";

const L = landSlotsOf(demoCity("phare30", 0));

describe("the land built away from the display (owner, on the S22: no frame held when it changes)", () => {
  it("its normals are the ones three.js computes, so the land looks the same", () => {
    const d = landData(L);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(d.position, 3));
    g.setIndex(new THREE.BufferAttribute(d.index, 1));
    g.computeVertexNormals();
    const want = g.getAttribute("normal").array;
    let worst = 0;
    for (let k = 0; k < want.length; k++) worst = Math.max(worst, Math.abs(want[k]! - d.normal[k]!));
    expect(worst).toBeLessThan(1e-5);
  });

  it("the job gives the ground under the points asked, the landfill's stakes, and the same shore as the scene measures", () => {
    const points = new Float32Array([0, 0, 3.1, -2.2, 8, 1]);
    const done = runJob({ kind: "land", id: 1, L, mesh: true, points, waterY: -0.22 }) as LandDone;
    for (let k = 0; k < points.length; k += 2) {
      const g = ground(points[k]!, points[k + 1]!, L);
      expect(done.heights[k]).toBeCloseTo(g.y, 5);
      expect(done.heights[k + 1]).toBeCloseTo(g.depth, 5);
    }
    // The demo fills a slot: stakes all around it, on the water's side.
    expect(done.fillStakes.length).toBeGreaterThan(10);
    const mesh = new THREE.Mesh(landGeometry(done.data!));
    expect(done.grid).toEqual(landOf(mesh, -0.22));
    // The shore job measures from the grid it was last given.
    const shore = runJob({ kind: "shore", id: 2, grid: done.grid, discs: [{ x: 9, z: 0, r: 0.5 }] });
    expect(shore.kind === "shore" && shore.distances).toEqual(shoreDistances(done.grid!, [{ x: 9, z: 0, r: 0.5 }]));
    expect(SHORE.size * SHORE.size).toBe(done.grid!.length);
  });

  it("only the ground under the points when the land itself has not changed (a building put on a plot)", () => {
    const done = runJob({ kind: "land", id: 3, L, mesh: false, points: new Float32Array([1, 1]), waterY: -0.22 }) as LandDone;
    expect(done.data).toBeNull();
    expect(done.grid).toBeNull();
    expect(done.heights.length).toBe(2);
  });
});
