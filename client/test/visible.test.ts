/**
 * In the city remade in Blender, seen in the normal view, each building stays mostly in sight (owner, 19 October): at
 * least 70 % of what the camera would see of it is not hidden by the Lighthouse or a neighbor, at every era, with its
 * neighbors at their tallest. Measured on the files the game serves: each building's model at its level.
 */
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { BUILDING_IDS, RAFT_SLOTS } from "@brinelight/shared";
import { STAGES } from "../src/city/staged.js";
import { plantLook } from "../src/city/life/plants.js";
import { IN_SIGHT, camera, inSight, once, shown, tallest } from "./sight.js";

describe("in the normal view, each building stays mostly in sight", () => {
  beforeAll(() => {
    for (const id of BUILDING_IDS) shown(id, 1);
  });

  for (const id of BUILDING_IDS) {
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

describe("the island's plants (the style pass) never hide a building", () => {
  /** The groves of a Lighthouse's look, as the game shows them: one model, laid where they stand (terrain.py). */
  const plants = (lighthouse: number) => {
    const group = new THREE.Group();
    group.add(once(`city/groves-${plantLook(lighthouse)}`).clone(true));
    group.updateMatrixWorld(true);
    return group;
  };

  for (const lighthouse of [5, 15, 30]) {
    it(`Lighthouse ${lighthouse}: each building at least ${IN_SIGHT * 100} % in sight, the plants among its neighbors`, () => {
      const green = plants(lighthouse);
      const all = BUILDING_IDS.map((id) => [id, shown(id, lighthouse)] as const);
      const worst: string[] = [];
      for (const [id, target] of all) {
        const others = [...all.filter(([o]) => o !== id).map(([, o]) => o), green];
        const share = inSight(target, others, camera(RAFT_SLOTS.length, lighthouse));
        worst.push(`${id} ${(share * 100).toFixed(0)} %`);
        expect(share, `${id} at ${lighthouse}`).toBeGreaterThanOrEqual(IN_SIGHT);
      }
      console.log(lighthouse, worst.join(", "));
    }, 120_000);
  }
});
