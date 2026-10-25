/**
 * The city fabric (owner, 21 October), checked on its pure parts and on the files the game serves: how many houses a
 * city shows, the camp's details level after level, where the pieces stand (never on a building's plot, never off
 * land), its budget (three draw calls at most and the triangles of the worst city), that nothing of it answers a tap,
 * and that each building, house and equipment stays at least 70 % in sight in the normal view.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BUILDING_IDS, RAFT_SLOTS, houseLevelCap, newPlayerState, survivorCap } from "@brinelight/shared";
import type { PlayerState } from "../src/state/index.js";
import { hexX, hexZ } from "../src/scene/island.js";
import { ERA_PLOTS } from "../src/city/plots.js";
import { LAND_FROM } from "../src/city/words.js";
import { ground, hexReach, islandDepth, landDepth, type LandSlots } from "../src/city/land/field.js";
import { landSlotsOf } from "../src/city/land/index.js";
import { LAUNDRY } from "../src/city/life/details.js";
import { AFLOAT, CAMP, HOUSE_WORTH, LAUNDRY_AT, MIN_HOUSES, eraOf, fabricPlan, housePieces, housesShown, minHouses, type FabricPlan, type Piece } from "../src/city/fabric/plan.js";
import { mergeFabric, readFabric, type FabricModels, type Merged } from "../src/city/fabric/models.js";
import { createFabric } from "../src/city/fabric/index.js";
import { SIZES } from "../src/city/fabric/sight.js";
import { FIELD_SIZE, fieldTexels } from "../src/city/fabric/paint.js";
import { BEDS, bedAt, fieldFrame, inField } from "../src/city/fabric/fields.js";
import { IN_SIGHT, camera, inSight, shown } from "./sight.js";
import { readGlb } from "./glb.js";

const NO_LAND: LandSlots = { won: [], flooded: [], filling: null, free: [] };
const models = new Map<number, FabricModels>();
const modelsOf = (era: number): FabricModels => {
  if (!models.has(era)) {
    const file = readFileSync(new URL(`../public/city/fabric-${era}.bin`, import.meta.url));
    models.set(era, readFabric(new Uint8Array(file).buffer));
  }
  return models.get(era)!;
};

/** A city at a Lighthouse level, its other buildings as high, with its first `rafts` plots won. */
function city(lighthouse: number, rafts: number, shelters = lighthouse): PlayerState {
  const s = newPlayerState();
  const buildings = Object.fromEntries(BUILDING_IDS.map((id) => [id, lighthouse])) as PlayerState["buildings"];
  return {
    ...s,
    buildings: { ...buildings, shelters },
    rafts: Object.fromEntries(RAFT_SLOTS.slice(0, rafts).map((r) => [r.key, { hp: 100, building: null, level: 0 }])),
  };
}
const landOf = (state: PlayerState): LandSlots => (state.buildings.lighthouse >= LAND_FROM ? landSlotsOf(state) : NO_LAND);
const planOf = (state: PlayerState) => fabricPlan(state, landOf(state));
/** A piece's foot, as the game sets it (fabric/index.ts). */
const heightOf = (L: LandSlots) => (p: Piece) => AFLOAT[p.model] ?? (p.model === "quay" ? 0 : ground(p.x, p.z, L).y);

/** The cities of the captures: Lighthouses 1 to 30, a few plots won, and the worst (every plot won, the Shelters at 30). */
const CITIES: [number, number][] = [
  [1, 0],
  [3, 0],
  [5, 3],
  [7, 3],
  [12, 3],
  [17, 7],
  [22, 7],
  [30, 7],
  [30, RAFT_SLOTS.length],
];
const WORST = (era: number) => city([4, 9, 14, 19, 24, 30][era]!, RAFT_SLOTS.length, 30);
/** A city with Houses (step 2) at the level its Lighthouse allows on its first `houses` plots won; the three raft buildings twice on the next six. */
function housed(lighthouse: number, rafts: number, houses: number, shelters = lighthouse): PlayerState {
  const s = city(lighthouse, rafts, shelters);
  const others = ["greenhouse", "greenhouse", "smokehouse", "smokehouse", "watchtower", "watchtower"] as const;
  const out = { ...s.rafts };
  RAFT_SLOTS.slice(0, rafts).forEach((r, i) => {
    if (i < houses) out[r.key] = { hp: 100, building: "house", level: houseLevelCap(lighthouse) };
    else if (i - houses < others.length) out[r.key] = { hp: 100, building: others[i - houses]!, level: 3 };
  });
  return { ...s, rafts: out };
}
/** The worst city with Houses of each era: every plot won, 33 Houses at their level, the six raft buildings, the Shelters at 30. */
const WORST_HOUSED = (era: number) => housed([4, 9, 14, 19, 24, 30][era]!, RAFT_SLOTS.length, RAFT_SLOTS.length - 6, 30);
/** The cities with Houses the sight test sees: a few, then every plot. */
const HOUSED: [number, number, number][] = [
  [7, 7, 1],
  [14, 10, 4],
  [22, 15, 9],
  [30, RAFT_SLOTS.length, RAFT_SLOTS.length - 6],
];

