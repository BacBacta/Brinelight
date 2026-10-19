import * as THREE from "three";
import { BUILDING_IDS, type BuildingId } from "@brinelight/shared";
import { hexX, hexZ, lighthouseScale, type BuildingModels, type Kit } from "../scene/index.js";
import { hexReach } from "../scene/buildings.js";
import type { PlayerState } from "../state/index.js";
import { createGrowth } from "./growth.js";
import { PLOTS } from "./plots.js";
import { createSites, type SiteBox } from "./site.js";
import { createModelSites } from "./modelSite.js";
import { TIER_SCALE, createTierDetails, tierOf } from "./tiers.js";
import { blenderLook } from "../scene/cityLook.js";
import { isStaged, levelShape, loadStage, showLevel, stageName } from "./staged.js";

type Plot = { group: THREE.Group; hit: THREE.Mesh; key: string };

export type CityBuildings = {
  /** Invisible shapes used to know which building was tapped. */
  hits: THREE.Object3D[];
  /** Rebuilds the plots whose level or work changed. */
  refresh(state: PlayerState): void;
  /** Shows the yellow ring under a building, or hides it. */
  select(id: BuildingId | null): void;
  /** Moves the cranes of the building sites. */
  animate(now: number): void;
};

/** A model's room on its plot at a size: its half width and half depth (from its center), and its height. */
export function siteBox(object: THREE.Object3D, scale: number): SiteBox {
  object.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let reach = 0;
  let height = 0;
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      reach = Math.max(reach, hexReach(v.x, v.z));
      height = Math.max(height, v.y);
    }
  });
  return { reach: reach * scale, height: height * scale };
}

export const plotPosition = (id: BuildingId) => {
  const [q, r] = PLOTS[id];
  return { x: hexX(q, r), z: hexZ(r) };
};

export function createCityBuildings(kit: Kit, models: BuildingModels, add: (o: THREE.Object3D) => void): CityBuildings {
  // The buildings remade in Blender (with ?blender until approved): their stage's model, no tier scale, no old details.
  const staged = (id: BuildingId) => blenderLook() && isStaged(id);
  const details = createTierDetails(kit, plotPosition, add);
  const growth = createGrowth(plotPosition, add, (level) => TIER_SCALE[tierOf(Math.max(1, level))]);
  const sites = blenderLook() ? createModelSites(add) : createSites(add, BUILDING_IDS.length);
  // Each model's box at full size, for its building site.
  const boxes = Object.fromEntries(BUILDING_IDS.map((id) => [id, siteBox(models[id].object, 1)])) as Record<BuildingId, SiteBox>;
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

  const rebuild = (id: Exclude<BuildingId, "lighthouse">, level: number) => {
    const p = plots[id];
    if (staged(id)) {
      const shape = levelShape(id, Math.max(1, level));
      p.hit.scale.y = shape.height / (p.hit.geometry as THREE.CylinderGeometry).parameters.height;
      p.hit.position.y = shape.height / 2;
      if (level === 0) {
        p.group.children.filter((c) => c !== p.hit).forEach((c) => p.group.remove(c));
        return;
      }
      const key = p.key;
      void loadStage(stageName(id, level)).then((model) => {
        // A later level may have come while it loaded: only the latest is shown.
        if (p.key !== key) return;
        p.group.children.filter((c) => c !== p.hit && c !== model).forEach((c) => p.group.remove(c));
        showLevel(model, id, level);
        p.group.add(model);
      });
      return;
    }
    p.group.children.filter((c) => c !== p.hit).forEach((c) => p.group.remove(c));
    if (level > 0) {
      // Its tier's size; its details are placed by `growth` (or, until it has one, its tier's by `details`).
      const model = models[id].object.clone(true);
      model.scale.setScalar(TIER_SCALE[tierOf(level)]);
      p.group.add(model);
    }
  };

  return {
    hits: BUILDING_IDS.map((id) => plots[id].hit),
    refresh(state) {
      // The old details only on the buildings not remade yet.
      const old = { ...state.buildings };
      for (const id of BUILDING_IDS) if (staged(id)) old[id] = 0;
      details.refresh(old);
      growth.refresh(old);
      const shown: { x: number; z: number; box: SiteBox; moving: boolean }[] = [];
      for (const id of BUILDING_IDS) {
        if (id === "lighthouse") continue;
        const level = state.buildings[id];
        const job = state.queue.find((j) => j.id === id);
        const working = !!job;
        // A building site around a building at work, at its size; around a building not built yet, at its first size.
        if (working || level === 0) {
          if (staged(id)) {
            const { reach, height } = levelShape(id, Math.max(1, level));
            shown.push({ ...plotPosition(id), box: { reach, height }, moving: working });
            // The model of the next level is fetched while the work runs.
            void loadStage(stageName(id, level + 1));
          } else {
            const box = boxes[id];
            const s = TIER_SCALE[tierOf(Math.max(1, level))];
            shown.push({ ...plotPosition(id), box: { reach: box.reach * s, height: box.height * s }, moving: working });
          }
        }
        const key = `${level}`;
        if (plots[id].key === key) continue;
        plots[id].key = key;
        rebuild(id, level);
      }
      sites.show(shown);
    },
    animate(now) {
      sites.animate(now);
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
