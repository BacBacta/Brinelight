/**
 * The words for the rafts (owner, after the land's target images): from the Lighthouse 5 the rafts are drawn as land
 * won on the sea, and the game says so ("plot", "dike", "drain"); before, they are rafts. The rules' refusals are
 * neutral (shared/src/rules/rafts.ts): they fit both.
 */
import { RAFT_BUILDING_MAX_COPIES } from "@brinelight/shared";

/** From this Lighthouse level on, the rafts are land (display only: the rules keep their rafts). */
export const LAND_FROM = 5;

/** Whether the rafts show as land: the Lighthouse at LAND_FROM or more. */
export const landShown = (lighthouse: number): boolean => lighthouse >= LAND_FROM;

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export type RaftWords = {
  free: string;
  working: string;
  empty: string;
  build: string;
  rope: string;
  max: string;
  slotTitle: string;
  emptyTitle: string;
  count: string;
  many(n: number): string;
  moor: string;
  sturdiness: string;
  weak: string;
  repair(n: number): string;
  repaired: string;
  repairButton: string;
  repairing(n: number): string;
  yard: string;
  yardNew: string;
  yardBusy: string;
  newOne: string;
  mended(n: number): string;
  damaged(n: number): string;
  mist: string;
};

const RAFT: RaftWords = {
  free: "The Lighthouse's light reaches this far. You can moor a raft here and grow your city.",
  working: "Work in progress.",
  empty: `A free raft. Put a building on it. Each type is limited to ${RAFT_BUILDING_MAX_COPIES} rafts, and a House on every raft.`,
  build: "Build the raft",
  rope: "You find rope in wrecks and on pirates.",
  max: "Max level.",
  slotTitle: "Raft slot",
  emptyTitle: "Raft",
  count: "Rafts",
  many: (n) => plural(n, "raft", "rafts"),
  moor: "Moor a raft",
  sturdiness: "Sturdiness",
  weak: "half efficiency",
  repair: (n) => (n === 1 ? "Repair the damaged raft" : `Repair the ${n} damaged rafts`),
  repaired: "Back to full sturdiness, all at once.",
  repairButton: "Repair",
  repairing: (n) => `Repairing ${plural(n, "raft", "rafts")}`,
  yard: "Shipyard",
  yardNew: "raft",
  yardBusy: "The shipyard is busy",
  newOne: "A new raft is moored",
  mended: (n) => (n === 1 ? "A raft repaired" : `${n} rafts repaired`),
  damaged: (n) => plural(n, "raft", "rafts") + " damaged",
  mist: "In the Mist your city slows down, and your rafts get damaged.",
};

const LAND: RaftWords = {
  free: "The Lighthouse's light reaches this far. Win this plot from the sea and grow your city.",
  working: "Work in progress.",
  empty: `An empty plot. Put a building on it. You can build each type ${RAFT_BUILDING_MAX_COPIES === 2 ? "twice" : `${RAFT_BUILDING_MAX_COPIES} times`}, and a House on every plot.`,
  build: "Fill it in",
  rope: "You find rope in wrecks and on pirates.",
  max: "Max level.",
  slotTitle: "Free plot",
  emptyTitle: "Plot",
  count: "Plots",
  many: (n) => plural(n, "plot", "plots"),
  moor: "Win this plot",
  sturdiness: "Dike",
  weak: "flooded, half efficiency",
  repair: (n) => (n === 1 ? "Drain the flooded plot" : `Drain the ${n} flooded plots`),
  repaired: "Dikes mended, all at once.",
  repairButton: "Drain",
  repairing: (n) => `Draining ${plural(n, "plot", "plots")}`,
  yard: "Dike works",
  yardNew: "new plot",
  yardBusy: "The dike works are busy",
  newOne: "New land won from the sea",
  mended: (n) => (n === 1 ? "A plot drained" : `${n} plots drained`),
  damaged: (n) => plural(n, "plot", "plots") + " flooded",
  mist: "In the Mist your city slows down, and the sea floods your new land.",
};

/** The words for the rafts as they show: land (`land`), or rafts. */
export const raftWords = (land: boolean): RaftWords => (land ? LAND : RAFT);

/** The celebration told once per city when its rafts become land (owner): kept on this device, by the city's owner. */
export const LAND_TOLD_KEY = "brinelight-land-told-v1";
export const LAND_NEWS = { title: "Your rafts are now land", line: "Your city grows on the sea." } as const;

/**
 * Whether this city has yet to be told that its rafts are land (once per city: kept on this device under its owner):
 * its rafts show as land and it has at least one. Marks it told when it says yes.
 */
export function landNewsDue(store: Pick<Storage, "getItem" | "setItem"> | null, owner: string, rafts: number, land: boolean): boolean {
  if (!land || rafts === 0) return false;
  let told: string[] = [];
  try {
    const o: unknown = JSON.parse(store?.getItem(LAND_TOLD_KEY) ?? "[]");
    if (Array.isArray(o)) told = o.filter((x): x is string => typeof x === "string");
  } catch {
    told = [];
  }
  if (told.includes(owner)) return false;
  try {
    store?.setItem(LAND_TOLD_KEY, JSON.stringify([...told, owner]));
  } catch {
    // Storage full or blocked: it may be told again on this device.
  }
  return true;
}
