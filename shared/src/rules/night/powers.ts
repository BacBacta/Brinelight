/** What the portal's city gives its Night (Hold the Light): read when the Night starts, carried in it, never changed by it. */
import type { PortalCity } from "./city.js";
import { BEAM_DPS, BEAM_PER_LEVEL, OIL_PER_REFINERY, POSTS_BASE, RESCUE_BASE, RESCUE_PER_LEVEL, START_OIL } from "./values.js";

export type NightPowers = {
  /** The beam's damage a second. */
  beamDps: number;
  /** The oil the Night starts with: the Lighthouse's life. */
  startOil: number;
  /** The second chance: the share of `startOil` the Lighthouse lights again with, once; 0 for none. */
  rescue: number;
  /** The posts on the rafts. */
  posts: number;
};

/** A Night with no city behind it: the values' own. */
export const BASE_POWERS: Readonly<NightPowers> = { beamDps: BEAM_DPS, startOil: START_OIL, rescue: 0, posts: POSTS_BASE };

/** The powers a city gives its next Night: the Lighthouse's beam, the Refinery's oil, the Infirmary's second chance. */
export function cityPowers(c: PortalCity): NightPowers {
  const { lighthouse, refinery, infirmary } = c.buildings;
  return {
    beamDps: BEAM_DPS * (1 + BEAM_PER_LEVEL * (lighthouse - 1)),
    startOil: START_OIL + OIL_PER_REFINERY * (refinery - 1),
    rescue: infirmary > 0 ? RESCUE_BASE + RESCUE_PER_LEVEL * (infirmary - 1) : 0,
    posts: POSTS_BASE,
  };
}
