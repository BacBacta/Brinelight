import * as THREE from "three";
import { HOME, seaSite, type Fleet } from "@brinelight/shared";
import { createBoat } from "./boat.js";

/** Where a fleet is on its trip, from 0 (your city) to 1 (the site). */
export function fleetPosition(f: Fleet): number {
  if (f.phase === "stay") return 1;
  const done = Math.min(1, Math.max(0, 1 - f.left / f.travel));
  return f.phase === "out" ? done : 1 - done;
}

/** Your fleets on the sea map: a boat each, and a dotted line to where it goes. */
export function createFleetMarks(add: (o: THREE.Object3D) => void, remove: (o: THREE.Object3D) => void) {
  let marks: { key: string; boat: THREE.Group; line: THREE.Line }[] = [];

  const build = (f: Fleet) => {
    const site = seaSite(f.site)!;
    const boat = createBoat("#3D8BE0", true);
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(HOME.x, -0.2, HOME.z), new THREE.Vector3(site.x, -0.2, site.z)]);
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: f.kind === "attack" ? "#FF7A5A" : "#FFE27A", dashSize: 0.7, gapSize: 0.45, transparent: true, opacity: 0.9 }));
    line.computeLineDistances();
    add(boat);
    add(line);
    return { boat, line };
  };

  return {
    /** Places the boats; called on every frame with the current fleets. */
    place(fleets: Fleet[], now: number) {
      const keys = fleets.map((f, i) => `${i}|${f.site}|${f.kind}`);
      if (keys.join() !== marks.map((m) => m.key).join()) {
        for (const m of marks) {
          remove(m.boat);
          remove(m.line);
        }
        marks = fleets.map((f, i) => ({ key: keys[i]!, ...build(f) }));
      }
      fleets.forEach((f, i) => {
        const m = marks[i]!;
        const site = seaSite(f.site)!;
        const p = fleetPosition(f);
        const off = f.phase === "stay" ? 1.8 : 0;
        m.boat.position.set(HOME.x + (site.x - HOME.x) * p + Math.cos(now) * off, -0.3 + Math.sin(now * 3) * 0.04, HOME.z + (site.z - HOME.z) * p + Math.sin(now) * off);
        const dir = f.phase === "back" ? -1 : 1;
        m.boat.rotation.y = Math.atan2((site.x - HOME.x) * dir, (site.z - HOME.z) * dir);
      });
    },
  };
}
