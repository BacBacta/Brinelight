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
import { MOOR_ASIDE, MOOR_STAKE, RAFT_AGE, RAFT_HOUSE, VILLAGE_AGES, fullName, villageNormalNames, VILLAGE_DECK, villageServed, raftBuildingName, raftMoorings, villageAge, villageModels, villageNames, villageShown } from "../src/city/village.js";
import { hexX, hexZ } from "../src/scene/island.js";
import { PLOT_ROOM } from "../src/scene/buildings.js";
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

/** Where a ray down the middle of a model first meets it. */
function deckTop(name: string): number {
  const { scenes } = readGlb(file(name));
  const scene = Object.values(scenes)[0]!;
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0.02, 10, 0.03), new THREE.Vector3(0, -1, 0));
  return ray.intersectObject(scene, true)[0]?.point.y ?? -1;
}

const IDS = ["greenhouse", "smokehouse", "watchtower"] as const;
const DECKS = (age: number) => ["a", "b", "c", "d", "damaged"].flatMap((v) => [`raft-${v}-age${age}`, `raft-${v}-age${age}-lite`]);
/** What a building on a raft may take of its deck: its middle, clear of the front's damage mark. */
const FOOT = { x: 0.46, back: -0.47, front: 0.44 };
/** The middle a raft keeps free of its own things, for the body of a building. */
const CORE = { x: 0.4, back: -0.4, front: 0.44 };

describe("the ages of the floating village", () => {
  it("follow the Lighthouse: driftwood from 1, tarred from 10, steel from 20", () => {
    expect([1, 9, 10, 19, 20, 30].map(villageAge)).toEqual([1, 1, 10, 10, 20, 20]);
  });

  it("each slot shows its deck's variant, the damaged raft, the shipyard's raft or the free slot's buoys; a building its level", () => {
    // A raft of ring 3 (moored to the shore), one of ring 4 (a walkway to its neighbor), the others anywhere.
    const a = RAFT_SLOTS.find((s) => s.ring === 3)!.key;
    const b = RAFT_SLOTS.find((s) => s.ring === 4)!.key;
    const [c, d] = RAFT_SLOTS.filter((s) => s.key !== a && s.key !== b).map((s) => s.key) as [string, string];
    const slots = [
      { key: a, view: "raft" as const, variant: raftVariant(a) },
      { key: b, view: "damaged" as const, variant: raftVariant(b) },
      { key: c, view: "building" as const, variant: raftVariant(c) },
      { key: d, view: "free" as const, variant: raftVariant(d) },
    ];
    const rafts = { [a]: { hp: 100, building: "smokehouse" as const, level: 2 }, [b]: { hp: 20, building: "watchtower" as const, level: 3 } };
    const m = villageModels(slots, rafts, 15);
    // The normal view shows the decks' light versions.
    // The rafts are of driftwood at every age (they float only before the Lighthouse 5); their buildings follow the age.
    expect(m.slots.get(a)).toBe(`raft-${"abcd"[raftVariant(a)]}-age1-lite`);
    expect([m.slots.get(b), m.slots.get(c), m.slots.get(d)]).toEqual(["raft-damaged-age1-lite", "raft-yard-age1", "raft-free"]);
    expect([...m.buildings.entries()]).toEqual([
      [a, "smokehouse-2-age10"],
      [b, "watchtower-3-age10"],
    ]);
    expect([m.walk, m.moor]).toEqual(["raft-walk-age1", "raft-moor-age1"]);
    // What the first image waits for: only what shows, once each.
    expect(villageShown(slots, rafts, 15).sort()).toEqual([m.slots.get(a)!, "raft-damaged-age1-lite", "raft-free", "raft-moor-age1", "raft-walk-age1", "raft-yard-age1", "smokehouse-2-age10", "watchtower-3-age10"].sort());
    // Without a raft of ring 3, no mooring; without one of ring 4, no walkway.
    expect(villageShown([slots[0]!], rafts, 15)).not.toContain("raft-walk-age1");
    expect(villageShown([slots[1]!], rafts, 15)).not.toContain("raft-moor-age1");
    expect(raftBuildingName("greenhouse", 9, 1)).toBe(`greenhouse-${RAFT_BUILDING_MAX_LEVEL}-age1`);
    expect([fullName("raft-a-age1-lite"), fullName("raft-yard-age1")]).toEqual(["raft-a-age1", "raft-yard-age1"]);
    // The normal view never fetches a deck's full model.
    expect(villageNormalNames(10).filter((n) => /^raft-(a|b|c|damaged)-age1$/.test(n))).toEqual([]);
  });
});

describe("the moorings of the rafts of ring 3", () => {
  const ring3 = RAFT_SLOTS.filter((s) => s.ring === 3);
  const plots: { x: number; z: number }[] = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2) plots.push({ x: hexX(q, r), z: hexZ(r) });

  it("tie every raft of ring 3, and only those, to a stake on the beach, clear of every plot's room and every raft's", () => {
    const moorings = raftMoorings(RAFT_SLOTS.map((s) => s.key));
    expect(moorings.map((m) => m.key)).toEqual(ring3.map((s) => s.key));
    for (const m of moorings) {
      // On the land (the meadow reaches 1.1 from a plot's center, island.py: LAND), past where a building stands.
      const plot = Math.min(...plots.map((p) => hexReach(m.x - p.x, m.z - p.z)));
      expect(plot, m.key).toBeLessThan(1.1 - 0.05);
      expect(plot, m.key).toBeGreaterThan(PLOT_ROOM);
      for (const s of RAFT_SLOTS) expect(hexReach(m.x - hexX(s.q, s.r), m.z - hexZ(s.r)), `${m.key} by ${s.key}`).toBeGreaterThan(RAFT_FILL);
    }
  });

  it("run their rope onto their raft's rim, aside from where a walkway would land", () => {
    for (const m of raftMoorings(ring3.map((s) => s.key))) {
      const s = ring3.find((x) => x.key === m.key)!;
      const length = MOOR_STAKE - 0.8 + 0.03;
      const [ex, ez] = [m.x + Math.sin(m.turn) * length - hexX(s.q, s.r), m.z + Math.cos(m.turn) * length - hexZ(s.r)];
      expect(hexReach(ex, ez), m.key).toBeGreaterThan(0.7);
      expect(hexReach(ex, ez), m.key).toBeLessThan(0.8);
      expect(Math.hypot(ex, ez), m.key).toBeGreaterThan(Math.hypot(0.8, MOOR_ASIDE) - 0.1);
    }
  });
});