const AFLOAT_OR_PORT = new Set(["sail-boat", "motor-boat", "jetty", "quay", "rowboat"]);
const EQUIPMENT = new Set(["well", "windmill", "chimneys", "water-tower", "solar-field"]);
const HOUSES = new Set([...Object.keys(HOUSE_WORTH), "workshop"]);
const BUILT = BUILDING_IDS.map((id) => ({ id, x: hexX(...ERA_PLOTS[id]), z: hexZ(ERA_PLOTS[id][1]) }));

describe("the city fabric's plan", () => {
  it("the houses: the Shelters' room (two survivors to a house), never under the Lighthouse's minimum", () => {
    expect(MIN_HOUSES).toEqual([5, 6, 7, 8, 10, 12, 14, 16, 18, 20]);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 30].map(minHouses)).toEqual([5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 20, 20]);
    // From the first levels the city moves: one or two houses more at each Lighthouse level up to 10.
    for (let l = 1; l < 10; l++) expect(minHouses(l + 1) - minHouses(l)).toBeGreaterThanOrEqual(1);
    expect(housesShown(1, 1)).toBe(5);
    expect(housesShown(10, 1)).toBe(20);
    expect(housesShown(30, 14)).toBe(survivorCap(14) / 2);
    expect(housesShown(30, 30)).toBe(63);
    // The plan shows them all, in houses' worth.
    for (const [lh, rafts] of CITIES) {
      const plan = planOf(city(lh, rafts));
      const worth = plan.pieces.reduce((n, p) => n + (HOUSE_WORTH[p.model] ?? 0), 0);
      expect(plan.houses, `Lighthouse ${lh}`).toBe(housesShown(lh, lh));
      expect(worth, `Lighthouse ${lh}`).toBeGreaterThanOrEqual(plan.houses);
      expect(worth, `Lighthouse ${lh}`).toBeLessThanOrEqual(plan.houses + 6);
    }
  });

  it("the Houses (step 2): two pieces on each House's plot, whatever its level; they stand for the Shelters' houses down to the Lighthouse's minimum", () => {
    expect([1, 2, 3, 4, 5].map((l) => housePieces(l, 5))).toEqual([
      ["solar-house", "solar-house"],
      ["solar-house", "solar-house"],
      ["apartments", "solar-house"],
      ["apartments", "solar-house"],
      ["apartments", "apartments"],
    ]);
    expect(housePieces(5, 3)).toEqual(["row", "row"]);
    expect(housePieces(5, 1)).toEqual(["wooden", "wooden"]);
    for (const [lh, rafts, houses] of HOUSED) {
      const state = housed(lh, rafts, houses);
      const plan = planOf(state);
      const plots = RAFT_SLOTS.filter((r) => state.rafts[r.key]?.building === "house").map((r) => ({ x: hexX(r.q, r.r), z: hexZ(r.r) }));
      for (const h of plots) {
        const on = plan.pieces.filter((p) => HOUSES.has(p.model) && Math.hypot(p.x - h.x, p.z - h.z) < 0.6);
        expect(on, `a House at (${h.x.toFixed(2)}, ${h.z.toFixed(2)}), Lighthouse ${lh}`).toHaveLength(2);
      }
      // The island keeps at least the Lighthouse's minimum, and the city shows its houses.
      const worth = plan.pieces.reduce((n, p) => n + (HOUSE_WORTH[p.model] ?? 0), 0);
      expect(worth, `Lighthouse ${lh}`).toBeGreaterThanOrEqual(plan.houses);
      expect(plan.houses, `Lighthouse ${lh}`).toBeGreaterThanOrEqual(housesShown(lh, lh));
    }
    // A House's level changes its pieces.
    const one = housed(30, 10, 1);
    const at = RAFT_SLOTS[0]!;
    const at1 = { ...one, rafts: { ...one.rafts, [at.key]: { hp: 100, building: "house" as const, level: 1 } } };
    const on = (s: PlayerState) => planOf(s).pieces.filter((p) => HOUSES.has(p.model) && Math.hypot(p.x - hexX(at.q, at.r), p.z - hexZ(at.r)) < 0.6).map((p) => p.model);
    expect(on(at1)).toEqual(["solar-house", "solar-house"]);
    expect(on(one)).toEqual(["apartments", "apartments"]);
  });

  it("the camp: one small detail more at each Lighthouse level from 1 to 7, gone from the workshop era", () => {
    const campOf = (lh: number) => planOf(city(lh, 0)).pieces.filter((p) => (CAMP as readonly string[]).includes(p.model)).map((p) => p.model);
    for (let lh = 1; lh <= 7; lh++) expect(campOf(lh).sort(), `Lighthouse ${lh}`).toEqual([...CAMP.slice(0, lh)].sort());
    expect(campOf(9)).toHaveLength(CAMP.length);
    expect(campOf(10)).toEqual([]);
    expect(planOf(city(1, 0)).pieces.map((p) => p.model)).toContain("campfire");
  });

  it("the same city always gets the same fabric", () => {
    for (const [lh, rafts] of CITIES) expect(planOf(city(lh, rafts))).toEqual(planOf(city(lh, rafts)));
  });

  it("the washing by the Shelters keeps its place: no house on it", () => {
    expect(LAUNDRY_AT).toEqual(LAUNDRY);
    for (const [lh, rafts] of CITIES)
      for (const p of planOf(city(lh, rafts)).pieces.filter((p) => HOUSES.has(p.model))) expect(Math.hypot(p.x - LAUNDRY.x, p.z - LAUNDRY.z), `${p.model} at ${lh}`).toBeGreaterThan(0.4);
  });

  it("no piece stands on a building's plot, nor off land (the port's on the water by the coast)", () => {
    for (const [lh, rafts] of [...CITIES, ...[0, 1, 2, 3, 4, 5].map((e) => [[4, 9, 14, 19, 24, 30][e]!, RAFT_SLOTS.length] as [number, number])]) {
      const state = city(lh, rafts);
      const L = landOf(state);
      const plan = fabricPlan(state, L);
      for (const p of plan.pieces) {
        const label = `${p.model} (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) at Lighthouse ${lh}, ${rafts} plots`;
        // Clear of every building's hexagon (a building fills its plot to about 0.8 of its reach).
        for (const b of BUILT) expect(hexReach(p.x - b.x, p.z - b.z), `${label}, by the ${b.id}`).toBeGreaterThan(p.model === "quay" || p.model === "jetty" ? 0.85 : 0.88);
        if (AFLOAT_OR_PORT.has(p.model)) continue;
        expect(landDepth(p.x, p.z, L).depth, label).toBeGreaterThan(0);
      }
      // The boats on the water, by the coast.
      for (const p of plan.pieces.filter((p) => p.model.endsWith("-boat"))) expect(landDepth(p.x, p.z, L).depth, `${p.model} at ${lh}`).toBeLessThan(0.05);
      // The fields on plots won, the trees on land.
      for (const f of plan.fields) expect(L.won.some((w) => Math.hypot(w.x - f.x, w.z - f.z) < 0.01)).toBe(true);
      for (const t of plan.trees) expect(landDepth(t.x, t.z, L).depth, `${t.name} at ${lh}`).toBeGreaterThan(0);
    }
    // Before the land, the island only.
    for (const p of planOf(city(3, 0)).pieces.filter((p) => !AFLOAT_OR_PORT.has(p.model))) expect(islandDepth(p.x, p.z)).toBeGreaterThan(0);
  });

  it("the worst city of each era (every plot won, the Shelters at 30) shows all its houses too", () => {
    for (let era = 0; era <= 5; era++) {
      const plan = fabricPlan(WORST(era), landOf(WORST(era)));
      const worth = plan.pieces.reduce((n, p) => n + (HOUSE_WORTH[p.model] ?? 0), 0);
      expect(plan.houses, `era ${era}`).toBe(63);
      expect(worth, `era ${era}`).toBeGreaterThanOrEqual(plan.houses);
    }
  });

  it("the gardens' and the kelp's rows: inside their field's outline, on its own bed, on a plot won; varied vegetables, in several directions", () => {
    for (const lh of [9, 19, 30]) {
      const state = city(lh, RAFT_SLOTS.length);
      const plan = fabricPlan(state, landOf(state));
      const rowed = plan.fields.filter((f) => f.kind === "garden" || f.kind === "kelp");
      expect(plan.rows.length, `Lighthouse ${lh}`).toBeGreaterThan(rowed.length * 4);
      for (const row of plan.rows)
        for (const [x, z] of row.points) {
          const field = plan.fields.find((f) => Math.hypot(f.x - x, f.z - z) < 1)!;
          expect(field, `a row at (${x.toFixed(2)}, ${z.toFixed(2)})`).toBeDefined();
          const r = Math.round(field.z / 1.732);
          const frame = fieldFrame(Math.round(field.x / 2 - r / 2), r);
          expect(inField(frame, x - field.x, z - field.z, 0.05), `a row at (${x.toFixed(2)}, ${z.toFixed(2)})`).toBe(true);
          // Never on the grass between the beds.
          expect(bedAt(frame, BEDS[row.kind], x - field.x, z - field.z).depth, `a row at (${x.toFixed(2)}, ${z.toFixed(2)})`).toBeGreaterThan(0);
        }
      // Each garden's rows in more than one direction.
      for (const f of rowed.filter((f) => f.kind === "garden")) {
        const turns = plan.rows
          .filter((row) => Math.hypot(row.points[0]![0] - f.x, row.points[0]![1] - f.z) < 1)
          .map((row) => {
            const [[ax, az], [bx, bz]] = [row.points[0]!, row.points.at(-1)!];
            return Math.round(((Math.atan2(bz - az, bx - ax) + Math.PI) % Math.PI) * 4);
          });
        expect(new Set(turns).size, `the garden at (${f.x.toFixed(1)}, ${f.z.toFixed(1)})`).toBeGreaterThan(1);
      }
      if (lh === 9) expect(new Set(plan.rows.map((r) => r.color)).size).toBeGreaterThanOrEqual(4);
    }
  });

  it("a field's outline is never its plot's hexagon: it swells and narrows, and stays inside its plot", () => {
    for (let q = -4; q <= 4; q++)
      for (let r = -4; r <= 4; r++) {
        const f = fieldFrame(q, r);
        const reach = Array.from({ length: 36 }, (_, i) => {
          const a = (i * Math.PI) / 18;
          let d = 0;
          while (inField(f, d * Math.cos(a), d * Math.sin(a))) d += 0.005;
          return d;
        });
        expect(Math.max(...reach) - Math.min(...reach), `plot ${q}, ${r}`).toBeGreaterThan(0.1);
        expect(Math.max(...reach), `plot ${q}, ${r}`).toBeLessThan(0.9);
      }
  });

  it("the ground reads each plot's field in one texel: every field on its own plot's, its kind as the shader turns it back", () => {
    for (let era = 1; era <= 5; era++) {
      const plan = fabricPlan(WORST(era), landOf(WORST(era)));
      const texels = fieldTexels(plan);
      const set = [...texels].filter((v, i) => i % 4 === 0 && v > 0);
      expect(set.length, `era ${era}`).toBe(plan.fields.length);
      for (const f of plan.fields) {
        const r = Math.round(f.z / 1.732);
        const q = Math.round(f.x / 2 - r / 2);
        expect(hexX(q, r)).toBeCloseTo(f.x, 3);
        const v = texels[((r + 8) * FIELD_SIZE + q + 8) * 4]!;
        expect(Math.floor((v / 255) * (255 / 60) + 0.5)).toBe({ garden: 1, orchard: 2, kelp: 3, park: 4 }[f.kind]);
      }
    }
  });

  it("the plan's sizes of the models (what it keeps in sight) are the files'", () => {
    for (const [name, [w, d, h]] of Object.entries(SIZES)) {
      const era = [0, 1, 2, 3, 4, 5].find((e) => modelsOf(e)[name])!;
      const m = modelsOf(era)[name]!;
      let [x, z, y] = [0, 0, 0];
      for (const p of [m.body, m.windows]) if (p) for (let i = 0; i < p.position.length; i += 3) [x, y, z] = [Math.max(x, Math.abs(p.position[i]!)), Math.max(y, p.position[i + 1]!), Math.max(z, Math.abs(p.position[i + 2]!))];
      expect(Math.abs(x - w), `${name}'s width`).toBeLessThan(0.02);
      expect(Math.abs(z - d), `${name}'s depth`).toBeLessThan(0.02);
      expect(Math.abs(y - h), `${name}'s height`).toBeLessThan(0.02);
    }
  });

  it("the port keeps clear of the Harbor's pier and its boat (assets/blender/harbor.py)", () => {
    const [hq, hr] = ERA_PLOTS.harbor;
    const at = { x: hexX(hq, hr), z: hexZ(hr) };
    for (const [lh, rafts] of [...CITIES, [9, RAFT_SLOTS.length] as [number, number]]) {
      const { scenes } = readGlb(new URL(`../public/city/harbor-pier-${[1, 5, 10, 15, 20, 25, 30].filter((s) => s <= lh).at(-1)}.glb`, import.meta.url).pathname);
      const pier: { x: number; z: number }[] = [];
      const root = Object.values(scenes)[0]!;
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const pos = mesh.geometry.getAttribute("position");
        for (let i = 0; i < pos.count; i += 3) {
          const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
          pier.push({ x: v.x + at.x, z: v.z + at.z });
        }
      });
      for (const p of planOf(city(lh, rafts)).pieces.filter((p) => AFLOAT_OR_PORT.has(p.model) && p.model !== "rowboat"))
        expect(Math.min(...pier.map((q) => Math.hypot(q.x - p.x, q.z - p.z))), `${p.model} at Lighthouse ${lh}`).toBeGreaterThan(0.3);
    }
  });

  it("every model the plans use is in its era's file, the houses and equipment with their windows", () => {
    for (let era = 0; era <= 5; era++) {
      const m = modelsOf(era);
      const used = new Set(fabricPlan(WORST(era), landOf(WORST(era))).pieces.map((p) => p.model));
      for (let lh = era * 5 || 1; lh < Math.min(31, era * 5 + 5 + (era === 5 ? 1 : 0)); lh++) for (const p of planOf(city(lh, 3)).pieces) used.add(p.model);
      for (const name of used) {
        expect(m[name]?.body, `${name} in fabric-${era}`).toBeDefined();
        if (HOUSES.has(name) && name !== "tent") expect(m[name]?.windows, `${name}'s windows in fabric-${era}`).toBeDefined();
      }
      if (era >= 4) expect(m["turbine-rotor"]?.body).toBeDefined();
      for (const part of Object.values(m).flatMap((x) => [x.body, x.windows]).filter((x) => x)) {
        expect(part!.index.every((i) => i < part!.position.length / 3)).toBe(true);
        expect(part!.color.every((c) => c >= 0 && c <= 1)).toBe(true);
      }
    }
  });
});

