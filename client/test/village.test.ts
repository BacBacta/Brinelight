/**
 * The floating village made in Blender (week 8, meeting 3), checked on the files the game serves: every raft fills its
 * room and no more, keeps its deck's middle for a building and its sides' middles for the walkways, and stays in the
 * budget that lets 39 of them float; every building on a raft stays on its deck, clear of the damage mark; and each slot
 * shows the right model in the Lighthouse's age.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { RAFT_BUILDING_MAX_LEVEL, RAFT_SLOTS } from "@brinelight/shared";
import { CITY_MANIFEST } from "../src/scene/cityLook.js";
import { hexReach } from "../src/scene/buildings.js";
import { RAFT_FILL } from "../src/scene/coast.js";
import { VILLAGE_AGES, VILLAGE_DECK, hasVillage, raftBuildingName, villageAge, villageModels, villageNames, villageShown } from "../src/city/village.js";
import { raftVariant } from "../src/city/rafts.js";
import { readGlb } from "./glb.js";

const file = (name: string) => new URL(`../public/city/${name}.glb`, import.meta.url).pathname;

function points(name: string): THREE.Vector3[] {
  const { scenes } = readGlb(file(name));
  const scene = Object.values(scenes)[0]!;
  scene.updateMatrixWorld(true);
  const out: THREE.Vector3[] = [];
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  });
  return out;
}

const IDS = ["greenhouse", "smokehouse", "watchtower"] as const;
const DECKS = (age: number) => ["a", "b", "c", "damaged"].map((v) => `raft-${v}-age${age}`);
/** What a building on a raft may take of its deck: its middle, clear of the front's damage mark. */
const FOOT = { x: 0.46, back: -0.47, front: 0.44 };
/** The middle a raft keeps free of its own things, for the body of a building. */
const CORE = { x: 0.4, back: -0.4, front: 0.44 };

describe("the ages of the floating village", () => {
  it("follow the Lighthouse: driftwood from 1, tarred from 10, steel from 20", () => {
    expect([1, 9, 10, 19, 20, 30].map(villageAge)).toEqual([1, 1, 10, 10, 20, 20]);
  });

  it("each slot shows its deck's variant, the damaged raft, the shipyard's raft or the free slot's buoys; a building its level", () => {
    const [a, b, c, d] = RAFT_SLOTS.slice(0, 4).map((s) => s.key) as [string, string, string, string];
    const slots = [
      { key: a, view: "raft" as const, variant: raftVariant(a) },
      { key: b, view: "damaged" as const, variant: raftVariant(b) },
      { key: c, view: "building" as const, variant: raftVariant(c) },
      { key: d, view: "free" as const, variant: raftVariant(d) },
    ];
    const rafts = { [a]: { hp: 100, building: "smokehouse" as const, level: 2 }, [b]: { hp: 20, building: "watchtower" as const, level: 3 } };
    const m = villageModels(slots, rafts, 15);
    expect(m.slots.get(a)).toBe(`raft-${"abc"[raftVariant(a)]}-age10`);
    expect([m.slots.get(b), m.slots.get(c), m.slots.get(d)]).toEqual(["raft-damaged-age10", "raft-yard-age10", "raft-free"]);
    expect([...m.buildings.entries()]).toEqual([
      [a, "smokehouse-2-age10"],
      [b, "watchtower-3-age10"],
    ]);
    expect(m.walk).toBe("raft-walk-age10");
    // What the first image waits for: only what shows, once each.
    expect(villageShown(slots, rafts, 15, true).sort()).toEqual([m.slots.get(a)!, "raft-damaged-age10", "raft-free", "raft-walk-age10", "raft-yard-age10", "smokehouse-2-age10", "watchtower-3-age10"].sort());
    expect(raftBuildingName("greenhouse", 9, 1)).toBe(`greenhouse-${RAFT_BUILDING_MAX_LEVEL}-age1`);
  });
});

