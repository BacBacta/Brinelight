/**
 * The island's life (week 8, meeting 4), with ?blender: its survivors at work and on their ways. Display only: it reads
 * the city, never changes it, and is never what a tap lands on. Its models are fetched after the city's first image.
 */
import type * as THREE from "three";
import type { PlayerState } from "../../state/index.js";
import { reducedMotion } from "../../scene/motion.js";
import { bobAt, slotPosition } from "../rafts.js";
import { cast } from "./cast.js";
import { createPeople } from "./people.js";
import { createAnimals } from "./creatures.js";
import { createPlants } from "./plants.js";
import { createDetails } from "./details.js";

/** What of the city the life follows: when none of it changes, nobody moves elsewhere. */
const signature = (s: PlayerState) =>
  JSON.stringify([Math.floor(s.survivors / 5), s.buildings, s.queue.map((j) => j.id), Object.entries(s.rafts).map(([k, r]) => [k, r.building, r.level, r.hp > 0]), s.yard && ("slot" in s.yard ? s.yard.slot : s.yard.slots)]);

/** The life is never what a tap lands on (owner): nothing of it answers a ray. */
export function untappable(o: THREE.Object3D): THREE.Object3D {
  o.raycast = () => {};
  return o;
}

export function createLife(scene: (o: THREE.Object3D) => void) {
  const add = (o: THREE.Object3D) => scene(untappable(o));
  const people = createPeople(add);
  const animals = createAnimals(add);
  const plants = createPlants(add);
  const details = createDetails(add);
  let shown = "";
  let state: PlayerState | null = null;
  let started = false;
  const bob = (now: number) => (raft: string) => {
    const at = slotPosition(raft);
    return bobAt(at.x, at.z, now);
  };
  return {
    /** The meshes drawn (draw calls). */
    get meshes() {
      return [...people.meshes, ...animals.meshes, ...plants.meshes, ...details.meshes];
    },
    update(next: PlayerState) {
      state = next;
      animals.update(next);
      if (!started) return;
      plants.show(next.buildings.lighthouse);
      details.update(next);
      const key = signature(next);
      if (key === shown) return;
      shown = key;
      people.set(cast(next));
    },
    /** Each frame of the city: the first one starts the life (after the city's first image). */
    animate(now: number, closeness: number, camera: THREE.Camera, dimness: number) {
      if (!started) {
        started = true;
        if (state) this.update(state);
      }
      const still = reducedMotion();
      people.animate(still ? 0 : now, bob(still ? 0 : now), still, closeness > 1.15, camera);
      animals.animate(now, still, closeness > 1.15, camera);
      plants.animate(now, still);
      details.animate(now, still, dimness, bob(still ? 0 : now), camera);
    },
  };
}

export type Life = ReturnType<typeof createLife>;
