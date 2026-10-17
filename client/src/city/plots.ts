import type { BuildingId } from "@brinelight/shared";

/** Hex plot of each building on the island (prototype PLOT). */
export const PLOTS: Record<BuildingId, readonly [q: number, r: number]> = {
  lighthouse: [0, 0],
  refinery: [1, -1],
  fishery: [1, 0],
  lumberyard: [0, 1],
  shelters: [-1, 1],
  barracks: [-1, 0],
  harbor: [0, -1],
  observatory: [2, -1],
  infirmary: [-2, 1],
};

/** City look. Only the starting blue look exists for now. */
export const SKIN = "blue";

/**
 * Name of the building model in phare.glb for this level (prototype bModel). Since week 5 the city shows its own
 * models (scene/buildings.ts); the kit's models stay in phare.glb, and this table with them, for the visual tiers to come.
 */
export function buildingModel(id: Exclude<BuildingId, "lighthouse">, level: number): string {
  const base = {
    refinery: "blacksmith",
    fishery: "market",
    lumberyard: "lumbermill",
    shelters: level >= 4 ? "home_B" : "home_A",
    barracks: "barracks",
    harbor: "watermill",
    observatory: "tower_A",
    infirmary: "tavern",
  }[id];
  return `building_${base}_${SKIN}`;
}

/** In the kit's look: from level 5, a small tower stood next to the building (not on the Observatory, which is already a tower). */
export const hasTower = (id: BuildingId, level: number): boolean => level >= 5 && id !== "observatory";
