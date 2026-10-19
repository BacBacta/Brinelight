import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CITY_ANGLE, CITY_FOV, CLOSE_MIN, PIER_SLOTS, SIDE_MARGIN, cityFraming, cityPoints, closeFraming, openSlots, type View } from "../src/scene/framing.js";
import { hexX, hexZ } from "../src/scene/island.js";

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

  it("never makes the island small: at its farthest (all 39 rafts), the island still spans most of the screen's width", () => {
    for (const view of PHONES) {
      const far = cityFraming(view, openSlots(30));
      const near = cityFraming(view, []);
      const shore = onScreen(view, cityPoints([]).slice(0, 36), far);
      const width = Math.max(...shore.map((p) => p.x)) - Math.min(...shore.map((p) => p.x));
      expect(width / view.width, `${view.width}`).toBeGreaterThan(0.6);
      expect(near.distance).toBeLessThan(far.distance);
    }
  });
});

describe("the close view of a building (week 8)", () => {
  for (const view of PHONES) {
    const band = { ...view, bottom: view.height * 0.45 };
    for (const b of [
      { name: "the Refinery at level 1", x: hexX(1, -1), z: hexZ(-1), height: 1.32, reach: 0.85 },
      { name: "the Lighthouse at level 30", x: 0, z: 0, height: 4.3, reach: 0.88 },
    ]) {
      it(`${b.name} at ${view.width} px: its foot and its top between the top panels and the sheet, never nearer than the pinch zoom`, () => {
        const f = closeFraming(band, b);
        expect(f.distance).toBeGreaterThanOrEqual(CLOSE_MIN);
        const points = [new THREE.Vector3(b.x, b.height, b.z)];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
          points.push(new THREE.Vector3(b.x + Math.cos(a) * b.reach, 0, b.z + Math.sin(a) * b.reach));
        }
        for (const p of onScreen(band, points, f)) {
          expect(p.y).toBeGreaterThanOrEqual(band.top - 0.5);
          expect(p.y).toBeLessThanOrEqual(band.bottom + 0.5);
          expect(p.x).toBeGreaterThanOrEqual(SIDE_MARGIN - 0.5);
          expect(p.x).toBeLessThanOrEqual(view.width - SIDE_MARGIN + 0.5);
        }
      });
    }
  }
});

