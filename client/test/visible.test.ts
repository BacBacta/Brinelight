/**
 * In the city remade in Blender, seen in the normal view, each building stays mostly in sight (owner, 19 October): at
 * least 70 % of what the camera would see of it is not hidden by the Lighthouse or a neighbor, at every era, with its
 * neighbors at their tallest. Measured on the files the game serves: the remade buildings' models at their level, the
 * others' current models at their tier's size.
 */
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { BUILDING_IDS, RAFT_SLOTS, type BuildingId } from "@brinelight/shared";
import { CITY_ANGLE, CITY_FOV, cityFraming } from "../src/scene/framing.js";
import { hexX, hexZ } from "../src/scene/island.js";
import { BUILDING_FIX, LIGHTHOUSE_FIT, TILE_FIT, normalizeBuilding } from "../src/scene/buildings.js";
import { ERA_PLOTS } from "../src/city/plots.js";
import { TIER_SCALE, tierOf } from "../src/city/tiers.js";
import { STAGES, isStaged, levelShape, stageName } from "../src/city/staged.js";
import { readGlb } from "./glb.js";
import { plantsFor } from "../src/city/life/plants.js";

/** The least share of a building the normal view must show. */
const IN_SIGHT = 0.7;
const VIEW = { width: 412, height: 915, top: 92, bottom: 840 };
const STAGED = BUILDING_IDS.filter(isStaged);

const glb = (path: string) => {
  const { scenes } = readGlb(new URL(`../public/${path}.glb`, import.meta.url).pathname);
  return Object.values(scenes)[0]!;
};
const loaded = new Map<string, THREE.Object3D>();
const once = (path: string) => {
  if (!loaded.has(path)) loaded.set(path, glb(path));
  return loaded.get(path)!;
};

/** A building as shown at a level on its plot: its stage's model drawn up to the level, or its current model at its tier's size. */
function shown(id: BuildingId, level: number): THREE.Object3D {
  const [q, r] = ERA_PLOTS[id];
  const group = new THREE.Group();
  group.position.set(hexX(q, r), 0, hexZ(r));
  if (isStaged(id)) {
    const model = once(`city/${stageName(id, level)}`).clone(true);
    const { indices } = levelShape(id, level);
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry = mesh.geometry.clone();
      mesh.geometry.setDrawRange(0, indices);
    });
    group.add(model);
  } else {
    const { object } = normalizeBuilding(once(`buildings/${id}`).clone(true), id === "lighthouse" ? LIGHTHOUSE_FIT : TILE_FIT, BUILDING_FIX[id]);
    object.scale.setScalar(TIER_SCALE[tierOf(level)]);
    group.add(object);
  }
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) mesh.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  });
  group.updateMatrixWorld(true);
  return group;
}

/** The level up to `cap` at which a building stands tallest. */
function tallest(id: BuildingId, cap: number): number {
  if (!isStaged(id)) return cap;
  let best = 1;
  for (let l = 1; l <= cap; l++) if (levelShape(id, l).height > levelShape(id, best).height) best = l;
  return best;
}

/** The normal view's camera with these rafts moored and the Lighthouse at this level. */
function camera(rafts: number, lighthouse: number): THREE.PerspectiveCamera {
  const slots = RAFT_SLOTS.slice(0, rafts).map((s) => ({ x: hexX(s.q, s.r), z: hexZ(s.r) }));
  const top = isStaged("lighthouse") ? [{ x: 0, y: levelShape("lighthouse", lighthouse).height, z: 0 }] : [];
  const { distance, target } = cityFraming(VIEW, slots, top);
  const cam = new THREE.PerspectiveCamera(CITY_FOV, VIEW.width / VIEW.height, 0.1, 400);
  cam.position.copy(target).addScaledVector(CITY_ANGLE, distance);
  cam.lookAt(target);
  cam.updateMatrixWorld();
  return cam;
}

/**
 * The share of what the camera sees of `target` (its faces turned to it and not hidden by itself, weighted by the room
 * they take on screen) that no other object hides.
 */
