import * as THREE from "three";
import { BUILDING_IDS, type BuildingId } from "@brinelight/shared";
import { hexX, hexZ } from "../scene/index.js";
import type { Volume } from "../scene/framing.js";
import type { PlayerState } from "../state/index.js";
import { plotOf } from "./plots.js";
import type { SiteBox } from "./site.js";
import { createModelSites } from "./modelSite.js";
import { buildingScale, extraName, loadStage, shownShape, showLevel, stageName, tallestHeight } from "./staged.js";

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
  /** The room each building takes at its level (a building not built yet: its building site's), for the close view. */
  volumes(state: PlayerState): Record<BuildingId, Volume>;
};

export const plotPosition = (id: BuildingId) => {
  const [q, r] = plotOf(id);
  return { x: hexX(q, r), z: hexZ(r) };
};

/** The buildings made in Blender (staged.ts): each one its stage's model at its level, and its building site at work. */
export function createCityBuildings(add: (o: THREE.Object3D) => void): CityBuildings {
  const sites = createModelSites(add);
  const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const plots = {} as Record<BuildingId, Plot>;

  BUILDING_IDS.forEach((id) => {
    const group = new THREE.Group();
    const { x, z } = plotPosition(id);
    group.position.set(x, 0, z);
    // The tap shape covers the building's model, up to its top at its tallest (fitted to its level as it is shown).
    const tall = id === "lighthouse";
    const h = tallestHeight(id);
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
    {
      const shape = shownShape(id, Math.max(1, level));
      p.hit.scale.y = shape.height / (p.hit.geometry as THREE.CylinderGeometry).parameters.height;
      p.hit.position.y = shape.height / 2;
      if (level === 0) {
        p.group.children.filter((c) => c !== p.hit).forEach((c) => p.group.remove(c));
        return;
      }
      const key = p.key;
      // Its stage's model, and what is laid with it (the Harbor's pier and boat, from the plot's center).
      const extra = extraName(id, level);
      void Promise.all([loadStage(stageName(id, level)), extra ? loadStage(extra) : null]).then(([model, more]) => {
        // A later level may have come while it loaded: only the latest is shown.
        if (p.key !== key) return;
        p.group.children.filter((c) => c !== p.hit && c !== model && c !== more).forEach((c) => p.group.remove(c));
        showLevel(model, id, level);
        // A little larger on its plot (the style pass); what is laid with it keeps its size.
        model.scale.setScalar(buildingScale(id));
        p.group.add(model);
        if (more) p.group.add(more);
      });
    }
  };

  return {
    hits: BUILDING_IDS.map((id) => plots[id].hit),
    refresh(state) {
      const shown: { x: number; z: number; box: SiteBox; moving: boolean }[] = [];
      for (const id of BUILDING_IDS) {
        const level = state.buildings[id];
        const job = state.queue.find((j) => j.id === id);
        if (id === "lighthouse") {
          // The Lighthouse's next model is fetched while its upgrade runs (it has no building site).
          if (job) void loadStage(stageName(id, level + 1));
          continue;
        }
        const working = !!job;
        // A building site around a building at work, at its size; around a building not built yet, at its first size.
        if (working || level === 0) {
          const { reach, height } = shownShape(id, Math.max(1, level));
          shown.push({ ...plotPosition(id), box: { reach, height }, moving: working });
          // The model of the next level is fetched while the work runs.
          void loadStage(stageName(id, level + 1));
          const extra = extraName(id, level + 1);
          if (extra) void loadStage(extra);
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
    volumes(state) {
      const out = {} as Record<BuildingId, Volume>;
      for (const id of BUILDING_IDS) {
        const level = Math.max(1, state.buildings[id]);
        out[id] = { ...plotPosition(id), ...shownShape(id, level) };
      }
      return out;
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