describe.runIf(hasVillage())("the floating village's models", () => {
  for (const age of VILLAGE_AGES) {
    it(`age ${age}: every raft fills its room and no more, floats with its deck at ${VILLAGE_DECK}, at most 1,000 triangles (the shipyard's 1,100) and 100 kB`, () => {
      for (const name of [...DECKS(age), `raft-yard-age${age}`]) {
        const p = points(name);
        const reach = Math.max(...p.map((v) => hexReach(v.x, v.z)));
        expect(reach, name).toBeLessThanOrEqual(RAFT_FILL);
        expect(reach, name).toBeGreaterThan(RAFT_FILL - 0.08);
        expect(Math.min(...p.map((v) => v.y)), name).toBeGreaterThan(-0.02);
        // Nothing taller than a mast: a raft never looks bigger than a building of the island.
        expect(Math.max(...p.map((v) => v.y)), name).toBeLessThan(1.3);
        // The deck's top, in its middle.
        const middle = p.filter((v) => Math.hypot(v.x, v.z) < 0.15);
        expect(Math.abs(Math.max(...middle.map((v) => v.y)) - VILLAGE_DECK), name).toBeLessThan(name.includes("yard") ? 0.4 : 0.02);
        expect(CITY_MANIFEST[name]!.triangles, name).toBeLessThanOrEqual(name.includes("yard") ? 1100 : 1000);
        expect(CITY_MANIFEST[name]!.kB, name).toBeLessThanOrEqual(100);
      }
    });

    it(`age ${age}: a deck's middle stays free for a building, and the middles of its six sides for the walkways`, () => {
      for (const name of DECKS(age)) {
        const above = points(name).filter((v) => v.y > VILLAGE_DECK + 0.03);
        const inFoot = above.filter((v) => Math.abs(v.x) < CORE.x && v.z > CORE.back && v.z < CORE.front);
        expect(inFoot.length, `${name}: ${inFoot.slice(0, 3).map((v) => `${v.x.toFixed(2)},${v.z.toFixed(2)}`)}`).toBe(0);
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          const mx = Math.cos(a) * 0.8;
          const mz = Math.sin(a) * 0.8;
          expect(above.filter((v) => Math.hypot(v.x - mx, v.z - mz) < 0.16).length, `${name} side ${k}`).toBe(0);
        }
      }
    });

    it(`age ${age}: every building on a raft, at its three levels, stands on its deck's middle, clear of the damage mark, in budget`, () => {
      for (const id of IDS) {
        let before = 0;
        for (let level = 1; level <= RAFT_BUILDING_MAX_LEVEL; level++) {
          const name = raftBuildingName(id, level, age);
          const p = points(name);
          expect(Math.min(...p.map((v) => v.y)), name).toBeGreaterThan(-0.02);
          expect(Math.max(...p.map((v) => Math.abs(v.x))), name).toBeLessThanOrEqual(FOOT.x);
          expect(Math.min(...p.map((v) => v.z)), name).toBeGreaterThanOrEqual(FOOT.back);
          expect(Math.max(...p.map((v) => v.z)), name).toBeLessThanOrEqual(FOOT.front);
          expect(Math.max(...p.map((v) => v.y)), name).toBeLessThan(1.8);
          expect(CITY_MANIFEST[name]!.triangles, name).toBeLessThanOrEqual(1000);
          // Each level adds to the one before.
          expect(CITY_MANIFEST[name]!.triangles, name).toBeGreaterThan(before);
          before = CITY_MANIFEST[name]!.triangles;
        }
      }
    });

    it(`age ${age}: a walkway at most 200 triangles, the free slot's buoys at most 400; all its models are served`, () => {
      expect(CITY_MANIFEST[`raft-walk-age${age}`]!.triangles).toBeLessThanOrEqual(200);
      expect(CITY_MANIFEST["raft-free"]!.triangles).toBeLessThanOrEqual(400);
      for (const name of villageNames(age)) expect(CITY_MANIFEST[name], name).toBeDefined();
    });
  }
});
