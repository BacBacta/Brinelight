import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CITY_ANGLE, CITY_FOV, PIER_SLOTS, SHORE_LINE, SIDE_MARGIN, cityFraming, cityPoints, openSlots, type View } from "../src/scene/framing.js";
import { hexX, hexZ } from "../src/scene/island.js";
import { fitIsland } from "../src/scene/models.js";
import { SHORE } from "../src/scene/shore.js";
import { readGlb } from "./glb.js";

// The band between the panels, as measured on these screens (the top bar and the Mist above, the tab bar below).
const PHONES: View[] = [
  { width: 360, height: 800, top: 92, bottom: 725 },
  { width: 412, height: 915, top: 92, bottom: 840 },
];

/** Where the points land on screen with this framing. */
function onScreen(view: View, points: readonly THREE.Vector3[], f: { distance: number; target: THREE.Vector3 }) {
  const camera = new THREE.PerspectiveCamera(CITY_FOV, view.width / view.height, 0.1, 400);
  camera.position.copy(f.target).addScaledVector(CITY_ANGLE, f.distance);
  camera.lookAt(f.target);
  camera.updateMatrixWorld();
  return points.map((p) => {
    const v = p.clone().project(camera);
    return { x: ((v.x + 1) / 2) * view.width, y: ((1 - v.y) / 2) * view.height };
  });
}
const inside = (view: View, p: { x: number; y: number }) =>
  p.x >= SIDE_MARGIN - 0.01 && p.x <= view.width - SIDE_MARGIN + 0.01 && p.y >= view.top - 0.01 && p.y <= view.bottom + 0.01;

describe("the city's normal view", () => {
  const cases = [
    { name: "a new city", rafts: [] },
    { name: "six rafts on ring 3", rafts: [[3, 0], [-3, 0], [-3, 3], [0, 3], [3, -3], [-1, 3]].map(([q, r]) => ({ x: hexX(q!, r!), z: hexZ(r!) })) },
    { name: "every slot of ring 3", rafts: openSlots(1) },
    { name: "every slot of rings 3 and 4", rafts: openSlots(8) },
  ];

  it("keeps the island, the pier and every raft on screen between the panels, as close as it can", () => {
    for (const view of PHONES)
      for (const c of cases) {
        const f = cityFraming(view, c.rafts);
        const points = cityPoints(c.rafts);
        expect(onScreen(view, points, f).every((p) => inside(view, p)), `${view.width} ${c.name}`).toBe(true);
        // A little closer, something leaves the band, whatever point the camera looks at.
        const closer = { distance: f.distance * 0.97, target: f.target };
        const shifted = [-1, -0.5, 0, 0.5, 1].map((dz) => ({ ...closer, target: f.target.clone().add(new THREE.Vector3(0, 0, dz)) }));
        for (const g of shifted) expect(onScreen(view, points, g).every((p) => inside(view, p)), `${view.width} ${c.name} closer`).toBe(false);
      }
  });

  it("moves back as rafts are moored, never closer", () => {
    for (const view of PHONES) {
      const d = cases.map((c) => cityFraming(view, c.rafts).distance);
      for (let i = 1; i < d.length; i++) expect(d[i]!, `${view.width} ${cases[i]!.name}`).toBeGreaterThanOrEqual(d[i - 1]! - 0.01);
    }
  });

  it("the pier's slots are those the rules keep free of rafts", () => {
    expect(openSlots(30).some((s) => PIER_SLOTS.some(([q, r]) => s.x === hexX(q, r) && s.z === hexZ(r)))).toBe(false);
  });

  it("the shore line is where the island's model meets the water", () => {
    const island = fitIsland(Object.values(readGlb(fileURLToPath(new URL("../public/models/island.glb", import.meta.url))).scenes)[0]!);
    island.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const land = (x: number, z: number) => {
      ray.set(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
      return (ray.intersectObject(island, true)[0]?.point.y ?? -9) >= SHORE.waterY;
    };
    for (const [x, z] of SHORE_LINE) {
      const r = Math.hypot(x, z);
      // Land just inside the line, water just outside it.
      expect(land((x * (r - 0.1)) / r, (z * (r - 0.1)) / r), `${x},${z} inside`).toBe(true);
      expect(land((x * (r + 0.1)) / r, (z * (r + 0.1)) / r), `${x},${z} outside`).toBe(false);
    }
  });
});
