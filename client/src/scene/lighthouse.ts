import * as THREE from "three";
import { BUILDING_FIX, PLOT_ROOM, footprintReach, type BuildingModel, type Tier } from "./buildings.js";

/** Size of the Lighthouse in the city: it grows with its level, up to 1.25 (prototype). */
export function lighthouseScale(level: number): number {
  return Math.min(1.25, 0.82 + level * 0.045);
}

export type Lighthouse = {
  group: THREE.Group;
  animate(seconds: number): void;
  /** In the city: the painted model takes the place of the tower built in code; the beams and the light stay, at its lantern. */
  useModel(model: BuildingModel): void;
  /**
   * The widest it may grow and stay within its plot (PLOT_ROOM): past it, it only grows taller. Infinity before its
   * model is there.
   */
  readonly widthCap: number;
  /** Its lantern shines brighter with each visual tier. */
  setTier(tier: Tier): void;
};

/**
 * The Lighthouse is built in code, as in the prototype: striped tower, lamp, two turning beams, a point light.
 * At sea, the Lighthouses have no light of their own, and the Great Lighthouse is golden.
 */
export function createLighthouse(opts: { gold?: boolean; light?: boolean } = {}): Lighthouse {
  const gold = opts.gold ?? false;
  const g = new THREE.Group();
  const stoneM = new THREE.MeshStandardMaterial({ color: "#B9B2A6", roughness: 0.9 });
  const whiteM = new THREE.MeshStandardMaterial({ color: "#F6F1E6", roughness: 0.6 });
  const redM = new THREE.MeshStandardMaterial({ color: gold ? "#E9B22E" : "#C8361E", roughness: 0.5, metalness: gold ? 0.5 : 0 });
  const darkM = new THREE.MeshStandardMaterial({ color: "#2B3445", roughness: 0.6 });
  const tower: THREE.Mesh[] = [];
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
    const m = new THREE.Mesh(geo, mat);
    tower.push(m);
    m.position.y = y;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(0.62, 0.72, 0.36, 10), stoneM, 0.18);
  const segs = 5;
  const h = 0.42;
  for (let i = 0; i < segs; i++) {
    const r0 = 0.5 - i * 0.035;
    const r1 = 0.5 - (i + 1) * 0.035;
    add(new THREE.CylinderGeometry(r1, r0, h, 18), i % 2 ? redM : whiteM, 0.36 + h * i + h / 2);
  }
  const top = 0.36 + h * segs;
  add(new THREE.CylinderGeometry(0.44, 0.44, 0.07, 18), darkM, top + 0.035);
  const lampM = new THREE.MeshStandardMaterial({ color: "#FFF3B0", emissive: "#FFD24A", emissiveIntensity: 2.2, transparent: true, opacity: 0.95 });
  const lamp = add(new THREE.CylinderGeometry(0.24, 0.24, 0.36, 12), lampM, top + 0.25);
  add(new THREE.ConeGeometry(0.33, 0.32, 12), redM, top + 0.59);

  const beamM = new THREE.MeshBasicMaterial({ color: "#FFE7A0", transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.42, 3.2, 16, 1, true), beamM);
  beam.rotation.z = Math.PI / 2;
  beam.position.x = 1.6;
  const pivot = new THREE.Group();
  pivot.position.y = top + 0.25;
  pivot.add(beam);
  const beam2 = beam.clone();
  beam2.rotation.z = -Math.PI / 2;
  beam2.position.x = -1.6;
  pivot.add(beam2);
  g.add(pivot);

  const light = (opts.light ?? true) ? new THREE.PointLight("#FFD27A", 6, 9, 1.6) : null;
  if (light) {
    light.position.y = top + 0.25;
    g.add(light);
  }

  let widthCap = Infinity;
  return {
    group: g,
    get widthCap() {
      return widthCap;
    },
    setTier(tier) {
      lampM.emissiveIntensity = [1.6, 1.6, 2.2, 3][tier]!;
      if (light) light.intensity = [5, 5, 6, 7][tier]!;
    },
    animate(now) {
      pivot.rotation.y = now;
      beamM.opacity = 0.12 * (1 + Math.sin(now * 6) * 0.05);
    },
    useModel(model) {
      for (const m of tower) m.visible = m === lamp;
      g.add(model.object);
      widthCap = PLOT_ROOM / footprintReach(model.object);
      const lantern = model.height * (BUILDING_FIX.lighthouse.lantern ?? 0.8);
      lamp.position.y = lantern;
      pivot.position.y = lantern;
      if (light) light.position.y = lantern;
    },
  };
}
