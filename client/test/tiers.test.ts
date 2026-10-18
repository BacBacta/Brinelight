import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { BUILDING_IDS, RAFT_SLOTS, type BuildingId } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { BUILDING_FIX, LIGHTHOUSE_FIT, TILE_FIT, buildingUrl, normalizeBuilding } from "../src/scene/buildings.js";
import { lighthouseScale } from "../src/scene/lighthouse.js";
import { hexX, hexZ, type Kit } from "../src/scene/island.js";
import { plotPosition } from "../src/city/buildings.js";
import { RAFT_WIDTH, slotPosition } from "../src/city/rafts.js";
import { DETAILS, LANTERN, PLOT_ROOM, TIER_SCALE, footprintReach, hexReach, lanternGeometry, plotDetails, tierOf, type Tier } from "../src/city/tiers.js";
import { readGlb } from "./glb.js";

const PUBLIC = fileURLToPath(new URL("../public", import.meta.url));
const kit: Kit = readGlb(`${PUBLIC}/prototype/assets/phare.glb`).scenes;
/** The nine models as the game fits them to their plots. */
const models = Object.fromEntries(
  BUILDING_IDS.map((id) => [id, normalizeBuilding(Object.values(readGlb(`${PUBLIC}${buildingUrl(id)}`).scenes)[0]!, id === "lighthouse" ? LIGHTHOUSE_FIT : TILE_FIT, BUILDING_FIX[id])]),
) as Record<BuildingId, ReturnType<typeof normalizeBuilding>>;

/** A building on its plot at a tier, as the game places it: its model at its tier's size, its details, its lantern. */
function plotAt(id: BuildingId, tier: Exclude<Tier, 0>): THREE.Group {
  const plot = new THREE.Group();
  const model = models[id].object.clone(true);
  if (id === "lighthouse") {
    // The Lighthouse at its largest: as wide as its plot allows, then only taller.
    const s = lighthouseScale(Infinity);
    const w = Math.min(s, PLOT_ROOM / footprintReach(models.lighthouse.object));
    model.scale.set(w, s, w);
  } else {
    model.scale.setScalar(TIER_SCALE[tier]);
    for (const d of plotDetails(kit, tier)) plot.add(d);
    if (tier === 3) {
      const lantern = new THREE.Mesh(lanternGeometry());
      lantern.position.set(LANTERN.x, 0, LANTERN.z);
      plot.add(lantern);
    }
  }
  plot.add(model);
  return plot;
}

/** Every point of an object on a plot, on the ground (x, z), in the plot's frame. */
function footprint(plot: THREE.Object3D): THREE.Vector2[] {
  plot.updateMatrixWorld(true);
  const out: THREE.Vector2[] = [];
  const v = new THREE.Vector3();
  plot.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      out.push(new THREE.Vector2(v.x, v.z));
    }
  });
  return out;
}

describe("the three tiers of a building", () => {
  it("levels 1 to 4, 5 to 9, 10 and up; each tier a little larger", () => {
    expect([0, 1, 4, 5, 9, 10, 25].map(tierOf)).toEqual([0, 1, 1, 2, 2, 3, 3]);
    expect(TIER_SCALE[1]).toBeLessThan(TIER_SCALE[2]);
    expect(TIER_SCALE[2]).toBeLessThan(TIER_SCALE[3]);
    expect(TIER_SCALE[3]).toBe(1);
    // The second tier plants a flag; the third adds crates and a barrel (and a lantern).
    expect(DETAILS.filter((d) => d.tier === 2).map((d) => d.kit)).toEqual(["flag_blue"]);
    expect(DETAILS.filter((d) => d.tier === 3).map((d) => d.kit).sort()).toEqual(["barrel", "crate_A_big"]);
    for (const d of DETAILS) expect(kit[d.kit], d.kit).toBeDefined();
  });

  it("no building, with its flag, crates and lantern, leaves its plot or touches a neighbor plot or a raft slot, at any tier", () => {
    // The 19 plots of rings 0 to 2, the building plots among them, and the raft slots around.
    const plots: { x: number; z: number }[] = [];
    for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2) plots.push({ x: hexX(q, r), z: hexZ(r) });
    const rafts = RAFT_SLOTS.map((s) => slotPosition(s.key));
    for (const id of BUILDING_IDS) {
      const home = plotPosition(id);
      for (const tier of [1, 2, 3] as const) {
        const points = footprint(plotAt(id, tier));
        expect(points.length, id).toBeGreaterThan(100);
        let reach = 0;
        let neighbor = Infinity;
        let raft = Infinity;
        for (const p of points) {
          reach = Math.max(reach, hexReach(p.x, p.y));
          const x = p.x + home.x;
          const z = p.y + home.z;
          for (const o of plots) if (o.x !== home.x || o.z !== home.z) neighbor = Math.min(neighbor, hexReach(x - o.x, z - o.z));
          for (const o of rafts) raft = Math.min(raft, Math.hypot(x - o.x, z - o.z));
        }
        expect(reach, `${id} tier ${tier}`).toBeLessThanOrEqual(PLOT_ROOM);
        // Outside every other plot (its edge is at 1 from its center), and clear of every raft.
        expect(neighbor, `${id} tier ${tier}`).toBeGreaterThan(1);
        expect(raft, `${id} tier ${tier}`).toBeGreaterThan(RAFT_WIDTH / 2);
      }
    }
  });
});
