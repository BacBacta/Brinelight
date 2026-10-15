import * as THREE from "three";
import { BUILDING_IDS, type BuildingId } from "@brinelight/shared";
import { hexX, hexZ, kitModel, type Kit } from "../scene/index.js";
import type { PlayerState } from "../state/index.js";
import { PLOTS, SKIN, buildingModel, hasTower } from "./plots.js";

type Plot = { group: THREE.Group; hit: THREE.Mesh; key: string; flag: THREE.Object3D | null };

export type CityBuildings = {
  /** Invisible shapes used to know which building was tapped. */
  hits: THREE.Object3D[];
  /** Rebuilds the plots whose level or work changed. */
  refresh(state: PlayerState): void;
  /** Shows the yellow ring under a building, or hides it. */
  select(id: BuildingId | null): void;
  /** Flags waving. */
  animate(now: number): void;
};

export const plotPosition = (id: BuildingId) => {
  const [q, r] = PLOTS[id];
  return { x: hexX(q, r), z: hexZ(r) };
};

export function createCityBuildings(kit: Kit, add: (o: THREE.Object3D) => void): CityBuildings {
  const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const plots = {} as Record<BuildingId, Plot>;

  BUILDING_IDS.forEach((id) => {
    const group = new THREE.Group();
    const { x, z } = plotPosition(id);
    group.position.set(x, 0, z);
    // The Lighthouse is taller: its hit shape covers the tower.
    const tall = id === "lighthouse";
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(tall ? 0.8 : 0.95, tall ? 0.8 : 0.95, tall ? 3.6 : 1.6, 6), hitMaterial);
    hit.position.y = tall ? 1.8 : 0.8;
    hit.userData.building = id;
    group.add(hit);
    add(group);
    plots[id] = { group, hit, key: "", flag: null };
  });

  const ringGeo = new THREE.RingGeometry(1.02, 1.2, 6, 1);
  ringGeo.rotateX(-Math.PI / 2);
  ringGeo.rotateY(Math.PI / 6);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: "#FFE27A", transparent: true, opacity: 0.9, depthWrite: false }));
  ring.position.y = 0.04;
  ring.visible = false;
  add(ring);

  const rebuild = (id: Exclude<BuildingId, "lighthouse">, level: number, working: boolean) => {
    const p = plots[id];
    p.group.children.filter((c) => c !== p.hit).forEach((c) => p.group.remove(c));
    p.flag = null;
    if (level > 0) {
      const o = kitModel(kit, buildingModel(id, level));
      o.rotation.y = (Math.PI / 3) * (BUILDING_IDS.indexOf(id) % 6);
      p.group.add(o);
      if (hasTower(id, level)) {
        const t = kitModel(kit, `building_tower_A_${SKIN}`);
        t.scale.setScalar(0.42);
        t.position.set(0.62, 0, -0.5);
        p.group.add(t);
      }
      const f = kitModel(kit, `flag_${SKIN}`);
      f.scale.setScalar(2.4);
      f.position.set(0.72, 0, 0.4);
      p.group.add(f);
      p.flag = f;
    }
    if (level === 0 || working) {
      const s = kitModel(kit, "building_scaffolding");
      s.scale.setScalar(level === 0 ? 1 : 0.75);
      if (level > 0) s.position.set(-0.45, 0, 0.45);
      p.group.add(s);
    }
  };

  return {
    hits: BUILDING_IDS.map((id) => plots[id].hit),
    refresh(state) {
      for (const id of BUILDING_IDS) {
        if (id === "lighthouse") continue;
        const level = state.buildings[id];
        const working = state.queue.some((j) => j.id === id);
        const key = `${level}|${working}`;
        if (plots[id].key === key) continue;
        plots[id].key = key;
        rebuild(id, level, working);
      }
    },
    select(id) {
      ring.visible = id !== null;
      if (id) {
        const { x, z } = plotPosition(id);
        ring.position.set(x, 0.04, z);
      }
    },
    animate(now) {
      for (const id of BUILDING_IDS) {
        const p = plots[id];
        if (p.flag) p.flag.rotation.z = Math.sin(now * 2 + p.group.position.x) * 0.06;
      }
    },
  };
}
