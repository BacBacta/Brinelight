/**
 * The portal's city kept on the device (Hold the Light): written after each Night and each upgrade, read back strictly
 * by the rules (parseCity). A save the rules refuse is set aside untouched and a new city begins, as openSave does for
 * the Brinelight on Solana's city. Its keys go under brinelight-portal-v1/ (store.ts).
 */
import { night as N } from "@brinelight/shared";
import type { PortalStore } from "./store.js";

export const CITY_KEY = "hold-the-light-city";
export const REJECTED_CITY_KEY = "hold-the-light-city-rejected";
/** The file's own version, apart from the city's shape (N.CITY_SHAPE): a new one gets its migration here. */
const FILE_VERSION = 1;

export function saveCity(store: PortalStore | null, city: N.PortalCity): void {
  try {
    store?.setItem(CITY_KEY, JSON.stringify({ v: FILE_VERSION, city }));
  } catch {
    // Storage full or blocked: the game goes on without saving.
  }
}

/** The city on this device, or a new one; `rejected` when a save was there that the rules refused. */
export function openCity(store: PortalStore | null): { city: N.PortalCity; rejected: boolean } {
  let raw: string | null = null;
  try {
    raw = store?.getItem(CITY_KEY) ?? null;
  } catch {
    return { city: N.newCity(), rejected: false };
  }
  if (raw === null) return { city: N.newCity(), rejected: false };
  let city: N.PortalCity | null = null;
  try {
    const file: unknown = JSON.parse(raw);
    if (typeof file === "object" && file !== null && (file as { v?: unknown }).v === FILE_VERSION) city = N.parseCity((file as { city?: unknown }).city);
  } catch {
    city = null;
  }
  if (city) return { city, rejected: false };
  try {
    store?.setItem(REJECTED_CITY_KEY, raw);
    store?.removeItem(CITY_KEY);
  } catch {
    // Nowhere to keep it: the new city is still played.
  }
  return { city: N.newCity(), rejected: true };
}
