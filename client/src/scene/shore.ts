/**
 * The shore of the city's water (week 6, task 4): how far each point of the water lies from the island and from the
 * rafts moored around it, on a grid the water's shader reads to draw its foam. Built on the CPU from the island's
 * triangles (no extra render pass, no texture file), and built again only when the moored rafts change.
 */
import * as THREE from "three";
import { SHORE, markLand, shoreDistances, type Disc } from "./shoreGrid.js";

export { SHORE, markLand, shoreDistances, type Disc } from "./shoreGrid.js";

/**
 * The cells of the grid where the island stands above the water: 1, else 0. A cell is land when some triangle of the
 * island, seen from above, covers its center at or above the water's level.
 */
export function landOf(island: THREE.Object3D, waterY: number = SHORE.waterY): Uint8Array {
  const land = new Uint8Array(SHORE.size * SHORE.size);
  island.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  island.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    const world = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) v.fromBufferAttribute(pos, k).applyMatrix4(mesh.matrixWorld).toArray(world, k * 3);
    markLand(land, world, mesh.geometry.index?.array ?? null, waterY);
  });
  return land;
}

/** The shore of an island: its land once, then its distances again whenever the discs around it change. */
export function createShore(island: THREE.Object3D, waterY: number = SHORE.waterY) {
  const land = landOf(island, waterY);
  let key: string | null = null;
  let last = new Uint8Array(0);
  let built = 0;
  return {
    /** The distances with these discs; the same array as before when they did not change. */
    distances(discs: readonly Disc[]): Uint8Array {
      const next = discs.map((s) => `${s.x.toFixed(2)},${s.z.toFixed(2)},${s.r}${s.still ? "s" : ""}`).join(";");
      if (next !== key) {
        key = next;
        last = shoreDistances(land, discs);
        built++;
      }
      return last;
    },
    /** How many times the distances were built (tests). */
    get built() {
      return built;
    },
  };
}
