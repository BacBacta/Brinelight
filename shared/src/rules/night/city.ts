/**
 * The portal's city between the Nights (Hold the Light): its buildings, what it has in store, the Nights it won. The
 * loot of a Night comes into its store; an upgrade happens at once, with no timer (task 4.2). Nothing here is the
 * Brinelight on Solana's city: its own buildings, its own values.
 */
import { NIGHTS } from "./values.js";

/** The shape of the city's data: raised when it changes, so that an old save is migrated knowingly. */
export const CITY_SHAPE = 2;

/**
 * The buildings with an effect on the Night today: the Lighthouse (the beam), the Refinery (the oil a Night starts
 * with), the Infirmary (a second chance). The others come with what they do (steps 3 and 5).
 */
export const CITY_BUILDINGS = ["lighthouse", "refinery", "infirmary", "barracks", "harbor", "observatory"] as const;
export type CityBuilding = (typeof CITY_BUILDINGS)[number];

/** The highest level a building reaches, for now. */
export const CITY_MAX_LEVEL = 10;
/** The lowest level of each: the Lighthouse and the Refinery stand from the start; the Infirmary is built. */
export const CITY_MIN_LEVEL: Readonly<Record<CityBuilding, number>> = { lighthouse: 1, refinery: 1, infirmary: 0, barracks: 0, harbor: 0, observatory: 0 };

export const CITY_STOCK = ["wood", "fish", "pearls"] as const;
export type CityStock = Record<(typeof CITY_STOCK)[number], number>;

export type PortalCity = {
  v: typeof CITY_SHAPE;
  buildings: Record<CityBuilding, number>;
  stock: CityStock;
  /** The highest Night won (0: none). */
  won: number;
  /** Nights played, won or lost. */
  played: number;
};

export const newCity = (): PortalCity => ({ v: CITY_SHAPE, buildings: { ...CITY_MIN_LEVEL }, stock: { wood: 0, fish: 0, pearls: 0 }, won: 0, played: 0 });

/** The Night to play next: the one after the last won, never past the last. */
export const nextNight = (c: PortalCity): number => Math.min(c.won + 1, NIGHTS);

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isWhole = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max;
const exactKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(o).length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(o, k));

/** A city read back from the device: exactly its fields, each in its range, or null. Never throws. */
export function parseCity(input: unknown): PortalCity | null {
  try {
    // Shape 1 (before the Barracks, the Harbor and the Observatory): the three come at 0.
    const raw =
      isObj(input) && input.v === 1 && isObj(input.buildings)
        ? { ...input, v: CITY_SHAPE, buildings: { ...input.buildings, barracks: 0, harbor: 0, observatory: 0 } }
        : input;
    if (!isObj(raw) || !exactKeys(raw, ["v", "buildings", "stock", "won", "played"]) || raw.v !== CITY_SHAPE) return null;
    const { buildings: b, stock: s, won, played } = raw;
    if (!isObj(b) || !exactKeys(b, CITY_BUILDINGS) || !CITY_BUILDINGS.every((id) => isWhole(b[id], CITY_MIN_LEVEL[id], CITY_MAX_LEVEL))) return null;
    if (!isObj(s) || !exactKeys(s, CITY_STOCK) || !CITY_STOCK.every((k) => isWhole(s[k]))) return null;
    if (!isWhole(won, 0, NIGHTS) || !isWhole(played) || won > played) return null;
    return {
      v: CITY_SHAPE,
      buildings: Object.fromEntries(CITY_BUILDINGS.map((id) => [id, b[id] as number])) as Record<CityBuilding, number>,
      stock: { wood: s.wood as number, fish: s.fish as number, pearls: s.pearls as number },
      won,
      played,
    };
  } catch {
    return null;
  }
}
