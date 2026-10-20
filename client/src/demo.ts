/**
 * Demonstration cities, to measure the worst case on a phone (?demo=phare30, ?demo=phare15): a city at Lighthouse 30
 * (or 15) with its rafts, a building site and its survivors. Only in development and on the branch previews, never in
 * production. Played from memory only: no request to the server, nothing written on the device, your city untouched.
 */
import { BUILDING_IDS, RAFT_SLOTS, newPlayerState, upgradeTime, type PlayerState } from "@brinelight/shared";
import type { KeyValueStore } from "./state/index.js";
import { previewHost } from "./preview.js";

export const DEMOS = {
  phare30: { lighthouse: 30, rafts: 39, survivors: 106 },
  phare15: { lighthouse: 15, rafts: 15, survivors: 46 },
} as const;
export type DemoName = keyof typeof DEMOS;

/** The demo asked for in the address, when demos are allowed here; null otherwise (production: always null). */
export function demoWanted(search: string, allowed: boolean): DemoName | null {
  if (!allowed) return null;
  const name = new URLSearchParams(search).get("demo");
  return name !== null && Object.hasOwn(DEMOS, name) ? (name as DemoName) : null;
}

/** Demos are allowed in development (vite dev) and on a branch preview's build served at a preview's address. */
export const demoAllowed = (env: { DEV: boolean; VITE_BRANCH_PREVIEW?: string }, hostname: string): boolean =>
  env.DEV || (env.VITE_BRANCH_PREVIEW === "1" && previewHost(hostname));

/** The rafts' buildings: each type on two rafts at its top level (the rules allow no more), the other rafts bare. */
const RAFT_BUILDINGS = ["greenhouse", "smokehouse", "watchtower", "greenhouse", "smokehouse", "watchtower"] as const;

/**
 * Time left on the demo's building site. The Refinery's level 29 to 30 takes about 8.7 years by the rules (6 × 1.5^29
 * prototype seconds): started long ago, two days and five hours are left.
 */
const SITE_LEFT = 53 * 3600;

/** The demo's city at `clock` (seconds): every building at the Lighthouse's level, the Refinery's next level being built. */
export function demoCity(name: DemoName, clock: number): PlayerState {
  const d = DEMOS[name];
  const base = newPlayerState(clock);
  const buildings = Object.fromEntries(BUILDING_IDS.map((id) => [id, id === "refinery" ? d.lighthouse - 1 : d.lighthouse])) as PlayerState["buildings"];
  // The slots nearest the island first, ring 3 then ring 4.
  const slots = [...RAFT_SLOTS].sort((a, b) => a.ring - b.ring || Math.atan2(a.q, a.r) - Math.atan2(b.q, b.r)).slice(0, d.rafts);
  const rafts = Object.fromEntries(slots.map((s, i) => [s.key, { hp: 100, building: RAFT_BUILDINGS[i] ?? null, level: RAFT_BUILDINGS[i] ? 3 : 0 }]));
  const duration = upgradeTime("refinery", buildings.refinery);
  return { ...base, buildings, rafts, survivors: d.survivors, queue: [{ id: "refinery", left: Math.min(SITE_LEFT, duration), duration }] };
}

/** A store in memory: the demo's city and the sounds' setting live there, and go with the page. */
export function memoryStore(): KeyValueStore {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
  };
}
