/**
 * The island's life (week 8, meeting 4), checked on its pure parts and on the files the game serves: how many survivors
 * show and in which order, where they stand and walk, the parts of the survivor's body the shader moves, the plants'
 * places, the animals' (nothing leaps with reduced motion), the chimneys and lanterns found on the models, and that no
 * part of the life answers a tap.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BUILDING_IDS, RAFT_SLOTS, newPlayerState, type BuildingId } from "@brinelight/shared";
import type { PlayerState } from "../src/state/index.js";
import { CITY_MANIFEST } from "../src/scene/cityLook.js";
import { hexX, hexZ } from "../src/scene/island.js";
import { ERA_PLOTS } from "../src/city/plots.js";
import { STAGES, buildingScale, shownShape, stageName } from "../src/city/staged.js";
import { BODY, TOOLS, partOf } from "../src/city/life/body.js";
import { PEOPLE_MAX, cast, peopleShown, trailWay, trails } from "../src/city/life/cast.js";
import { PERSON_SCALE, placeOn } from "../src/city/life/people.js";
import { plantLook, plantsFor } from "../src/city/life/plants.js";
import { beachSpots, beastsAt } from "../src/city/life/creatures.js";
import { LAUNDRY, sources } from "../src/city/life/details.js";
import { untappable } from "../src/city/life/index.js";
import SPOTS from "../src/city/life/spots.json";
import LAND from "../src/city/life/land.json";
import { readGlb } from "./glb.js";

const glb = (name: string) => {
  const { scenes } = readGlb(new URL(`../public/city/${name}.glb`, import.meta.url).pathname);
  const scene = Object.values(scenes)[0]!;
  scene.updateMatrixWorld(true);
  return scene;
};
const points = (name: string) => {
  const out: THREE.Vector3[] = [];
  glb(name).traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  });
  return out;
};
/** How far from a plot's middle the island's land always reaches (assets/blender/land.py): the life stands within it. */
const ON_LAND = 1.04;
const hexReach = (x: number, z: number) => Math.max(Math.abs(x), Math.abs(x / 2 + z * 0.866), Math.abs(-x / 2 + z * 0.866));
const plot = (id: BuildingId) => ({ x: hexX(...ERA_PLOTS[id]), z: hexZ(ERA_PLOTS[id][1]) });

function city(lighthouse: number, extra: Partial<PlayerState> = {}): PlayerState {
  const base = newPlayerState() as PlayerState;
  return { ...base, buildings: Object.fromEntries(BUILDING_IDS.map((id) => [id, lighthouse])) as PlayerState["buildings"], ...extra };
}