/** The fabric's triangles drawn, at most (the worst city of each era: every plot won, the Shelters at 30). */
const TRIANGLES = 14_000;

describe("the city fabric's budget", () => {
  it(`three draw calls at most, and ${TRIANGLES.toLocaleString("en")} triangles at most in the worst city of each era`, () => {
    const seen: string[] = [];
    for (let era = 0; era <= 5; era++)
      for (const [state, label] of [
        [WORST(era), ""],
        [WORST_HOUSED(era), " with Houses"],
      ] as const) {
        const L = landOf(state);
        expect(eraOf(state.buildings.lighthouse)).toBe(era);
        const merged = mergeFabric(fabricPlan(state, L), modelsOf(era), heightOf(L));
        seen.push(`${era}${label}: ${merged.triangles}`);
        expect(merged.triangles, `era ${era}${label}`).toBeLessThanOrEqual(TRIANGLES);
        // Its indices fit the merged arrays.
        for (const m of [merged.body, merged.windows]) expect(m.index.every((i) => i < m.position.length / 3)).toBe(true);
      }
    console.log("fabric triangles, worst city by era:", seen.join(", "));
    const fabric = createFabric(() => {});
    // The body, the windows and the rotors: never more, whatever the city.
    expect(fabric.meshes.length).toBeLessThanOrEqual(3);
  });
});

