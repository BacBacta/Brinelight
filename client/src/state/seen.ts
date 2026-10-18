import { eventsBetween, type GameEvent, type PlayerState } from "@brinelight/shared";
import { migrateSave, type KeyValueStore } from "./save.js";

/**
 * The last city seen on this device, and whose it is: the city of this device (`DEVICE`), or an account's
 * (`accountOwner`). At launch, the city shown is compared with it, to tell what ended while you were away.
 */
export const SEEN_KEY = "brinelight-seen-v1";
export const DEVICE = "device";
export const accountOwner = (wallet: string): string => `account:${wallet}`;

export type Seen = { owner: string; state: PlayerState };

export function readSeen(store: KeyValueStore | null): Seen | null {
  try {
    const o: unknown = JSON.parse(store?.getItem(SEEN_KEY) ?? "null");
    if (typeof o !== "object" || o === null || typeof (o as Seen).owner !== "string") return null;
    // Its clock is never read here, only what ended: a seen city from before the Mist gets 0.
    const state = migrateSave((o as Seen).state, 0);
    return state ? { owner: (o as Seen).owner, state } : null;
  } catch {
    return null;
  }
}

export function writeSeen(store: KeyValueStore | null, owner: string, state: PlayerState): void {
  try {
    store?.setItem(SEEN_KEY, JSON.stringify({ owner, state }));
  } catch {
    // Storage full or blocked: nothing will be told at the next launch.
  }
}

/**
 * What ended since the last city seen on this device, for the city of the same owner shown now. Nothing on the very
 * first launch (nothing seen yet), and nothing when the city shown is someone else's: signing in, the account's city
 * takes the screen, and that is not news.
 */
export const awayEvents = (seen: Seen | null, owner: string, now: PlayerState): GameEvent[] => (seen && seen.owner === owner ? eventsBetween(seen.state, now) : []);
