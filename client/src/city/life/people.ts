/**
 * The survivors on screen (week 8, meeting 4): one InstancedMesh for all of them, and one for each tool in hand, all
 * moved by the body's shader (body.ts). The processor only places them on their ways each frame; nearer than the normal
 * view, those off the screen are not drawn. With reduced motion, everyone stands still.
 */
import * as THREE from "three";
import { bakeModel } from "../../scene/models.js";
import { loadStage } from "../staged.js";
import { ANIM, PANTS, SHIRTS, SKINS, TOOLS, bodyMaterial, type Tool } from "./body.js";
import { PEOPLE_MAX, type Figure, type Point } from "./cast.js";

/** The survivors' size on the island: 1.5 times as made (style pass, owner: they read at the normal view's distance). */
export const PERSON_SCALE = 1.5;

const hash = (n: number) => {
  const s = Math.sin(n * 91.7 + 17.3) * 43758.5453;
  return s - Math.floor(s);
};

/** Where a figure is at `t` (seconds) on its way, walked there and back, and the way it faces. */
export function placeOn(f: Figure, t: number): { at: Point; turn: number; from: Point; to: Point; k: number } {
  const w = f.way;
  if (w.length < 2 || f.speed <= 0) return { at: w[0]!, turn: f.turn, from: w[0]!, to: w[0]!, k: 0 };
  const lengths = w.slice(1).map((p, i) => Math.hypot(p.x - w[i]!.x, p.z - w[i]!.z));
  const total = lengths.reduce((a, b) => a + b, 0);
  let s = (t * f.speed + f.phase) % (2 * total);
  const back = s > total;
  if (back) s = 2 * total - s;
  let i = 0;
  while (i < lengths.length - 1 && s > lengths[i]!) s -= lengths[i++]!;
  const [a, b] = [w[i]!, w[i + 1]!];
  const k = lengths[i]! > 0 ? Math.min(1, s / lengths[i]!) : 0;
  const at = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, raft: k < 0.5 ? a.raft : b.raft };
  const turn = Math.atan2(b.x - a.x, b.z - a.z) + (back ? Math.PI : 0);
  return { at, turn, from: a, to: b, k };
}

export function createPeople(add: (o: THREE.Object3D) => void) {
  const time = { value: 0 };
  let body: THREE.InstancedMesh | null = null;
  const tools = new Map<Tool, THREE.InstancedMesh>();
  const asked = new Set<string>();
  let figures: Figure[] = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const size = new THREE.Vector3(PERSON_SCALE, PERSON_SCALE, PERSON_SCALE);
  const p = new THREE.Vector3();
  const frustum = new THREE.Frustum();
  const sphere = new THREE.Sphere(new THREE.Vector3(), 0.2);
  const drawn: THREE.Object3D[] = [];

  const instanced = (geometry: THREE.BufferGeometry, material: THREE.Material, withTint: boolean) => {
    geometry.setAttribute("aAnim", new THREE.InstancedBufferAttribute(new Float32Array(PEOPLE_MAX), 1));
    geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(new Float32Array(PEOPLE_MAX), 1));
    if (withTint) for (const a of ["aShirt", "aPants", "aSkin"]) geometry.setAttribute(a, new THREE.InstancedBufferAttribute(new Float32Array(PEOPLE_MAX * 3), 3));
    const mesh = new THREE.InstancedMesh(geometry, material, PEOPLE_MAX);
    // Small: no shadow of their own (a shadow pass of the crowd would cost more than it shows).
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.count = 0;
    drawn.push(mesh);
    add(mesh);
    return mesh;
  };

  const fetch = (name: string, made: (model: THREE.Object3D) => void) => {
    if (asked.has(name)) return;
    asked.add(name);
    void loadStage(name).then(made);
  };

  const load = () => {
    fetch("life-survivor", (model) => {
      const { geometry, material } = bakeModel(model);
      body = instanced(geometry, bodyMaterial(material, time, false), true);
      body.name = "survivors";
    });
    for (const tool of new Set(figures.map((f) => f.tool).filter((t): t is Tool => t !== null)))
      fetch(`life-tool-${tool}`, (model) => {
        const { geometry, material } = bakeModel(model);
        const mesh = instanced(geometry, bodyMaterial(material, time, true), false);
        mesh.name = `tool-${tool}`;
        tools.set(tool, mesh);
      });
  };

  const color = new THREE.Color();
  return {
    meshes: drawn,
    /** Shows these figures (cast.ts), fetching the survivor and the tools they need the first time. */
    set(next: Figure[]) {
      figures = next;
      load();
    },
    /**
     * Places everyone at `now`: `bob(raft)` is how high that raft rides now; `still` stops every motion; `near` (zoomed
     * in) leaves out those off the screen of `camera`.
     */
    animate(now: number, bob: (raft: string) => number, still: boolean, near: boolean, camera: THREE.Camera) {
      if (!body) return;
      time.value = still ? 0 : now;
      if (near) frustum.setFromProjectionMatrix(m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const counts = new Map<Tool, number>();
      let n = 0;
      figures.forEach((f, i) => {
        const { at, turn, from, to, k } = placeOn(f, still ? 0 : now);
        const lift = (from.raft ? bob(from.raft) : 0) * (1 - k) + (to.raft ? bob(to.raft) : 0) * k;
        p.set(at.x, at.y + lift, at.z);
        if (near && !frustum.intersectsSphere(sphere.set(p, 0.2))) return;
        m4.compose(p, q.setFromAxisAngle(up, turn), size);
        const anim = f.speed > 0 && f.anim !== "carry" ? ANIM.walk : ANIM[f.anim];
        body!.setMatrixAt(n, m4);
        (body!.geometry.getAttribute("aAnim") as THREE.BufferAttribute).setX(n, anim);
        (body!.geometry.getAttribute("aPhase") as THREE.BufferAttribute).setX(n, f.phase);
        for (const [attr, list] of [["aShirt", SHIRTS], ["aPants", PANTS], ["aSkin", SKINS]] as const) {
          color.set(list[Math.floor(hash(i * 3 + attr.length) * list.length)]!);
          (body!.geometry.getAttribute(attr) as THREE.BufferAttribute).setXYZ(n, color.r, color.g, color.b);
        }
        n++;
        const mesh = f.tool && tools.get(f.tool);
        if (mesh) {
          const j = counts.get(f.tool!) ?? 0;
          counts.set(f.tool!, j + 1);
          mesh.setMatrixAt(j, m4);
          (mesh.geometry.getAttribute("aAnim") as THREE.BufferAttribute).setX(j, anim);
          (mesh.geometry.getAttribute("aPhase") as THREE.BufferAttribute).setX(j, f.phase);
        }
      });
      body.count = n;
      for (const mesh of [body, ...tools.values()]) {
        if (mesh !== body) mesh.count = counts.get([...tools.entries()].find(([, m]) => m === mesh)![0]) ?? 0;
        mesh.visible = mesh.count > 0;
        mesh.instanceMatrix.needsUpdate = true;
        for (const name of ["aAnim", "aPhase", "aShirt", "aPants", "aSkin"]) {
          const a = mesh.geometry.getAttribute(name) as THREE.BufferAttribute | undefined;
          if (a) a.needsUpdate = true;
        }
      }
    },
  };
}

