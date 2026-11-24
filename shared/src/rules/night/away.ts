/**
 * What the portal's city makes while you are away (Hold the Light): wood and fish an hour, by its Lighthouse, up to 4
 * hours' worth. The device's clock is given to the rules (seconds), never read in them; a clock moved back gives nothing.
 */
import type { PortalCity } from "./city.js";

export const AWAY_CAP_HOURS = 4;
/** Less than this is not counted yet (and not lost). */
const AWAY_MIN_SECONDS = 60;

/** Wood and fish the city makes an hour, by its Lighthouse's level. */
export const awayRates = (lighthouse: number): { wood: number; fish: number } => ({ wood: 20 + 10 * lighthouse, fish: 15 + 8 * lighthouse });

/** The city with what it made since it was last seen, and what that was. `now` is the device's clock, in seconds. */
export function collectAway(c: PortalCity, now: number): { city: PortalCity; gained: { wood: number; fish: number } } {
  const none = { wood: 0, fish: 0 };
  if (!Number.isFinite(now)) return { city: c, gained: none };
  if (c.away === 0 || now < c.away) return { city: { ...c, away: Math.floor(now) }, gained: none };
  const seconds = now - c.away;
  if (seconds < AWAY_MIN_SECONDS) return { city: c, gained: none };
  const hours = Math.min(AWAY_CAP_HOURS, seconds / 3600);
  const rate = awayRates(c.buildings.lighthouse);
  const gained = { wood: Math.floor(rate.wood * hours), fish: Math.floor(rate.fish * hours) };
  return { city: { ...c, away: Math.floor(now), stock: { ...c.stock, wood: c.stock.wood + gained.wood, fish: c.stock.fish + gained.fish } }, gained };
}
