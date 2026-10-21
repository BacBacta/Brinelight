import type { Cost, Resource } from "@brinelight/shared";

export const RESOURCE_NAMES: Record<Resource, string> = { oil: "oil", fish: "fish", wood: "wood", rope: "rope" };

/** From 48 hours on, a time is told in days and hours. */
export const DAYS_FROM = 48 * 60;

/** Days and hours, from a number of minutes: "3 d 04 h". */
const days = (minutes: number): string => `${Math.floor(minutes / 1440)} d ${String(Math.floor((minutes % 1440) / 60)).padStart(2, "0")} h`;

/** Time left, as in the prototype: "0:45", "54:00", then "2 h 10" from one hour, and "3 d 04 h" from 48 hours. */
export function formatTimeLeft(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  if (m >= DAYS_FROM) return days(m);
  if (m >= 60) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** A duration for a sheet: "54 s" (only seen when sped up in development), "54 min", "2 h 10 min", "3 d 04 h". */
export function formatDuration(seconds: number): string {
  if (seconds < 59.5) return `${Math.max(1, Math.round(seconds))} s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${Math.max(1, m)} min`;
  if (m >= DAYS_FROM) return days(m);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

export const formatAmount = (n: number): string => Math.floor(n).toLocaleString("en-US");

export const costEntries = (c: Cost) => Object.entries(c) as [Resource, number][];
