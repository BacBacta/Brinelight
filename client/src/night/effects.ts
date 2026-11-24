/**
 * The Night's effects (Hold the Light, task 6.2), within the frame budget: the beam fading out to sea, a warm tint on what the beam lights, and a burst of sparks where an enemy burns (32 at most, reused; none with reduced
 * motion). Display only: the rules never read them.
 */
import * as THREE from "three";
import { night as N } from "@brinelight/shared";

/** Enemies gone since the last frame far from the coast: burned (one gone on the coast landed). */
export function burnedBetween(before: readonly N.Enemy[], after: readonly N.Enemy[]): { bearing: number; distance: number }[] {
  const still = new Set(after.map((e) => e.id));
  return before.filter((e) => !still.has(e.id) && e.distance > N.COAST_RADIUS + 0.5).map((e) => ({ bearing: e.bearing, distance: e.distance }));
}

/** The beam's wedge, its light strong at the Lighthouse and fading out to sea (vertex colors, additive: dark is clear; no fog, which would light its far end). */
export function beamWedge(inner: number, reach: number, widthDeg: number): THREE.Mesh {
  const rad = Math.PI / 180;
  const g = new THREE.RingGeometry(inner, reach, 24, 6, (90 - widthDeg / 2) * rad, widthDeg * rad).rotateX(-Math.PI / 2);
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const light = new THREE.Color(0xffe9a8);
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    const k = 0.5 * Math.pow(Math.max(0, 1 - (r - inner) / (reach - inner)), 0.8);
    colors[i * 3] = light.r * k;
    colors[i * 3 + 1] = light.g * k;
    colors[i * 3 + 2] = light.b * k;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
}

const POOL = 32;
const LIFE = 0.45;

/** Sparks where enemies burn: a pool of rings that grow and fade (additive, so fading to black hides them). */
export function createBursts(add: (o: THREE.Object3D) => void, reduced: boolean) {
  const mesh = new THREE.InstancedMesh(
    new THREE.RingGeometry(0.15, 0.4, 12).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    POOL,
  );
  mesh.frustumCulled = false;
  mesh.count = 0;
  add(mesh);
  const live: { x: number; y: number; z: number; t: number }[] = [];
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  return {
    burst(x: number, y: number, z: number, now: number) {
      if (reduced) return;
      if (live.length >= POOL) live.shift();
      live.push({ x, y, z, t: now });
    },
    update(now: number) {
      for (let i = live.length - 1; i >= 0; i--) if (now - live[i]!.t > LIFE) live.splice(i, 1);
      live.forEach((b, i) => {
        const k = (now - b.t) / LIFE;
        const s = 0.6 + 2.2 * k;
        m.makeScale(s, s, s).setPosition(b.x, b.y, b.z);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, c.setRGB(1, 0.78, 0.35).multiplyScalar(1 - k));
      });
      mesh.count = live.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    dispose() {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
  };
}
