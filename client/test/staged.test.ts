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
import { SITE_PARTS, STAGES, extraName, isStaged, levelShape, radarAt, shownModels, stageName, stageOf, terrainName } from "../src/city/staged.js";
import { ERA_PLOTS } from "../src/city/plots.js";
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

  it("budgets: each stage at most 3,300 triangles and 180 kB", () => {
    for (const id of STAGED)
      for (const s of STAGES) {
        const m = CITY_MANIFEST[`${id}-${s}`]!;
        expect(m.triangles, `${id}-${s}`).toBeLessThanOrEqual(3300);
        expect(m.kB, `${id}-${s}`).toBeLessThanOrEqual(180);
      }
  });

  it("a city fetches only the models of its buildings' current era: for a new player, then at the Lighthouse 30", () => {
    const levels = (l: number) => Object.fromEntries(BUILDING_IDS.map((id) => [id, l])) as Record<BuildingId, number>;
    const fresh = { ...levels(0), lighthouse: 1 };
    // The eras' grounds gave way to the island's terrain in three looks (the style pass), fetched with the island.
    expect(shownModels({ buildings: fresh, queue: [] })).toEqual([...STAGED.filter((id) => id === "lighthouse").map((id) => `${id}-1`), ...SITE_PARTS]);
    expect([1, 9, 10, 24, 25, 30].map(terrainName)).toEqual(["terrain-wild", "terrain-wild", "terrain-garden", "terrain-garden", "terrain-modern", "terrain-modern"]);
    for (const look of ["wild", "garden", "modern"]) {
      expect(CITY_MANIFEST[`terrain-${look}`]!.triangles).toBeLessThanOrEqual(3600);
      // Its land faces the sky: lit by the sun, not only by the light from below.
      const { scenes } = readGlb(new URL(`../public/city/terrain-${look}.glb`, import.meta.url).pathname);
      let [up, all] = [0, 0];
      Object.values(scenes)[0]!.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const pos = mesh.geometry.getAttribute("position");
        const index = mesh.geometry.index!;
        const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
        for (let i = 0; i < index.count; i += 3) {
          a.fromBufferAttribute(pos, index.getX(i));
          b.fromBufferAttribute(pos, index.getX(i + 1));
          c.fromBufferAttribute(pos, index.getX(i + 2));
          all++;
          if (b.sub(a).cross(c.sub(a)).y > 0) up++;
        }
      });
      expect(up / all, look).toBeGreaterThan(0.95);
    }
    const stagesAt = (l: number) => STAGED.flatMap((id) => [stageName(id, l), extraName(id, l) ?? []].flat());
    expect(shownModels({ buildings: levels(30), queue: [] })).toEqual([...stagesAt(30), "lighthouse-radar"]);
    expect(shownModels({ buildings: levels(17), queue: [] })).toEqual([...stagesAt(17)]);
    // An upgrade at work: its building site, never the next era (fetched in the background once the city shows).
    expect(shownModels({ buildings: levels(19), queue: [{ id: "refinery" }] })).toEqual([...stagesAt(19), ...SITE_PARTS]);
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

describe.runIf(isStaged("harbor"))("the Harbor's pier and boat lie on the water, in the slots the rules keep for them", () => {
  const [hq, hr] = ERA_PLOTS.harbor;
  const at = { x: hexX(hq, hr), z: hexZ(hr) };
  const plots: { x: number; z: number }[] = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2) plots.push({ x: hexX(q, r), z: hexZ(r) });
  const pier = PIER_SLOTS.map(([q, r]) => ({ x: hexX(q, r), z: hexZ(r) }));
  const rafts = RAFT_SLOTS.map((s) => ({ x: hexX(s.q, s.r), z: hexZ(s.r) }));
  const WATER = -0.42;

  it("the Harbor stands on the coast, by the first slot kept for its pier", () => {
    expect(Math.max(Math.abs(hq), Math.abs(hr), Math.abs(hq + hr))).toBe(2);
    expect(pier.some((c) => Math.hypot(c.x - at.x, c.z - at.z) < 2.01)).toBe(true);
  });

  for (const s of STAGES) {
    it(`harbor-pier-${s}: on its plot or in the pier's slots, never in a raft's room; past the coast, on the water`, () => {
      expect(extraName("harbor", s)).toBe(`harbor-pier-${s}`);
      const points = drawn(`harbor-pier-${s}`, Infinity).map((p) => new THREE.Vector3(p.x + at.x, p.y, p.z + at.z));
      let afloat = false;
      for (const p of points) {
        const tag = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`;
        const onPlot = hexReach(p.x - at.x, p.z - at.z) <= 1.1;
        // In a pier slot's hexagon, or crossing the edge between two of them.
        expect(onPlot || pier.some((c) => hexReach(p.x - c.x, p.z - c.z) <= 1.05), tag).toBe(true);
        for (const c of rafts) expect(hexReach(p.x - c.x, p.z - c.z), tag).toBeGreaterThan(RAFT_FILL);
        const onIsland = plots.some((c) => hexReach(p.x - c.x, p.z - c.z) <= 1.1);
        // Past the coast: nothing higher than a deck and its boat over the water, and the boat sits in it.
        if (!onIsland) expect(p.y, tag).toBeLessThan(0.4);
        if (!onIsland && p.y < WATER - 0.02) afloat = true;
      }
      expect(afloat, "a boat sits in the water").toBe(true);
    });
  }
});
