/**
 * What the normal view shows of the city, for the tests that check what stays in sight (visible.test.ts,
 * fabric.test.ts): the buildings as the game draws them from the files it serves, the camera as the game frames the
 * city, and the share of an object no other hides.
 */
import * as THREE from "three";
import { RAFT_SLOTS, type BuildingId } from "@brinelight/shared";
import { CITY_ANGLE, CITY_FILL, CITY_FOV, cityFraming } from "../src/scene/framing.js";
import { LAND_FROM } from "../src/city/words.js";
import { terrainCoast } from "../src/scene/terrainCoast.js";
import { hexX, hexZ } from "../src/scene/island.js";
import { ERA_PLOTS } from "../src/city/plots.js";
import { buildingScale, levelShape, stageName } from "../src/city/staged.js";
import { readGlb } from "./glb.js";

/** The least share of a building the normal view must show. */
export const IN_SIGHT = 0.7;
export const VIEW = { width: 412, height: 915, top: 92, bottom: 840 };

export const glb = (path: string) => {
  const { scenes } = readGlb(new URL(`../public/${path}.glb`, import.meta.url).pathname);
  return Object.values(scenes)[0]!;
};
const loaded = new Map<string, THREE.Object3D>();
export const once = (path: string) => {
  if (!loaded.has(path)) loaded.set(path, glb(path));
  return loaded.get(path)!;
};

/** A building as shown at a level on its plot: its stage's model drawn up to the level. */
export function shown(id: BuildingId, level: number): THREE.Object3D {
  const [q, r] = ERA_PLOTS[id];
  const group = new THREE.Group();
  group.position.set(hexX(q, r), 0, hexZ(r));
  const model = once(`city/${stageName(id, level)}`).clone(true);
  const { indices } = levelShape(id, level);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    mesh.geometry.setDrawRange(0, indices);
  });
  // Drawn larger than made, the Lighthouse excepted (staged.ts, the style pass).
  model.scale.setScalar(buildingScale(id));
  group.add(model);
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) mesh.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  });
  group.updateMatrixWorld(true);
  return group;
}

/** The level up to `cap` at which a building stands tallest. */
export function tallest(id: BuildingId, cap: number): number {
  let best = 1;
  for (let l = 1; l <= cap; l++) if (levelShape(id, l).height > levelShape(id, best).height) best = l;
  return best;
}

/** The normal view's camera with these rafts moored and the Lighthouse at this level. */
export function camera(rafts: number, lighthouse: number): THREE.PerspectiveCamera {
  const slots = RAFT_SLOTS.slice(0, rafts).map((s) => ({ x: hexX(s.q, s.r), z: hexZ(s.r) }));
  const top = [{ x: 0, y: levelShape("lighthouse", lighthouse).height * buildingScale("lighthouse"), z: 0 }];
  // From the Lighthouse 5 the rafts are land (city/land): its outline stays on screen, as the game frames it (city/index.ts).
  const edge = lighthouse >= LAND_FROM ? slots.flatMap((c) => Array.from({ length: 8 }, (_, i) => ({ x: c.x + Math.cos((i * Math.PI) / 4) * 1.25, y: 0, z: c.z + Math.sin((i * Math.PI) / 4) * 1.25 }))) : [];
  // The normal view: the city across three quarters of the screen's width (owner, after the style pass).
  const { distance, target } = cityFraming(VIEW, slots, [...top, ...edge], { share: CITY_FILL, coast: terrainCoast });
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
export function inSight(target: THREE.Object3D, others: THREE.Object3D[], cam: THREE.PerspectiveCamera): number {
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