describe("nothing of the fabric answers a tap", () => {
  it("its meshes are decor: a ray through them finds nothing", async () => {
    const added: THREE.Object3D[] = [];
    const fabric = createFabric((o) => added.push(o));
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      const era = /fabric-(\d)/.exec(String(url))![1];
      const file = readFileSync(new URL(`../public/city/fabric-${era}.bin`, import.meta.url));
      return new Response(new Uint8Array(file));
    }) as typeof fetch;
    try {
      fabric.update(city(24, RAFT_SLOTS.length, 30), landOf(city(24, RAFT_SLOTS.length, 30)));
      await new Promise((r) => setTimeout(r, 50));
      for (let i = 0; i < 20 && !fabric.meshes.length; i++) await new Promise((r) => setTimeout(r, 50));
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(fabric.meshes.length).toBeGreaterThanOrEqual(2);
    expect(added.length).toBeGreaterThanOrEqual(3);
    // Straight down on every house and equipment: no hit.
    const ray = new THREE.Raycaster();
    for (const p of fabric.plan!.pieces) {
      ray.set(new THREE.Vector3(p.x, 5, p.z), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObjects(added, true), p.model).toEqual([]);
    }
  });
});

/** Merged arrays as a mesh the tests can cast rays on. */
function meshOf(m: Merged): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(m.position, 3));
  g.setIndex(new THREE.BufferAttribute(m.index, 1));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  return mesh;
}
/** A plan's pieces apart: the one, and all the others (their windows with them). */
function apart(plan: FabricPlan, i: number, era: number, L: LandSlots): [THREE.Object3D, THREE.Object3D] {
  const one = mergeFabric({ ...plan, pieces: [plan.pieces[i]!], wires: [] }, modelsOf(era), heightOf(L));
  const rest = mergeFabric({ ...plan, pieces: plan.pieces.filter((_, k) => k !== i) }, modelsOf(era), heightOf(L));
  const group = (m: { body: Merged; windows: Merged }) => {
    const g = new THREE.Group();
    g.add(meshOf(m.body), meshOf(m.windows));
    g.updateMatrixWorld(true);
    return g;
  };
  return [group(one), group(rest)];
}

