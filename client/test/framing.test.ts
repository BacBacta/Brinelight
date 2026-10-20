import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BUILDING_IDS } from "@brinelight/shared";
import { CITY_ANGLE, CITY_FILL, CITY_FOV, CLOSE_MIN, PIER_SLOTS, SIDE_MARGIN, buildingPoints, cityExtent, cityFraming, cityPoints, cityWidthShare, clearView, closeFraming, hiddenShare, openSlots, type View, type Volume } from "../src/scene/framing.js";
import { ERA_PLOTS } from "../src/city/plots.js";
import { isStaged, shownShape } from "../src/city/staged.js";
import { terrainCoast } from "../src/scene/terrainCoast.js";
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

describe("with ?blender, the city never spans less than three quarters of the screen's width (owner, after the style pass)", () => {
  const fill = { share: CITY_FILL, coast: terrainCoast };
  const sizes = [
    { name: "a new city", rafts: [] },
    { name: "3 rafts", rafts: openSlots(1).slice(0, 3) },
    { name: "15 rafts", rafts: openSlots(10).slice(0, 15) },
    { name: "39 rafts", rafts: openSlots(30) },
  ];
  const plots: THREE.Vector3[] = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2) plots.push(new THREE.Vector3(hexX(q, r), 0, hexZ(r)));
  // A band so short (sheets, cards and the tab bar) that the whole city would show under 75 %.
  const busy = PHONES.map((v) => ({ ...v, top: 470, bottom: v.bottom - 60 }));

  it("at 360 and 412 px, whatever the number of rafts and the panels: 75 % or more, every building in the band", () => {
    for (const view of [...PHONES, ...busy])
      for (const c of sizes) {
        const f = cityFraming(view, c.rafts, [], fill);
        expect(cityWidthShare(view, c.rafts, f, terrainCoast), `${view.width} ${view.top} ${c.name}`).toBeGreaterThanOrEqual(CITY_FILL - 0.01);
        for (const p of onScreen(view, plots, f)) {
          expect(p.y, `${view.width} ${c.name}`).toBeGreaterThanOrEqual(view.top - 0.01);
          expect(p.y, `${view.width} ${c.name}`).toBeLessThanOrEqual(view.bottom + 0.01);
        }
      }
  });

  it("the whole city's framing when it is that large already; closer when the panels would make it smaller; back as rafts are moored", () => {
    for (const view of PHONES) for (const c of sizes) expect(cityFraming(view, c.rafts, [], fill)).toEqual(cityFraming(view, c.rafts));
    for (const view of busy) {
      const before = cityFraming(view, []);
      expect(cityWidthShare(view, [], before, terrainCoast)).toBeLessThan(CITY_FILL);
      expect(cityFraming(view, [], [], fill).distance).toBeLessThan(before.distance);
      const d = sizes.map((c) => cityFraming(view, c.rafts, [], fill).distance);
      for (let i = 1; i < d.length; i++) expect(d[i]!, `${view.width} ${sizes[i]!.name}`).toBeGreaterThanOrEqual(d[i - 1]! - 0.01);
    }
  });
});