describe("the survivors shown", () => {
  it("are min(24, 4 + survivors ÷ 5): five for a new player", () => {
    expect(peopleShown(newPlayerState().survivors)).toBe(5);
    expect([0, 26, 60, 106, 500].map(peopleShown)).toEqual([4, 9, 16, 24, 24]);
    expect(cast(newPlayerState() as PlayerState)).toHaveLength(5);
  });

  it("are the trades first, then two builders at each building site, then passers-by; the same city, the same people", () => {
    const rafts = Object.fromEntries(
      ["greenhouse", "smokehouse", "watchtower"].map((b, i) => [RAFT_SLOTS[i]!.key, { hp: 100, building: b, level: 2 }]),
    ) as PlayerState["rafts"];
    const s = city(15, { survivors: 200, rafts, queue: [{ id: "barracks", left: 10, duration: 20 }] as PlayerState["queue"] });
    const all = cast(s);
    expect(all).toHaveLength(PEOPLE_MAX);
    expect(all.map((f) => f.tool).slice(0, 6)).toEqual(["rod", "axe", "barrel", "can", "poker", "spyglass"]);
    expect(all.slice(6, 8).map((f) => [f.role, f.anim])).toEqual([
      ["builder", "hammer"],
      ["builder", "hammer"],
    ]);
    expect(all.slice(8).every((f) => f.role === "passer" && f.anim === "walk")).toBe(true);
    expect(cast(s)).toEqual(all);
    // A small city keeps its trades before anything else.
    expect(cast({ ...s, survivors: 8 }).map((f) => f.role)).toEqual(["trade", "trade", "trade", "trade", "trade"]);
  });

  it("walk the island's worn trails, on the ground, a little to the right of their middle", () => {
    const lines = trails();
    expect(lines.length).toBeGreaterThan(5);
    /** How far a point is from the nearest trail, and the ground's height there. */
    const near = (x: number, z: number) => {
      let best = { d: Infinity, y: 0 };
      for (const line of lines)
        for (let i = 0; i + 1 < line.length; i++) {
          const [[ax, ay, az], [bx, by, bz]] = [line[i]!, line[i + 1]!];
          const [dx, dz] = [bx - ax, bz - az];
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
          const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
          if (d < best.d) best = { d, y: ay + (by - ay) * t };
        }
      return best;
    };
    for (let seed = 1; seed < 30; seed++) {
      const way = trailWay(seed);
      for (let t = 0; t < 60; t += 0.7) {
        const { at } = placeOn({ role: "passer", anim: "walk", tool: null, way, turn: 0, speed: 0.16, phase: seed }, t);
        const { d, y } = near(at.x, at.z);
        expect(d, `${seed} at ${t}`).toBeLessThan(0.03);
        expect(Math.abs(at.y - y), `${seed} at ${t}`).toBeLessThan(0.03);
      }
    }
  });

  it("find the trails at every building's door: each building's front is on one, the Lighthouse's too", () => {
    const ends = trails().flatMap((line) => line.map(([x, , z]) => ({ x, z })));
    for (const id of BUILDING_IDS) {
      const front = { x: plot(id).x, z: plot(id).z + 0.72 };
      expect(Math.min(...ends.map((p) => Math.hypot(p.x - front.x, p.z - front.z))), id).toBeLessThan(0.1);
    }
    // The island the trails and the groves were laid on is the game's.
    expect((LAND as unknown as { plots: Record<string, number[]> }).plots).toEqual(Object.fromEntries(Object.entries(ERA_PLOTS).map(([k, v]) => [k, [...v]])));
  });

  it("stand off the buildings' models (drawn ×1.15), at every stage; the fisher on the Fishery's jetty", () => {
    const ray = new THREE.Raycaster();
    for (const stage of STAGES) {
      const s = city(stage, { survivors: 200, queue: BUILDING_IDS.map((id) => ({ id, left: 1, duration: 2 })) as PlayerState["queue"] });
      for (const f of cast(s).filter((x) => x.role !== "passer" && x.way[0]!.raft === null)) {
        const id = BUILDING_IDS.find((b) => Math.hypot(plot(b).x - f.way[0]!.x, plot(b).z - f.way[0]!.z) < 1)!;
        const c = plot(id);
        const model = glb(stageName(id, stage));
        model.scale.setScalar(buildingScale(id));
        model.updateMatrixWorld(true);
        const k = buildingScale(id);
        for (const at of f.way) {
          const [x, z] = [at.x - c.x, at.z - c.z];
          if (f.tool === "rod") {
            ray.set(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0));
            expect(ray.intersectObject(model, true)[0]!.point.y, `fisher at ${stage}`).toBeCloseTo(at.y, 1);
            continue;
          }
          const close = points(stageName(id, stage)).filter((v) => v.y * k > 0.03 && Math.hypot(v.x * k - x, v.z * k - z) < 0.03 * PERSON_SCALE);
          expect(close.length, `${f.tool} by ${id}-${stage} at ${x.toFixed(2)},${z.toFixed(2)}`).toBe(0);
          expect(hexReach(x, z), `${f.tool} by ${id}`).toBeLessThan(ON_LAND);
        }
      }
    }
  });
});

