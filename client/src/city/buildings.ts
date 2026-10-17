import * as THREE from "three";
import { BUILDING_IDS, type BuildingId } from "@brinelight/shared";
import { hexX, hexZ, kitModel, lighthouseScale, type BuildingModels, type Kit } from "../scene/index.js";
import type { PlayerState } from "../state/index.js";
import { PLOTS } from "./plots.js";
import { TIER_SCALE, createTierDetails, tierOf } from "./tiers.js";

type Plot = { group: THREE.Group; hit: THREE.Mesh; key: string };

export type CityBuildings = {
  /** Invisible shapes used to know which building was tapped. */
  hits: THREE.Object3D[];
  /** Rebuilds the plots whose level or work changed. */
  refresh(state: PlayerState): void;
  /** Shows the yellow ring under a building, or hides it. */
  select(id: BuildingId | null): void;
};

export const plotPosition = (id: BuildingId) => {
  const [q, r] = PLOTS[id];
  return { x: hexX(q, r), z: hexZ(r) };
};

export function createCityBuildings(kit: Kit, models: BuildingModels, add: (o: THREE.Object3D) => void): CityBuildings {
  const details = createTierDetails(kit, plotPosition, add);
  const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const plots = {} as Record<BuildingId, Plot>;

  BUILDING_IDS.forEach((id) => {
    const group = new THREE.Group();
    const { x, z } = plotPosition(id);
    group.position.set(x, 0, z);
    // The tap shape covers the building's model, up to its top (the Lighthouse at its largest).
    const tall = id === "lighthouse";
    const h = models[id].height * (tall ? lighthouseScale(Infinity) : 1);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(tall ? 0.8 : 0.95, tall ? 0.8 : 0.95, h, 6), hitMaterial);
    hit.position.y = h / 2;
    hit.userData.building = id;
    group.add(hit);
    add(group);
    plots[id] = { group, hit, key: "" };
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
    if (level > 0) {
      // Its tier's size; its tier's details are placed by `details`.
      const model = models[id].object.clone(true);
      model.scale.setScalar(TIER_SCALE[tierOf(level)]);
      p.group.add(model);
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
      details.refresh(state.buildings);
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
  };
}