describe.runIf(villageServed())("the floating village's models", () => {
  // The rafts' own models: of driftwood only (RAFT_AGE).
  {
    const age = RAFT_AGE;
    it(`age ${age}: every raft fills its room and no more, floats with its deck at ${VILLAGE_DECK}, at most 1,000 triangles (the shipyard's 1,100) and 100 kB`, () => {
      for (const name of [...DECKS(age), `raft-yard-age${age}`]) {
        const p = points(name);
        const reach = Math.max(...p.map((v) => hexReach(v.x, v.z)));
        expect(reach, name).toBeLessThanOrEqual(RAFT_FILL);
        expect(reach, name).toBeGreaterThan(RAFT_FILL - 0.08);
        expect(Math.min(...p.map((v) => v.y)), name).toBeGreaterThan(-0.02);
        // Nothing taller than a mast: a raft never looks bigger than a building of the island.
        expect(Math.max(...p.map((v) => v.y)), name).toBeLessThan(1.3);
        // The deck's top, in its middle (the shipyard's raft has only its back half laid).
        if (!name.includes("yard")) expect(Math.abs(deckTop(name) - VILLAGE_DECK), name).toBeLessThan(0.015);
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
          const near = above.filter((v) => Math.hypot(v.x - Math.cos(a) * 0.8, v.z - Math.sin(a) * 0.8) < 0.16);
          expect(near.length, `${name} side ${k}: ${near.slice(0, 2).map((v) => `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`)}`).toBe(0);
        }
      }
    });

    it(`age ${age}: a walkway and a mooring at most 200 triangles, the free slot's buoys at most 400; all its models are served`, () => {
      expect(CITY_MANIFEST[`raft-walk-age${age}`]!.triangles).toBeLessThanOrEqual(200);
      expect(CITY_MANIFEST[`raft-moor-age${age}`]!.triangles).toBeLessThanOrEqual(200);
      // A deck's light version: at most 720 triangles, at least a fifth fewer than its full model, its lamps where its full model's are.
      for (const v of ["a", "b", "c", "d", "damaged"]) {
        const [full, light] = [CITY_MANIFEST[`raft-${v}-age${age}`]!, CITY_MANIFEST[`raft-${v}-age${age}-lite`]!];
        expect(light.triangles, v).toBeLessThanOrEqual(720);
        expect(light.triangles, v).toBeLessThan(full.triangles * 0.8);
        expect(light.lamps ?? [], v).toEqual(full.lamps ?? []);
      }
      // The mooring's rope ends on the deck's rim, under the beach.
      const end = points(`raft-moor-age${age}`).reduce((a, v) => (v.z > a.z ? v : a));
      expect(end.z).toBeCloseTo(MOOR_STAKE - 0.8 + 0.03 + 0.015, 1);
      // The rafts ride 0.2 higher with the island's sea since the style pass's cleanup (raft.py, SEA_RISE).
      expect(end.y).toBeCloseTo(-(0.62 - 0.2 - VILLAGE_DECK) + 0.02, 1);
      expect(CITY_MANIFEST["raft-free"]!.triangles).toBeLessThanOrEqual(400);
      for (const name of villageNames(age)) expect(CITY_MANIFEST[name], name).toBeDefined();
    });

    it(`age ${age}: no lamp is lit (the steel age's light was the steel rafts')`, () => {
      for (const name of DECKS(age)) expect(CITY_MANIFEST[name]!.lamps ?? [], name).toEqual([]);
    });
  }

  it("a House afloat (the Lighthouse 4) is a small driftwood cabin on its deck's middle, in budget; from the Lighthouse 5 the fabric draws it", () => {
    const a = RAFT_SLOTS.find((s) => s.ring === 3)!.key;
    const slots = [{ key: a, view: "raft" as const, variant: raftVariant(a) }];
    const rafts = { [a]: { hp: 100, building: "house" as const, level: 1 } };
    expect(villageModels(slots, rafts, 4).buildings.get(a)).toBe(RAFT_HOUSE);
    expect(villageShown(slots, rafts, 4)).toContain(RAFT_HOUSE);
    expect(villageNames(1)).toContain(RAFT_HOUSE);
    const p = points(RAFT_HOUSE);
    expect(Math.min(...p.map((v) => v.y))).toBeGreaterThan(-0.02);
    expect(Math.max(...p.map((v) => Math.abs(v.x)))).toBeLessThanOrEqual(FOOT.x);
    expect(Math.min(...p.map((v) => v.z))).toBeGreaterThanOrEqual(FOOT.back);
    expect(Math.max(...p.map((v) => v.z))).toBeLessThanOrEqual(FOOT.front);
    // Smaller than the Smokehouse's hut, the lightest building on a raft.
    expect(CITY_MANIFEST[RAFT_HOUSE]!.triangles).toBeLessThanOrEqual(CITY_MANIFEST["smokehouse-1-age1"]!.triangles);
  });

  for (const age of VILLAGE_AGES) {
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

  }
});
