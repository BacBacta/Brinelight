/**
 * How far the island's land reaches after the style pass (assets/blender/land.py, coast_radii, written by terrain.py in
 * land.json), in 72 directions: the normal view frames the city by it with ?blender.
 */
import LAND from "../city/life/land.json";

const RADII = (LAND as unknown as { coast?: number[] }).coast ?? [];

/** The land's reach at `angle` (x = cos, z = sin), between the two nearest directions measured. */
export function terrainCoast(angle: number): number {
  if (!RADII.length) return 5;
  const n = RADII.length;
  const t = ((((angle / (2 * Math.PI)) * n) % n) + n) % n;
  const i = Math.floor(t);
  const f = t - i;
  return RADII[i]! * (1 - f) + RADII[(i + 1) % n]! * f;
}