function inSight(target: THREE.Object3D, others: THREE.Object3D[], cam: THREE.PerspectiveCamera): number {
  const ray = new THREE.Raycaster();
  const [a, b, c, mid, dir] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const screen = (v: THREE.Vector3) => {
    const p = v.clone().project(cam);
    return new THREE.Vector2((p.x * VIEW.width) / 2, (p.y * VIEW.height) / 2);
  };
  let seen = 0;
  let total = 0;
  target.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    const index = mesh.geometry.index!;
    const end = Math.min(index.count, mesh.geometry.drawRange.count);
    for (let i = 0; i + 2 < end; i += 3) {
      a.fromBufferAttribute(pos, index.getX(i)).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(pos, index.getX(i + 1)).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(pos, index.getX(i + 2)).applyMatrix4(mesh.matrixWorld);
      mid.copy(a).add(b).add(c).divideScalar(3);
      dir.subVectors(mid, cam.position);
      // Faces seen edge on take no room; faces turned away are hidden by the building's own front, below.
      const [sa, sb, sc] = [screen(a), screen(b), screen(c)];
      const area = Math.abs((sb.x - sa.x) * (sc.y - sa.y) - (sc.x - sa.x) * (sb.y - sa.y)) / 2;
      if (area < 1e-3) continue;
      const far = dir.length();
      ray.set(cam.position, dir.normalize());
      ray.far = far - 2e-3;
      ray.near = 0;
      // Hidden by the building itself: not what the camera would see of it anyway.
      if (ray.intersectObject(target, true).length) continue;
      total += area;
      if (!ray.intersectObjects(others, true).length) seen += area;
    }
  });
  return total ? seen / total : 1;
}

describe("in the normal view, each building stays mostly in sight", () => {
  beforeAll(() => {
    for (const id of BUILDING_IDS) shown(id, 1);
  });

  for (const id of STAGED) {
    it(`${id}: at least ${IN_SIGHT * 100} % in sight at every era, with the Lighthouse and its neighbors at their tallest`, () => {
      // Each era's first and last levels.
      const levels = [...new Set(STAGES.flatMap((s, i) => [s, (STAGES[i + 1] ?? 31) - 1]))];
      const worst: string[] = [];
      for (const level of levels) {
        // The others can be no higher than the Lighthouse; the Lighthouse at its highest above a building.
        const lighthouse = id === "lighthouse" ? level : 30;
        const target = shown(id, level);
        const others = BUILDING_IDS.filter((o) => o !== id).map((o) => shown(o, tallest(o, lighthouse)));
        for (const rafts of [0, RAFT_SLOTS.length]) {
          const share = inSight(target, others, camera(rafts, lighthouse));
          worst.push(`${level}/${rafts}: ${(share * 100).toFixed(0)} %`);
          expect(share, `${id} level ${level}, ${rafts} rafts`).toBeGreaterThanOrEqual(IN_SIGHT);
        }
      }
      console.log(id, worst.join(", "));
    }, 120_000);
  }
});

describe("the island's plants (meeting 4) never hide a building", () => {
  /** The plants of a Lighthouse's look, as the game lays them. */
  const plants = (lighthouse: number) => {
    const group = new THREE.Group();
    for (const p of plantsFor(lighthouse)) {
      const model = once(`city/${p.name}`).clone(true);
      model.position.set(p.x, 0, p.z);
      model.rotation.y = p.turn;
      model.scale.setScalar(p.scale);
      group.add(model);
    }
    group.updateMatrixWorld(true);
    return group;
  };

  for (const lighthouse of [5, 15, 30]) {
    it(`Lighthouse ${lighthouse}: each building at least ${IN_SIGHT * 100} % in sight, the plants among its neighbors`, () => {
      const green = plants(lighthouse);
      const all = BUILDING_IDS.map((id) => [id, shown(id, lighthouse)] as const);
      const worst: string[] = [];
      for (const [id, target] of all) {
        if (!isStaged(id)) continue;
        const others = [...all.filter(([o]) => o !== id).map(([, o]) => o), green];
        const share = inSight(target, others, camera(RAFT_SLOTS.length, lighthouse));
        worst.push(`${id} ${(share * 100).toFixed(0)} %`);
        expect(share, `${id} at ${lighthouse}`).toBeGreaterThanOrEqual(IN_SIGHT);
      }
      console.log(lighthouse, worst.join(", "));
    }, 120_000);
  }
});
