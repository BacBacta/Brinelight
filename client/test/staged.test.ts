/**
 * The city remade in Blender (week 8), checked on the files the game serves (client/public/city/) and their manifest
 * (city-models.json, written by assets/blender/serve.py): what each level draws stays on its plot and under the top of
 * the Lighthouse, every level adds something, and the island leaves the rafts' rooms to the water.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BUILDING_IDS, RAFT_SLOTS, type BuildingId } from "@brinelight/shared";
import { CITY_MANIFEST } from "../src/scene/cityLook.js";
import { PLOT_ROOM, hexReach } from "../src/scene/buildings.js";
import { hexX, hexZ } from "../src/scene/island.js";
import { RAFT_FILL } from "../src/scene/coast.js";
import { PIER_SLOTS } from "../src/scene/framing.js";
import { SITE_PARTS, STAGES, groundName, hasGround, isStaged, levelShape, radarAt, shownModels, stageName, stageOf } from "../src/city/staged.js";
import { readGlb } from "./glb.js";

const file = (name: string) => new URL(`../public/city/${name}.glb`, import.meta.url).pathname;
const STAGED = BUILDING_IDS.filter(isStaged);

/** The positions (in the model's frame, its node's transform applied) of the vertices the first `count` indices draw. */
function drawn(name: string, count: number): THREE.Vector3[] {
  const { scenes } = readGlb(file(name));
  const scene = Object.values(scenes)[0]!;
  scene.updateMatrixWorld(true);
  const out: THREE.Vector3[] = [];
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    const index = mesh.geometry.index!;
    for (let i = 0; i < Math.min(count, index.count); i++) out.push(new THREE.Vector3().fromBufferAttribute(pos, index.getX(i)).applyMatrix4(mesh.matrixWorld));
  });
  return out;
}

describe("the buildings remade in Blender", () => {
  it("the Lighthouse and the Refinery are remade, at their seven stages", () => {
    expect(STAGED).toEqual(expect.arrayContaining(["lighthouse", "refinery"]));
    for (const id of STAGED) for (const s of STAGES) expect(CITY_MANIFEST[`${id}-${s}`], `${id}-${s}`).toBeDefined();
  });

  it("each level shows its stage: the highest stage at or under it", () => {
    expect([1, 4, 5, 9, 10, 14, 15, 19, 20, 24, 25, 29, 30].map(stageOf)).toEqual([1, 1, 5, 5, 10, 10, 15, 15, 20, 20, 25, 25, 30]);
  });

  for (const id of STAGED) {
    it(`${id}: every level from 1 to 30 changes what is drawn (a new stage, or one more detail)`, () => {
      for (let level = 2; level <= 30; level++) {
        const before = { stage: stageName(id, level - 1), ...levelShape(id, level - 1) };
        const now = { stage: stageName(id, level), ...levelShape(id, level) };
        expect(now.stage !== before.stage || now.indices > before.indices, `${id} level ${level}`).toBe(true);
      }
    });

    it(`${id}: at every level, what is drawn stays on its plot (reach at most ${PLOT_ROOM}), measured on the served file`, () => {
      for (let level = 1; level <= 30; level++) {
        const shape = levelShape(id, level);
        const points = drawn(stageName(id, level), shape.indices);
        const reach = Math.max(...points.map((p) => hexReach(p.x, p.z)));
        const height = Math.max(...points.map((p) => p.y));
        expect(reach, `${id} level ${level}`).toBeLessThanOrEqual(PLOT_ROOM);
        // The manifest says what the file draws (quantized positions: within a few millimeters).
        expect(Math.abs(reach - shape.reach), `${id} level ${level}`).toBeLessThan(0.01);
        expect(Math.abs(height - shape.height), `${id} level ${level}`).toBeLessThan(0.01);
        expect(Math.min(...points.map((p) => p.y)), `${id} level ${level} stands on the ground`).toBeGreaterThan(-0.02);
      }
    });
  }

  it("no building is ever taller than the Lighthouse: at each Lighthouse level, every level the others may reach", () => {
    for (let lighthouse = 1; lighthouse <= 30; lighthouse++) {
      const top = levelShape("lighthouse", lighthouse).height;
      for (const id of STAGED.filter((b) => b !== "lighthouse"))
        for (let level = 1; level <= lighthouse; level++) expect(levelShape(id, level).height, `${id} ${level} under the Lighthouse at ${lighthouse}`).toBeLessThan(top - 0.3);
    }
  });

  it("budgets: each stage at most 3,300 triangles and 180 kB, the island at most 3,000 triangles and 260 kB", () => {
    for (const id of STAGED)
      for (const s of STAGES) {
        const m = CITY_MANIFEST[`${id}-${s}`]!;
        expect(m.triangles, `${id}-${s}`).toBeLessThanOrEqual(3300);
        expect(m.kB, `${id}-${s}`).toBeLessThanOrEqual(180);
      }
    expect(CITY_MANIFEST.island!.triangles).toBeLessThanOrEqual(3000);
    expect(CITY_MANIFEST.island!.kB).toBeLessThanOrEqual(260);
  });

  it("a city fetches only the models of its buildings' current era: for a new player, then at the Lighthouse 30", () => {
    const levels = (l: number) => Object.fromEntries(BUILDING_IDS.map((id) => [id, l])) as Record<BuildingId, number>;
    const fresh = { ...levels(0), lighthouse: 1 };
    expect(shownModels({ buildings: fresh, queue: [] })).toEqual([...STAGED.filter((id) => id === "lighthouse").map((id) => `${id}-1`), "ground-1", ...SITE_PARTS]);
    expect(shownModels({ buildings: levels(30), queue: [] })).toEqual([...STAGED.map((id) => `${id}-30`), "ground-25", "lighthouse-radar"]);
    expect(shownModels({ buildings: levels(17), queue: [] })).toEqual([...STAGED.map((id) => `${id}-15`), "ground-15"]);
    // An upgrade at work: its building site, never the next era (fetched in the background once the city shows).
    expect(shownModels({ buildings: levels(19), queue: [{ id: "refinery" }] })).toEqual([...STAGED.map((id) => `${id}-15`), "ground-15", ...SITE_PARTS]);
  });

  it("the Modern Lighthouse's radar turns on its mast, within its plot and under its top; no other era has one", () => {
    const bar = drawn("lighthouse-radar", Infinity);
    const half = Math.max(...bar.map((p) => Math.hypot(p.x, p.z)));
    for (const s of STAGES) {
      const at = radarAt(s);
      if (s < 25) {
        expect(at, `lighthouse-${s}`).toBeUndefined();
        continue;
      }
      expect(at).toBeDefined();
      const [x, y, z] = at!;
      // Whatever way it points, its tips stay on the plot.
      for (let a = 0; a < 360; a += 15) expect(hexReach(x + Math.cos((a * Math.PI) / 180) * half, z + Math.sin((a * Math.PI) / 180) * half)).toBeLessThanOrEqual(PLOT_ROOM);
      expect(y + Math.max(...bar.map((p) => p.y))).toBeLessThan(levelShape("lighthouse", s).height);
    }
  });

  it("the Lighthouse's lantern is inside its lantern room, for the beams and the light", () => {
    for (const s of STAGES) {
      const m = CITY_MANIFEST[`lighthouse-${s}`]!;
      expect(m.lantern).toBeGreaterThan(1.5);
      expect(m.lantern!).toBeLessThan(m.levels[0]!.height);
    }
  });
});