describe("in the normal view, the fabric hides no building and each house and equipment stays mostly in sight", () => {
  for (const [lh, rafts, houses] of [...CITIES.map(([l, r]) => [l, r, 0] as const), ...HOUSED]) {
    it(`Lighthouse ${lh}, ${rafts} plots won${houses ? `, ${houses} Houses` : ""}: each building, house and equipment at least ${IN_SIGHT * 100} % in sight`, () => {
      const state = houses ? housed(lh, rafts, houses) : city(lh, rafts);
      const L = landOf(state);
      const era = eraOf(lh);
      const plan = fabricPlan(state, L);
      const cam = camera(rafts, lh);
      // The buildings at the city's levels: the plan keeps the fabric in sight of them as they are.
      const buildings = BUILDING_IDS.map((id) => [id, shown(id, state.buildings[id])] as const);
      const all = mergeFabric(plan, modelsOf(era), heightOf(L));
      const fabric = new THREE.Group();
      fabric.add(meshOf(all.body), meshOf(all.windows));
      fabric.updateMatrixWorld(true);
      const worst: string[] = [];
      for (const [id, target] of buildings) {
        const share = inSight(target, [...buildings.filter(([o]) => o !== id).map(([, o]) => o), fabric], cam);
        worst.push(`${id} ${(share * 100).toFixed(0)}`);
        expect(share, `the ${id} at ${lh}`).toBeGreaterThanOrEqual(IN_SIGHT);
      }
      const hidden: string[] = [];
      plan.pieces.forEach((p, i) => {
        if (!HOUSES.has(p.model) && !EQUIPMENT.has(p.model)) return;
        const [one, rest] = apart(plan, i, era, L);
        const share = inSight(one, [...buildings.map(([, o]) => o), rest], cam);
        worst.push(`${p.model} ${(share * 100).toFixed(0)}`);
        if (share < IN_SIGHT) hidden.push(`${p.model} at (${p.x.toFixed(2)}, ${p.z.toFixed(2)}): ${(share * 100).toFixed(0)} %`);
      });
      console.log(lh, rafts, worst.join(", "));
      expect(hidden, `Lighthouse ${lh}, ${rafts} plots`).toEqual([]);
    }, 240_000);
  }
});
