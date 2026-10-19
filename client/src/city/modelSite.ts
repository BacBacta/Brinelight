/**
 * The building sites made in Blender (week 8; assets/blender/site_models.py): the scaffolding stretched to the
 * building (its sides to its reach, its height to 70 % of its height), and a crane at its right front corner whose arm
 * swings and whose crate goes up and down while the work runs. Same rules as the sites built in code (site.ts): the
 * same places and sizes, still with reduced motion.
 */
import * as THREE from "three";
import { CITY_MANIFEST } from "../scene/cityLook.js";
import { CRANE_PERIOD, CRANE_SWING, CRATE_LIFT, cranePlace, craneScale, siteRadius, type SiteBox } from "./site.js";
import { loadStage } from "./staged.js";

/** The scaffolding's model is made for a building reaching this far, 1 high. */
const FRAME_REACH = 0.95;

export function createModelSites(add: (o: THREE.Object3D) => void) {
  const root = new THREE.Group();
  root.name = "sites";
  add(root);
  const parts = Promise.all(["site-frame", "site-mast", "site-arm", "site-crate"].map((n) => loadStage(n)));
  const arm = CITY_MANIFEST["site-arm"] as { mast?: number } | undefined;
  const mastTop = arm?.mast ?? 1.54;
  let shown: { arm: THREE.Object3D; crate: THREE.Object3D; moving: boolean; phase: number }[] = [];
  let key = "";
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  return {
    show(sites: readonly { x: number; z: number; box: SiteBox; moving: boolean }[]) {
      const next = JSON.stringify(sites);
      if (next === key) return;
      key = next;
      void parts.then(([frame, mast, armModel, crate]) => {
        if (key !== next) return;
        root.clear();
        shown = sites.map((s, i) => {
          const site = new THREE.Group();
          site.position.set(s.x, 0, s.z);
          const f = frame!.clone();
          const k = siteRadius(s.box) / FRAME_REACH;
          f.scale.set(k, Math.max(0.6, s.box.height * 0.7), k);
          site.add(f);
          const crane = new THREE.Group();
          const at = cranePlace(s.box);
          crane.position.set(at.x, 0, at.z);
          crane.scale.setScalar(craneScale(s.box));
          crane.add(mast!.clone());
          // The arm turns around the mast's axis; the crate hangs at its tip.
          const pivot = new THREE.Group();
          pivot.add(armModel!.clone());
          const c = crate!.clone();
          pivot.add(c);
          crane.add(pivot);
          site.add(crane);
          root.add(site);
          return { arm: pivot, crate: c, moving: s.moving, phase: i * 1.7 };
        });
      });
    },
    animate(now: number) {
      if (still) return;
      for (const s of shown) {
        if (!s.moving) continue;
        const t = (now / CRANE_PERIOD) * Math.PI * 2 + s.phase;
        s.arm.rotation.y = Math.sin(t) * CRANE_SWING;
        s.crate.position.y = Math.sin(t * 2) * CRATE_LIFT;
      }
    },
    /** The crane's top, for tests: its mast's height at size 1. */
    mastTop,
  };
}
