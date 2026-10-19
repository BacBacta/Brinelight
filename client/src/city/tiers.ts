/**
 * The three visual tiers of a building (week 6, task 3; docs/art-direction.md): levels 1 to 4, 5 to 9, 10 and up. Made
 * from the existing models only: the building grows a little with each tier, the second tier plants a flag from the
 * prototype's kit, the third adds a crate, a barrel and a lantern. Every detail of every building is merged into one
 * mesh, and the lanterns are one InstancedMesh: two draw calls in all, whatever the city.
 * Nothing of a building, its flag, crates or lantern leaves its plot (client/test/tiers.test.ts).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BUILDING_IDS, type BuildingId, type Buildings } from "@brinelight/shared";
import { bakeModel, kitModel, type Kit } from "../scene/index.js";
import { tierOf, type Tier } from "../scene/buildings.js";
import { GROWTH } from "./growth.js";

export { PLOT_ROOM, footprintReach, hexReach, tierOf, type Tier } from "../scene/buildings.js";

/** The size of a building at each tier, as a share of its full size (the size it has had since week 5). */
export const TIER_SCALE: Record<Tier, number> = { 0: 0, 1: 0.86, 2: 0.93, 3: 1 };

/** The details of the tiers, on the plot (its center at 0, 0; the camera looks from +z): kit model, place, size, turn. */
export const DETAILS: readonly { tier: 2 | 3; kit: string; x: number; z: number; scale: number; turn: number }[] = [
  { tier: 2, kit: "flag_blue", x: 0.5, z: -0.6, scale: 2.4, turn: Math.PI / 2 },
  { tier: 3, kit: "crate_A_big", x: -0.6, z: 0.42, scale: 1.4, turn: 0.35 },
  { tier: 3, kit: "barrel", x: -0.34, z: 0.66, scale: 1.4, turn: 0 },
];
/** The lantern of the third tier: a post and a warm light, built in code (no real light: too costly on a phone). */
export const LANTERN = { x: 0.62, z: 0.36, post: 0.46, lamp: 0.11 } as const;

/** The details of one plot at a tier, as objects placed on the plot (center at 0, 0). */
export function plotDetails(kit: Kit, tier: Tier): THREE.Object3D[] {
  return DETAILS.filter((d) => d.tier <= tier).map((d) => {
    const g = new THREE.Group();
    g.add(kitModel(kit, d.kit));
    g.position.set(d.x, 0, d.z);
    g.scale.setScalar(d.scale);
    g.rotation.y = d.turn;
    return g;
  });
}

/** The lantern's geometry, in colors: a dark post and a warm lamp (MeshBasicMaterial with vertex colors: one draw call). */
export function lanternGeometry(): THREE.BufferGeometry {
  const post = new THREE.CylinderGeometry(0.025, 0.03, LANTERN.post, 6).translate(0, LANTERN.post / 2, 0).toNonIndexed();
  const lamp = new THREE.BoxGeometry(LANTERN.lamp, LANTERN.lamp * 1.3, LANTERN.lamp).translate(0, LANTERN.post + LANTERN.lamp * 0.6, 0).toNonIndexed();
  const paint = (g: THREE.BufferGeometry, color: string) => {
    const c = new THREE.Color(color);
    g.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: g.getAttribute("position").count }, () => [c.r, c.g, c.b]).flat(), 3));
    g.deleteAttribute("uv");
    g.deleteAttribute("normal");
    return g;
  };
  return mergeGeometries([paint(post, "#3A2A1C"), paint(lamp, "#FFD24A")]);
}

/**
 * The details of every plot: one merged mesh for the flags, crates and barrels, one InstancedMesh for the lanterns.
 * `refresh` rebuilds them only when a tier changes.
 */
export function createTierDetails(kit: Kit, positionOf: (id: BuildingId) => { x: number; z: number }, add: (o: THREE.Object3D) => void) {
  let mesh: THREE.Mesh | null = null;
  let key = "";
  const lanterns = new THREE.InstancedMesh(lanternGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), BUILDING_IDS.length);
  lanterns.name = "lanterns";
  lanterns.count = 0;
  // Its shape is at the origin; its lanterns are anywhere on the island.
  lanterns.frustumCulled = false;
  add(lanterns);
  const m = new THREE.Matrix4();
  return {
    /** The Lighthouse keeps its own growth, and a building with a level-by-level growth (city/growth.ts) has its own details. */
    refresh(buildings: Buildings) {
      const tiers = BUILDING_IDS.map((id) => (id === "lighthouse" || GROWTH[id] ? 0 : tierOf(buildings[id])));
      const next = tiers.join();
      if (next === key) return;
      key = next;
      const parts: THREE.BufferGeometry[] = [];
      let material: THREE.Material | null = null;
      lanterns.count = 0;
      BUILDING_IDS.forEach((id, i) => {
        const tier = tiers[i]!;
        if (tier < 2) return;
        const { x, z } = positionOf(id);
        for (const d of plotDetails(kit, tier)) {
          d.position.x += x;
          d.position.z += z;
          const baked = bakeModel(d);
          material ??= baked.material;
          parts.push(baked.geometry);
        }
        if (tier === 3) lanterns.setMatrixAt(lanterns.count++, m.makeTranslation(x + LANTERN.x, 0, z + LANTERN.z));
      });
      lanterns.instanceMatrix.needsUpdate = true;
      if (mesh) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
        mesh = null;
      }
      if (parts.length && material) {
        mesh = new THREE.Mesh(mergeGeometries(parts), material);
        mesh.name = "tier-details";
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        add(mesh);
      }
    },
  };
}
