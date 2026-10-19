import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { BUILDING_IDS, type BuildingId } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { BUILDING_FIX, PLOT_ROOM, TILE_FIT, buildingUrl, hexReach, normalizeBuilding } from "../src/scene/buildings.js";
import { siteBox } from "../src/city/buildings.js";
import { DETAIL_LEVELS, GROWTH, PAINT, TRANSFORMATIONS, createGrowth, partGeometry, piecesAt, piecesGeometry, trianglesOf } from "../src/city/growth.js";
import { CRANE_SWING, cranePlace, craneParts, craneScale, partsGeometry, scaffoldParts } from "../src/city/site.js";
import { TIER_SCALE } from "../src/city/tiers.js";
import { readGlb } from "./glb.js";

const PUBLIC = fileURLToPath(new URL("../public", import.meta.url));
const model = (id: BuildingId) => normalizeBuilding(Object.values(readGlb(`${PUBLIC}${buildingUrl(id)}`).scenes)[0]!, TILE_FIT, BUILDING_FIX[id]);

/** The farthest any vertex of a geometry reaches from its plot's center, in hex distance (the plot's edge is at 1). */
function reach(g: THREE.BufferGeometry, m = new THREE.Matrix4()): number {
  const pos = g.getAttribute("position");
  const v = new THREE.Vector3();
  let r = 0;
  for (let i = 0; i < pos.count; i++) r = Math.max(r, hexReach(v.fromBufferAttribute(pos, i).applyMatrix4(m).x, v.z));
  return r;
}

/** The plan's list of a building (docs/tasks/week-8.md, task 1): what each level adds, as written there. */
function planList(name: string): string[] {
  const doc = readFileSync(fileURLToPath(new URL("../../docs/tasks/week-8.md", import.meta.url)), "utf8");
  const section = doc.slice(doc.indexOf(`#### ${name}\n`)).split("\n####")[0]!;
  return section
    .split("\n")
    .filter((l) => /^- (\*\*)?\d+ · /.test(l))
    .map((l) => l.replace(/^- (\*\*)?\d+ · (TRANSFORMATION:\*\* )?/, "").replace(/\*\*/g, ""));
}

