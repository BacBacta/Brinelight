import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { RAFT_SLOTS } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { COAST_GAP, PLOT_LAND, RAFT_FILL, coastAt, plotsEdge, raftsEdge, shapeCoast } from "../src/scene/coast.js";
import { PLOT_ROOM } from "../src/scene/buildings.js";
import { hexX, hexZ } from "../src/scene/island.js";
import { fitIsland } from "../src/scene/models.js";
import { SHORE } from "../src/scene/shore.js";
import { readGlb } from "./glb.js";

const island = fitIsland(Object.values(readGlb(fileURLToPath(new URL("../public/models/island.glb", import.meta.url))).scenes)[0]!);
shapeCoast(island);
island.updateMatrixWorld(true);
const ray = new THREE.Raycaster();
/** The height of the island's surface at (x, z), or null over open water. */
const surface = (x: number, z: number) => {
  ray.set(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
  return ray.intersectObject(island, true)[0]?.point.y ?? null;
};
// Land is ground above the water; the windswept pine's crown, above the meadow, leans out over the sea and is not land.
const land = (x: number, z: number) => {
  const y = surface(x, z);
  return y !== null && y >= SHORE.waterY && y < 0.2;
};

const room = (a: number, k: number) => k / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.cos(a) / 2 + Math.sin(a) * 0.866), Math.abs(-Math.cos(a) / 2 + Math.sin(a) * 0.866));

describe("the island's coast follows the grid", () => {
  it("lies short of the rooms of the rafts of ring 3, unless a plot needs the land", () => {
    // Toward a corner of the grid (+x), the first raft room begins at 6 − RAFT_FILL.
    expect(raftsEdge(0)).toBeCloseTo(6 - RAFT_FILL, 2);
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      expect(coastAt(a), `${i * 5}°`).toBeGreaterThanOrEqual(plotsEdge(a) + PLOT_LAND - 1e-9);
      // Short of the rafts wherever the plots leave room for it.
      if (plotsEdge(a) + PLOT_LAND < raftsEdge(a) - COAST_GAP - 0.3) expect(coastAt(a), `${i * 5}°`).toBeLessThanOrEqual(raftsEdge(a) - COAST_GAP + 1e-9);
    }
  });

  it("the island's land ends there (to the precision of its model's triangles)", () => {
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const r = coastAt(a);
      expect(surface(Math.cos(a) * (r - 0.25), Math.sin(a) * (r - 0.25)) ?? -9, `${i * 5}° inside`).toBeGreaterThanOrEqual(SHORE.waterY);
      expect(land(Math.cos(a) * (r + 0.5), Math.sin(a) * (r + 0.5)), `${i * 5}° outside`).toBe(false);
    }
  });

  it("every plot of rings 0 to 2 stands on the meadow, wherever a building may stand on it", () => {
    for (let q = -2; q <= 2; q++)
      for (let r = -2; r <= 2; r++) {
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > 2) continue;
        const [x, z] = [hexX(q, r), hexZ(r)];
        for (let i = 0; i < 36; i++) {
          const a = (i / 36) * Math.PI * 2;
          const y = surface(x + Math.cos(a) * room(a, PLOT_ROOM), z + Math.sin(a) * room(a, PLOT_ROOM));
          expect(y ?? -9, `plot ${q},${r} ${i * 10}°`).toBeGreaterThan(-0.12);
        }
      }
  });

  it("a raft of ring 3 floats on water: at most a strip of its side toward the island over the beach", () => {
    for (const s of RAFT_SLOTS.filter((x) => x.ring === 3)) {
      const [x, z] = [hexX(s.q, s.r), hexZ(s.r)];
      let over = 0;
      let n = 0;
      for (let i = 0; i < 36; i++)
        for (const f of [0.25, 0.5, 0.75, 1]) {
          const a = (i / 36) * Math.PI * 2;
          n++;
          if (land(x + Math.cos(a) * room(a, RAFT_FILL) * f, z + Math.sin(a) * room(a, RAFT_FILL) * f)) over++;
        }
      expect(over / n, s.key).toBeLessThanOrEqual(0.25);
      // Its middle always on water.
      expect(land(x, z), s.key).toBe(false);
    }
  });
});
