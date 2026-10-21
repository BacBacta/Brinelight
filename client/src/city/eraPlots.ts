import type { BuildingId } from "@brinelight/shared";

/**
 * Where each building stands in the city remade in Blender (owner, 19 October): display only, the cities' data know no
 * plot. The camera looks from the front (+z): the tallest buildings stand at the back, the lowest at the front, and none
 * stands right behind the Lighthouse, so that each one stays mostly in sight (client/test/visible.test.ts). The Harbor
 * stands on the coast by its pier, the Fishery on the coast to the east.
 */
export const ERA_PLOTS: Record<BuildingId, readonly [q: number, r: number]> = {
  lighthouse: [0, 0],
  // The back row, two plots back, on either side of the Lighthouse's line.
  refinery: [2, -2],
  harbor: [0, -2],
  // The tall ones of the sides, one plot back.
  shelters: [2, -1],
  observatory: [-1, -1],
  // The middle row, beside the Lighthouse.
  barracks: [-1, 0],
  fishery: [2, 0],
  // The front row: the lowest.
  lumberyard: [0, 1],
  infirmary: [-1, 1],
};