describe("buildings that change with every level", () => {
  it("a small detail at every level but 1 and the transformations, which come at 5, 10, 15, 20, 25 and 30", () => {
    expect(DETAIL_LEVELS).toHaveLength(23);
    expect(TRANSFORMATIONS).toEqual([5, 10, 15, 20, 25, 30]);
    for (const id of BUILDING_IDS) {
      const g = GROWTH[id];
      if (!g) continue;
      expect(g.kinds, id).toHaveLength(6);
      expect(g.spots, id).toHaveLength(DETAIL_LEVELS.length);
      expect(piecesAt(id, 1), id).toEqual([]);
      for (let level = 2; level <= 30; level++) {
        const pieces = piecesAt(id, level);
        // One piece more than the level before, the others unchanged: nothing moves or disappears.
        expect(pieces, `${id} ${level}`).toHaveLength(level - 1);
        expect(pieces.slice(0, -1), `${id} ${level}`).toEqual(piecesAt(id, level - 1));
        expect(pieces.at(-1)!.transformation, `${id} ${level}`).toBe(level % 5 === 0);
      }
    }
  });

  it("the Refinery's 30 levels are those of the plan, level by level", () => {
    const plan = planList("Refinery");
    expect(plan).toHaveLength(30);
    expect(plan[0]).toMatch(/^the building as it is today/);
    const pieces = piecesAt("refinery", 30);
    for (const p of pieces) {
      if (p.transformation) expect(plan[p.level - 1], `level ${p.level}`).toContain(p.name);
      else expect(plan[p.level - 1], `level ${p.level}`).toBe(p.name);
    }
    // The transformations, in bold in the plan, start with what they are.
    expect(plan[4]).toMatch(/^a second tank/);
    expect(plan[29]).toMatch(/^a gantry/);
  });

  it("nothing of a building's growth leaves its plot, at any level", () => {
    for (const id of BUILDING_IDS) {
      if (!GROWTH[id]) continue;
      for (const level of [2, 5, 10, 15, 20, 25, 30]) {
        const { solid, glow } = piecesGeometry(piecesAt(id, level));
        for (const g of [solid, glow]) if (g) expect(reach(g), `${id} ${level}`).toBeLessThanOrEqual(PLOT_ROOM);
      }
    }
  });

  it("nothing floats: a detail stands on the ground or a roof, or hangs on a wall, of the building's model", () => {
    const ray = new THREE.Raycaster();
    for (const id of BUILDING_IDS) {
      const g = GROWTH[id];
      if (!g) continue;
      const object = model(id).object;
      object.updateMatrixWorld(true);
      g.spots.forEach((spot, k) => {
        const kind = g.kinds[k % g.kinds.length]!;
        const at = `${id} spot ${k} (${kind.name})`;
        expect(Boolean(spot.wall), at).toBe(kind.on === "wall");
        if (spot.wall) {
          // A wall right behind it, facing out where it faces.
          const out = new THREE.Vector3(Math.sin(spot.turn ?? 0), 0, Math.cos(spot.turn ?? 0));
          ray.set(new THREE.Vector3(spot.x, spot.y!, spot.z).addScaledVector(out, 0.1), out.clone().negate());
          const hit = ray.intersectObject(object, true)[0];
          expect(hit?.distance, at).toBeDefined();
          expect(hit!.distance, at).toBeLessThan(0.16);
        } else {
          // What is under its center: the ground, or the roof it stands on.
          ray.set(new THREE.Vector3(spot.x, 5, spot.z), new THREE.Vector3(0, -1, 0));
          const hit = ray.intersectObject(object, true)[0];
          expect(hit?.point.y ?? 0, at).toBeCloseTo(spot.y ?? 0, 1);
        }
      });
    }
  });

  it("at most 60 triangles a detail and 300 a transformation, in the palette's colors only", () => {
    for (const id of BUILDING_IDS) {
      if (!GROWTH[id]) continue;
      for (const p of piecesAt(id, 30)) expect(trianglesOf([p]), `${id} ${p.name}`).toBeLessThanOrEqual(p.transformation ? 300 : 60);
      for (const p of piecesAt(id, 30)) for (const part of p.parts) expect(PAINT[part.paint], `${id} ${p.name}`).toBeDefined();
    }
    // A shape is colored on each of its vertices, and never indexed: every shape merges with every other.
    const g = partGeometry({ shape: "cyl", at: [0, 0, 0], size: [0.2, 0.3, 0.2], paint: "copper" });
    expect(g.index).toBeNull();
    expect(g.getAttribute("color").count).toBe(g.getAttribute("position").count);
  });

  it("two meshes for the details of every building, whatever their levels", () => {
    const added: THREE.Object3D[] = [];
    const growth = createGrowth(() => ({ x: 0, z: 0 }), (o) => added.push(o));
    const all = (level: number) => Object.fromEntries(BUILDING_IDS.map((id) => [id, level])) as Record<BuildingId, number>;
    for (const level of [1, 15, 30]) growth.refresh(all(level));
    expect(added).toHaveLength(2);
    expect(added.every((o) => (o as THREE.Mesh).isMesh)).toBe(true);
  });
});

describe("the building site", () => {
  it("stays on its plot at every size, its crane at both ends of its swing and its crate at both ends of its lift", () => {
    // The crane is all boxes: one instanced box draws every part of every crane.
    expect(craneParts().every((p) => p.shape === "box")).toBe(true);
    for (const id of BUILDING_IDS) {
      if (id === "lighthouse") continue;
      const full = siteBox(model(id).object, 1);
      for (const s of new Set(Object.values(TIER_SCALE).filter((v) => v > 0))) {
        const box = { reach: full.reach * s, height: full.height * s };
        expect(reach(partsGeometry(scaffoldParts(box))), `${id} ${s}`).toBeLessThanOrEqual(PLOT_ROOM);
        const at = cranePlace(box);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(at.x, 0, at.z), new THREE.Quaternion(), new THREE.Vector3().setScalar(craneScale(box)));
        for (const angle of [-CRANE_SWING, 0, CRANE_SWING]) for (const lift of [-1, 1]) expect(reach(partsGeometry(craneParts(angle, lift)), m), `${id} ${s} crane`).toBeLessThanOrEqual(PLOT_ROOM);
      }
    }
  });
});
