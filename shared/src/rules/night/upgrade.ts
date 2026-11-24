/**
 * Dawn and the upgrades of the portal's city (Hold the Light): a Night's loot comes into the store, and an upgrade
 * happens at once, with no timer. Refusals in the player's words, as the server would send them.
 */
import { CITY_MAX_LEVEL, CITY_MIN_LEVEL, type CityBuilding, type PortalCity } from "./city.js";
import { CAPTAIN_IDS } from "./captains.js";
import { nightLoot } from "./loot.js";
import { SHARDS_PER_WIN, SHARDS_TO_UNLOCK } from "./values.js";
import type { NightState } from "./state.js";
import { UPGRADE_BASE, UPGRADE_GROWTH } from "./values.js";

export type CityResult = { ok: true; city: PortalCity } | { ok: false; reason: string };

const NAMES: Readonly<Record<CityBuilding, string>> = { lighthouse: "Lighthouse", refinery: "Refinery", infirmary: "Infirmary", barracks: "Barracks", harbor: "Harbor", observatory: "Observatory" };

/** The city at dawn: the Night's loot in its store, one Night more played, and the Night won if it was. */
export function dawn(c: PortalCity, n: NightState): CityResult {
  if (n.phase !== "won" && n.phase !== "lost") return { ok: false, reason: "The Night is not over yet." };
  const loot = nightLoot(n);
  return {
    ok: true,
    city: {
      ...c,
      stock: { wood: c.stock.wood + loot.wood, fish: c.stock.fish + loot.fish, pearls: c.stock.pearls + loot.pearls },
      won: n.phase === "won" ? Math.max(c.won, n.night) : c.won,
      played: c.played + 1,
      captains: n.phase === "won" ? withShards(c.captains) : c.captains,
    },
  };
}

/** A Night won: shards for the first captain still to join, who joins at 10. */
function withShards(cap: PortalCity["captains"]): PortalCity["captains"] {
  const next = CAPTAIN_IDS.find((id) => !cap.unlocked.includes(id));
  if (!next) return cap;
  const shards = { ...cap.shards, [next]: cap.shards[next] + SHARDS_PER_WIN };
  return { ...cap, shards, unlocked: shards[next] >= SHARDS_TO_UNLOCK ? [...cap.unlocked, next] : cap.unlocked };
}

/** What it costs to bring a building from `level` to the next, rounded to 5. */
export function upgradeCost(b: CityBuilding, level: number): { wood: number; fish: number } {
  const steps = Math.max(0, level - Math.max(1, CITY_MIN_LEVEL[b]));
  const k = UPGRADE_GROWTH ** steps;
  return { wood: Math.round((UPGRADE_BASE[b].wood * k) / 5) * 5, fish: Math.round((UPGRADE_BASE[b].fish * k) / 5) * 5 };
}

/** A building one level up, paid at once; or why not. No building but the Lighthouse goes above the Lighthouse. */
export function upgradeCity(c: PortalCity, b: CityBuilding): CityResult {
  const level = c.buildings[b];
  if (level >= CITY_MAX_LEVEL) return { ok: false, reason: `Your ${NAMES[b]} is at its highest level.` };
  if (b !== "lighthouse" && level + 1 > c.buildings.lighthouse) return { ok: false, reason: "Upgrade the Lighthouse first." };
  const cost = upgradeCost(b, level);
  const missing = [
    ...(cost.wood > c.stock.wood ? [`${cost.wood - c.stock.wood} more wood`] : []),
    ...(cost.fish > c.stock.fish ? [`${cost.fish - c.stock.fish} more fish`] : []),
  ];
  if (missing.length) return { ok: false, reason: `You need ${missing.join(" and ")}.` };
  return {
    ok: true,
    city: { ...c, buildings: { ...c.buildings, [b]: level + 1 }, stock: { ...c.stock, wood: c.stock.wood - cost.wood, fish: c.stock.fish - cost.fish } },
  };
}
