/**
 * The building site of a building at work, or not built yet (week 8, task 1): where its scaffolding stands and how big
 * its crane is. The site itself is made in Blender (modelSite.ts). Display only: it follows the works the server sends.
 */

/** The room a site goes around: how far the building reaches on its plot (in hex distance, the plot's edge at 1), and its height. */
export type SiteBox = { reach: number; height: number };

/** How far the arm of a crane swings each way, in radians, and how long a swing takes, in seconds. */
export const CRANE_SWING = (25 * Math.PI) / 180;
export const CRANE_PERIOD = 6;

/** How far outside the building the scaffolding stands, and the farthest it may stand: its poles and the crane's mast stay on the plot. */
export const SITE_GAP = 0.02;
export const SITE_ROOM = 0.9;

/** The scaffolding's radius around a building: its corners' hex distance from the plot's center. */
export const siteRadius = (box: SiteBox): number => Math.min(box.reach + SITE_GAP, SITE_ROOM);

/**
 * The corners of the scaffolding, a hexagon like the plot: right front, front, left front, left back, back, right back.
 * The camera looks from +z.
 */
function corners(r: number): [number, number][] {
  const s = r / Math.sqrt(3);
  return [
    [r, s],
    [0, 2 * s],
    [-r, s],
    [-r, -s],
    [0, -2 * s],
    [r, -s],
  ];
}

/** Where the crane stands for a site: at the scaffolding's right front corner. */
export const cranePlace = (box: SiteBox): { x: number; z: number } => {
  const [x, z] = corners(siteRadius(box))[0]!;
  return { x: x * 0.97, z: z * 0.97 };
};

/** The crane's size for a site: 1 for a building 1.7 high (as tall as the tile allows), smaller for a lower one. */
export const craneScale = (box: SiteBox): number => Math.max(0.6, box.height * 0.7) / (1.7 * 0.7);

/** How far the crate goes up and down under the crane's arm, at size 1. */
export const CRATE_LIFT = 0.15;
