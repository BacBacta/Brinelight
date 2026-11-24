/**
 * The six captains of the portal (Hold the Light): one leads each Night, and its power is fired from the Night (input
 * `power`). Old Tom from the start; the others join with 10 shards, won Night by Night (dawn, upgrade.ts). Free, never sold.
 */
import type { PortalCity } from "./city.js";

export const CAPTAIN_IDS = ["tom", "bran", "isa", "mira", "nera", "sel"] as const;
export type CaptainId = (typeof CAPTAIN_IDS)[number];

export type CaptainPower = {
  /** The captain's name, as the Brinelight on Solana's. */
  captain: string;
  name: string;
  text: string;
  /** How long it lasts (0: at once). */
  seconds: number;
};

export const CAPTAIN_POWERS: Readonly<Record<CaptainId, CaptainPower>> = {
  tom: { captain: "Old Tom", name: "Flare", text: "The whole sea burns for 2 s.", seconds: 2 },
  bran: { captain: "Bran the Boarder", name: "Boarding", text: "Your rafts' troops hit twice as hard for 4 s.", seconds: 4 },
  isa: { captain: "Isa the Harpooner", name: "Harpoon", text: "300 to the enemy nearest the coast.", seconds: 0 },
  mira: { captain: "Mira Lynx-Eye", name: "Crossfire", text: "80 to every Raider on the sea.", seconds: 0 },
  nera: { captain: "Nera of the Mist", name: "Mist veil", text: "Every enemy stops for 3 s.", seconds: 3 },
  sel: { captain: "Sel the Navigator", name: "Bright lens", text: "Your beam burns twice as hard for 4 s.", seconds: 4 },
};

export type Captains = { lead: CaptainId; unlocked: CaptainId[]; shards: Record<CaptainId, number> };

export const newCaptains = (): Captains => ({ lead: "tom", unlocked: ["tom"], shards: { tom: 0, bran: 0, isa: 0, mira: 0, nera: 0, sel: 0 } });

/** A captain you have, to lead the next Nights; or why not. */
export function setLead(c: PortalCity, id: CaptainId): { ok: true; city: PortalCity } | { ok: false; reason: string } {
  if (!c.captains.unlocked.includes(id)) return { ok: false, reason: `${CAPTAIN_POWERS[id].captain} has not joined you yet.` };
  return { ok: true, city: { ...c, captains: { ...c.captains, lead: id } } };
}