describe("with ?blender, on the owner's S22 too (384 × 699 px), no building passes under a card", () => {
  const fill = { share: CITY_FILL, coast: terrainCoast };
  // The bands main.ts measures with ?blender (360, 384 and 412 px wide): below the Tasks button, or below the cards of
  // two works under way; above the tab bar, or above the quest card.
  const screens = [
    { width: 360, height: 800, tops: [154, 202], bottoms: [725, 652] },
    { width: 384, height: 699, tops: [154, 202], bottoms: [624, 551] },
    { width: 412, height: 915, tops: [154, 202], bottoms: [840, 767] },
  ];
  const views: View[] = screens.flatMap(({ tops, bottoms, ...s }) => tops.flatMap((top) => bottoms.map((bottom) => ({ ...s, top, bottom }))));
  // Each building at its tallest and widest, whatever its level.
  const levels = Array.from({ length: 30 }, (_, i) => i + 1);
  const volumes: Volume[] = BUILDING_IDS.map((id) => {
    const [q, r] = ERA_PLOTS[id];
    const shapes = levels.map((l) => shownShape(id, l));
    return { x: hexX(q, r), z: hexZ(r), height: Math.max(...shapes.map((s) => s.height)), reach: Math.max(...shapes.map((s) => s.reach)) };
  });
  const points = volumes.flatMap(buildingPoints);
  const sizes = [
    { name: "a new city", rafts: [] },
    { name: "3 rafts", rafts: openSlots(1).slice(0, 3) },
    { name: "15 rafts", rafts: openSlots(10).slice(0, 15) },
    { name: "39 rafts", rafts: openSlots(30) },
  ];

  it("every building is made in Blender", () => {
    expect(BUILDING_IDS.every(isStaged)).toBe(true);
  });

  it("at 360, 384 and 412 px, with or without works under way and the quest card: 75 % or more, every building whole in the band", () => {
    for (const view of views)
      for (const c of sizes) {
        const f = cityFraming(view, c.rafts, points, fill);
        const label = `${view.width}×${view.height} ${view.top}-${view.bottom} ${c.name}`;
        expect(cityWidthShare(view, c.rafts, f, terrainCoast), label).toBeGreaterThanOrEqual(CITY_FILL - 0.01);
        for (const p of onScreen(view, points, f)) {
          expect(p.y, label).toBeGreaterThanOrEqual(view.top - 0.01);
          expect(p.y, label).toBeLessThanOrEqual(view.bottom + 0.01);
          expect(p.x, label).toBeGreaterThanOrEqual(0);
          expect(p.x, label).toBeLessThanOrEqual(view.width);
        }
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


describe("the close view goes around a building until nothing hides it (owner, 19 October)", () => {
  const view = { ...PHONES[1]!, bottom: PHONES[1]!.height * 0.45 };
  const lighthouse = { x: 0, z: 0, height: 4.3, reach: 0.88 };
  const eye = (f: { distance: number; target: THREE.Vector3; angle: THREE.Vector3 }) => f.target.clone().addScaledVector(f.angle, f.distance);

  it("a building nothing hides is seen from the normal view's angle", () => {
    const front = { x: hexX(0, 1), z: hexZ(1), height: 1.3, reach: 0.85 };
    const f = clearView(view, front, [lighthouse]);
    expect(f.turn).toBe(0);
    expect(f.angle.distanceTo(CITY_ANGLE)).toBeLessThan(1e-9);
  });

  it("a low building right behind the tall Lighthouse: the camera turns around it, and from there nothing hides it", () => {
    const behind = { x: hexX(1, -2), z: hexZ(-2), height: 1.3, reach: 0.85 };
    const fromFront = closeFraming(view, behind);
    expect(hiddenShare(behind, [lighthouse], fromFront.target.clone().addScaledVector(CITY_ANGLE, fromFront.distance))).toBeGreaterThan(0.3);
    const f = clearView(view, behind, [lighthouse]);
    expect(f.turn).not.toBe(0);
    expect(hiddenShare(behind, [lighthouse], eye(f))).toBe(0);
    // Still at the normal view's height above the ground, only turned around the vertical.
    expect(f.angle.y).toBeCloseTo(CITY_ANGLE.y, 9);
  });

  it("from the turned angle, its foot and its top still fit between the top panels and the sheet", () => {
    const behind = { x: hexX(1, -2), z: hexZ(-2), height: 1.3, reach: 0.85 };
    const f = clearView(view, behind, [lighthouse]);
    const camera = new THREE.PerspectiveCamera(CITY_FOV, view.width / view.height, 0.1, 400);
    camera.position.copy(eye(f));
    camera.lookAt(f.target);
    camera.updateMatrixWorld();
    for (const p of [new THREE.Vector3(behind.x, behind.height, behind.z), new THREE.Vector3(behind.x, 0, behind.z)]) {
      const v = p.project(camera);
      const y = ((1 - v.y) / 2) * view.height;
      expect(y).toBeGreaterThanOrEqual(view.top - 0.5);
      expect(y).toBeLessThanOrEqual(view.bottom + 0.5);
    }
  });
});