describe("the island made to the grid", () => {
  const points = drawn("island", Infinity);
  const above = points.filter((p) => p.y > -0.42);
  const plots: { x: number; z: number }[] = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2) plots.push({ x: hexX(q, r), z: hexZ(r) });
  const rooms = [...RAFT_SLOTS.filter((s) => s.ring === 3).map((s) => ({ x: hexX(s.q, s.r), z: hexZ(s.r) })), ...PIER_SLOTS.map(([q, r]) => ({ x: hexX(q, r), z: hexZ(r) }))];

  it("above the water, nothing of it is in the room of a raft of ring 3 or of the pier: the rafts float on water", () => {
    for (const p of above) for (const c of rooms) expect(hexReach(p.x - c.x, p.z - c.z), `${p.x.toFixed(2)}, ${p.z.toFixed(2)}`).toBeGreaterThan(RAFT_FILL);
  });

  it("above the water, it stays within 0.12 past the plots' hexagons: its coast follows the grid", () => {
    for (const p of above) expect(Math.min(...plots.map((c) => hexReach(p.x - c.x, p.z - c.z)))).toBeLessThanOrEqual(1.12);
  });

  it("its meadow is flat at 0 and reaches past every plot's outline (1.08)", () => {
    const meadow = points.filter((p) => Math.abs(p.y) < 0.01);
    for (const c of plots)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = c.x + Math.cos(a) * 1.08;
        const z = c.z + Math.sin(a) * 1.08;
        // A meadow point no farther than the meadow's own reach: the outline lies on land everywhere.
        const inside = Math.min(...plots.map((o) => hexReach(x - o.x, z - o.z))) <= 1.08 + 1e-6;
        if (inside) expect(meadow.some((p) => Math.hypot(p.x - x, p.z - z) < 1.3)).toBe(true);
      }
  });
});

describe("the island's ground through the Lighthouse's eras", () => {
  const ERAS = [1, 5, 10, 15, 20, 25];
  const plots: { x: number; z: number }[] = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2) plots.push({ x: hexX(q, r), z: hexZ(r) });
  const rooms = [...RAFT_SLOTS.filter((s) => s.ring === 3).map((s) => ({ x: hexX(s.q, s.r), z: hexZ(s.r) })), ...PIER_SLOTS.map(([q, r]) => ({ x: hexX(q, r), z: hexZ(r) }))];

  it("one ground an era, the one of the Lighthouse's level (the Modern era's at 30)", () => {
    expect(hasGround()).toBe(true);
    expect([1, 4, 5, 9, 10, 15, 20, 24, 25, 29, 30].map(groundName)).toEqual(["ground-1", "ground-1", "ground-5", "ground-5", "ground-10", "ground-15", "ground-20", "ground-20", "ground-25", "ground-25", "ground-25"]);
  });

  for (const era of ERAS) {
    const points = drawn(`ground-${era}`, Infinity);
    it(`ground-${era}: on the island, not on the rafts' rooms, nothing standing where a building stands, low`, () => {
      for (const p of points) {
        // Within the meadow's margin past the plots (0.1), with the quays' curb (0.12).
        expect(Math.min(...plots.map((c) => hexReach(p.x - c.x, p.z - c.z)))).toBeLessThanOrEqual(1.12);
        if (p.y > -0.42) for (const c of rooms) expect(hexReach(p.x - c.x, p.z - c.z)).toBeGreaterThan(RAFT_FILL);
        // Above the paths, nothing inside a building's room on its plot.
        if (p.y > 0.03) for (const c of plots) expect(hexReach(p.x - c.x, p.z - c.z), `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`).toBeGreaterThanOrEqual(PLOT_ROOM);
        expect(p.y).toBeLessThan(0.6);
      }
    });
    it(`ground-${era}: within its budget (4,000 triangles, 200 kB)`, () => {
      expect(CITY_MANIFEST[`ground-${era}`]!.triangles).toBeLessThanOrEqual(4000);
      expect(CITY_MANIFEST[`ground-${era}`]!.kB).toBeLessThanOrEqual(200);
    });
  }
});
