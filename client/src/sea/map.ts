import * as THREE from "three";
import { SEA_SITES, type SeaSite } from "@brinelight/shared";
import { createLighthouse, hexGeometry, kitModel, type Kit } from "../scene/index.js";
import { createBoat } from "./boat.js";

export type SeaMap = {
  /** Invisible shapes used to know which site was tapped. */
  hits: THREE.Object3D[];
  animate(now: number): void;
};

/** Every site of the sea map, with the prototype's models. */
export function createSeaMap(kit: Kit, add: (o: THREE.Object3D) => void): SeaMap {
  const sandM = new THREE.MeshStandardMaterial({ color: "#E9D9A6", roughness: 1 });
  const foamM = new THREE.MeshBasicMaterial({ color: "#fff", transparent: true, opacity: 0.5, depthWrite: false });
  const hitM = new THREE.MeshBasicMaterial({ visible: false });
  const hits: THREE.Object3D[] = [];
  const lighthouses: { lh: ReturnType<typeof createLighthouse>; x: number }[] = [];
  const rings: { ring: THREE.Object3D; x: number }[] = [];

  const islet = (g: THREE.Group) => {
    g.add(kitModel(kit, "hex_grass"));
    const sand = new THREE.Mesh(hexGeometry(1.25), sandM);
    sand.position.y = -0.38;
    g.add(sand);
    const foam = new THREE.Mesh(hexGeometry(1.45), foamM);
    foam.position.y = -0.36;
    g.add(foam);
  };
  const place = (o: THREE.Object3D, scale: number, x = 0, y = 0, z = 0) => {
    o.scale.setScalar(scale);
    o.position.set(x, y, z);
    return o;
  };
  const tower = (g: THREE.Group, s: SeaSite, opts: { gold?: boolean }, scale: number, y = 0) => {
    const lh = createLighthouse({ gold: opts.gold, light: false });
    g.add(place(lh.group, scale, 0, y));
    lighthouses.push({ lh, x: s.x });
  };

  SEA_SITES.forEach((s, i) => {
    const g = new THREE.Group();
    switch (s.kind) {
      case "grand":
        islet(g);
        g.add(kitModel(kit, "building_castle_yellow"));
        tower(g, s, { gold: true }, 1.1, 1.05);
        g.scale.setScalar(1.6);
        break;
      case "home":
        islet(g);
        tower(g, s, {}, 0.8);
        g.add(place(kitModel(kit, "building_home_A_blue"), 0.6, 0.6, 0, 0.5));
        g.add(place(kitModel(kit, "building_market_blue"), 0.55, -0.6, 0, 0.4));
        g.scale.setScalar(1.3);
        break;
      case "city":
        islet(g);
        tower(g, s, { gold: s.color === "yellow" }, 0.6);
        g.add(place(kitModel(kit, `building_home_B_${s.color}`), 0.55, 0.6, 0, 0.4));
        g.add(place(kitModel(kit, `flag_${s.color}`), 2.2, -0.6, 0, -0.3));
        g.scale.setScalar(1.1);
        break;
      case "wreck": {
        const sand = new THREE.Mesh(hexGeometry(0.9), sandM);
        sand.position.y = -0.36;
        g.add(sand);
        const w = place(kitModel(kit, "building_destroyed"), 1.15, 0, -0.2);
        w.rotation.set(0.15, (i * 1.7) % 6, 0.1);
        g.add(w);
        g.add(place(kitModel(kit, "barrel"), 1, 0.6, -0.25, 0.3));
        break;
      }
      case "fish": {
        // Fixed spots for the water lilies (the prototype scattered them at random).
        [[-0.6, 0.3], [0.5, -0.4], [0.1, 0.7], [-0.3, -0.6], [0.7, 0.4]].forEach(([x, z], k) =>
          g.add(place(kitModel(kit, k % 2 ? "waterlily_B" : "waterlily_A"), 1, x!, -0.38, z!)),
        );
        const ringGeo = new THREE.RingGeometry(1.1, 1.3, 6, 1);
        ringGeo.rotateX(-Math.PI / 2);
        ringGeo.rotateY(Math.PI / 6);
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: "#BFF1FF", transparent: true, opacity: 0.5, depthWrite: false }));
        ring.position.y = -0.3;
        g.add(ring);
        rings.push({ ring, x: s.x });
        break;
      }
      case "isle":
        islet(g);
        g.add(kitModel(kit, i % 2 ? "trees_B_medium" : "trees_A_medium"));
        g.add(place(kitModel(kit, "resource_lumber"), 1, 0.6, 0, 0.4));
        break;
      case "camp": {
        islet(g);
        g.add(place(kitModel(kit, "tent"), 1, -0.3));
        g.add(place(kitModel(kit, "building_tower_A_red"), 0.5, 0.55, 0, 0.3));
        const b = createBoat("#2A2A2A");
        b.position.set(1.3, -0.32, 1);
        b.rotation.y = 1;
        g.add(b);
        break;
      }
    }
    g.traverse((m) => {
      m.castShadow = false;
      m.receiveShadow = false;
    });
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2, 8), hitM);
    hit.position.y = 1;
    hit.userData.site = s.id;
    // The hit shape keeps its size whatever the scale of the site.
    hit.scale.setScalar(1 / g.scale.x);
    g.add(hit);
    hits.push(hit);
    g.position.set(s.x, 0, s.z);
    add(g);
  });

  return {
    hits,
    animate(now) {
      for (const { lh, x } of lighthouses) lh.animate(now * 0.8 + x);
      for (const { ring, x } of rings) ring.scale.setScalar(1 + Math.sin(now * 2 + x) * 0.08);
    },
  };
}