describe("the survivor's model", () => {
  it("has every part where the shader looks for it: legs, arms, head, hat, pack, body", () => {
    const p = points("life-survivor");
    const parts = new Map<number, THREE.Vector3[]>();
    for (const v of p) parts.set(partOf(v.x, v.y, v.z), [...(parts.get(partOf(v.x, v.y, v.z)) ?? []), v]);
    expect([...parts.keys()].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // The arms hang beside the body, the legs under it, nothing of the body strays into them.
    expect(Math.min(...parts.get(1)!.map((v) => v.x))).toBeGreaterThan(BODY.ARM_X);
    expect(Math.max(...parts.get(3)!.map((v) => v.y))).toBeLessThan(BODY.HIP);
    expect(Math.max(...parts.get(0)!.map((v) => Math.abs(v.x)))).toBeLessThan(BODY.ARM_X);
    const top = Math.max(...p.map((v) => v.y));
    expect(top).toBeGreaterThan(0.2);
    expect(top).toBeLessThan(0.23);
    expect(CITY_MANIFEST["life-survivor"]!.triangles).toBeLessThanOrEqual(200);
    expect(CITY_MANIFEST["life-survivor"]!.kB).toBeLessThanOrEqual(20);
    for (const t of TOOLS) expect(CITY_MANIFEST[`life-tool-${t}`]!.triangles, t).toBeLessThanOrEqual(60);
  });
});

describe("the plants", () => {
  it("follow the Lighthouse: wild to 9, gardens to 24, the Modern era's rows from 25", () => {
    expect([1, 9, 10, 24, 25, 30].map(plantLook)).toEqual(["wild", "wild", "garden", "garden", "modern", "modern"]);
  });

  it("keep grass and earth around each building, no tree in front of one, none on a trail; every model served", () => {
    const lines = trails();
    const offTrail = (x: number, z: number) =>
      Math.min(
        ...lines.flatMap((line) =>
          line.slice(1).map(([bx, , bz], i) => {
            const [ax, , az] = line[i]!;
            const [dx, dz] = [bx - ax, bz - az];
            const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
            return Math.hypot(x - ax - dx * t, z - az - dz * t);
          }),
        ),
      );
    for (const lighthouse of [5, 15, 30]) {
      const plants = plantsFor(lighthouse);
      expect(plants.length).toBeGreaterThan(60);
      expect(CITY_MANIFEST[`groves-${plantLook(lighthouse)}`], "groves").toBeDefined();
      for (const p of plants) {
        expect(CITY_MANIFEST[p.name], p.name).toBeDefined();
        const tree = p.name.endsWith("tree");
        for (const id of BUILDING_IDS) {
          const [x, z] = [p.x - plot(id).x, p.z - plot(id).z];
          // Its ring: 0.32 for a tree, 0.2 for a low plant, beyond the building at its widest of every era.
          const widest = Math.max(...STAGES.map((st) => shownShape(id, st).reach));
          expect(hexReach(x, z), `${p.name} by ${id}`).toBeGreaterThan(widest + (tree ? 0.32 : 0.2) - 1e-3);
          // Nothing tall between a building and the camera (it looks from +z).
          if (tree) expect(z > -0.2 && z < 2 && Math.abs(x) < 1.1, `${p.name} in front of ${id}`).toBe(false);
        }
        expect(offTrail(p.x, p.z), p.name).toBeGreaterThan(0.12 - 1e-3);
        expect(Math.hypot(p.x - LAUNDRY.x, p.z - LAUNDRY.z)).toBeGreaterThan(0.38);
      }
      expect(plantsFor(lighthouse)).toEqual(plants);
    }
  });
});

describe("the animals", () => {
  const s = city(15);
  it("gulls over the coast and on roofs, the cat on the Fishery's jetty, hens by the Shelters, crabs on the beach", () => {
    const perch = [{ x: 1, y: 1, z: 1 }];
    let landed = false;
    for (let t = 0; t < 120; t += 0.5) {
      const all = beastsAt(s, t, perch, false);
      expect(all.filter((b) => b.kind === "gull")).toHaveLength(8);
      landed ||= all.some((b) => b.kind === "gull" && b.resting && b.x === 1 && b.y === 1);
      for (const b of all.filter((x) => x.kind === "gull" && !x.resting)) expect(b.y).toBeGreaterThan(0.9);
      const hens = all.filter((b) => b.kind === "hen");
      expect(hens).toHaveLength(4);
      for (const h of hens) expect(Math.hypot(h.x - plot("shelters").x, h.z - plot("shelters").z)).toBeLessThan(ON_LAND);
    }
    expect(landed).toBe(true);
    // The crabs keep to the beaches the camera sees, off every building's plot, just above the sea (-0.42).
    expect(beachSpots()).toHaveLength(6);
    for (const b of beachSpots()) {
      expect(Math.min(...BUILDING_IDS.map((id) => hexReach(b.x - plot(id).x, b.z - plot(id).z)))).toBeGreaterThan(1.0);
      expect(b.z).toBeGreaterThan(0);
      expect(b.y).toBeGreaterThan(-0.42);
      expect(b.y).toBeLessThan(0);
    }
  });

  it("leap now and then far off, never with reduced motion; with it, nothing moves", () => {
    let leaps = 0;
    for (let t = 0; t < 60; t += 0.25) leaps += beastsAt(s, t, [], false).filter((b) => b.kind === "dolphin" || b.kind === "fish").length;
    expect(leaps).toBeGreaterThan(0);
    for (let t = 0; t < 60; t += 0.25) expect(beastsAt(s, t, [], true).some((b) => b.kind === "dolphin" || b.kind === "fish")).toBe(false);
  });
});

describe("the small details", () => {
  it("smoke from chimneys and lanterns found on served models, at the buildings' levels", () => {
    for (const name of Object.keys(SPOTS)) expect(CITY_MANIFEST[name], name).toBeDefined();
    const s = city(12);
    const found = sources(s);
    expect(found.smoke.length).toBeGreaterThan(0);
    // The Workshop era's terraced Shelters smoke from their three chimneys.
    expect(found.smoke.filter((p) => Math.hypot(p.x - plot("shelters").x, p.z - plot("shelters").z) < 1)).toHaveLength(3);
  });

  it("no part of the life answers a tap", () => {
    const mesh = untappable(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObject(mesh)).toEqual([]);
  });
});
