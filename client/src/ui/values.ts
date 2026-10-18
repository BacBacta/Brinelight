import { CAPTAINS, MIST_DURATION, huntAt, isLit, leviathanUp, mistAt, oilAutonomy, power, storeCap, survivorCap, type CaptainId, type Troops } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import type { SeaMood } from "../scene/look.js";

/** Short amounts for the pills, as in the prototype: "520", "1.2 k", "12 k". */
export function shortAmount(n: number): string {
  const v = Math.floor(n);
  if (v >= 10_000) return `${Math.floor(v / 1000)} k`;
  if (v >= 1000) return `${(Math.floor(v / 100) / 10).toFixed(1)} k`;
  return String(v);
}

/** Longer amounts (Power): "2,312", "12.3 k", "123 k". */
export function longAmount(n: number): string {
  const v = Math.floor(n);
  if (v >= 100_000) return `${Math.floor(v / 1000)} k`;
  if (v >= 10_000) return `${(Math.floor(v / 100) / 10).toFixed(1)} k`;
  return v.toLocaleString("en-US");
}

/** A net rate per hour from netRates: "+14.0/h", "−0.4/h". */
export const rateText = (perHour: number): string => `${perHour >= 0 ? "+" : "−"}${Math.abs(perHour).toFixed(1)}/h`;

/** How full the warehouses are for one resource, from 0 to 1 (storeCap from the shared rules). */
export const fillRatio = (state: PlayerState, amount: number): number =>
  Math.min(1, Math.max(0, amount / storeCap(state.buildings.lighthouse, state.techs)));

/** A pill turns red from this filling: production soon stops. */
export const FULL_AT = 0.95;

const add = (a: Troops, b: Troops): Troops => ({ boarders: a.boarders + b.boarders, harpooners: a.harpooners + b.harpooners, crossbowmen: a.crossbowmen + b.crossbowmen });

/** The city's Power, computed by power() from the shared rules. As in the prototype, a fleet at sea still counts in it, its veterans too. */
export function cityPower(state: PlayerState): number {
  const captains = (Object.entries(state.captains) as [CaptainId, { level: number; stars: number } | undefined][])
    .filter((e): e is [CaptainId, { level: number; stars: number }] => !!e[1])
    .map(([id, c]) => ({ rarity: CAPTAINS[id].rarity, stars: c.stars, level: c.level }));
  return power({ buildings: state.buildings, troops: state.fleets.reduce((t, f) => add(t, f.troops), state.troops), veterans: state.fleets.reduce((t, f) => add(t, f.veterans), state.veterans), captains, techs: state.techs, rafts: state.rafts });
}

export const survivorsText = (state: PlayerState): string => `${state.survivors}/${survivorCap(state.buildings.shelters)}`;

/** `?mist` in the address: the Mist's look, to see and measure it, whatever the calendar. No rule depends on it. */
export const mistPreview = (search: string): boolean => new URLSearchParams(search).has("mist");

/** The sea's mood the game shows, read by the banner and the 3D view alike: the Mist when the rules say it is on. */
export function seaMood(state: PlayerState, preview = false): SeaMood {
  return preview || mistAt(state.clock).on ? "mist" : "calm";
}

/** A time from now, rounded up to the minute: "52 min", "3 h 05", "99+ h". */
export function inMinutes(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h >= 100 ? "99+ h" : h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

/**
 * The Mist banner, from the rules: before a Mist, when it comes and whether your oil lasts through it with the
 * Lighthouse stoked (oilAutonomy); during it, how long it has left and whether the Lighthouse is stoked or dark.
 * With `?mist` and no Mist on, how long your oil lasts stoked, as the preview of week 6.
 */
export function mistText(state: PlayerState, preview = false): string {
  const w = mistAt(state.clock);
  if (w.on) return `Mist · ${inMinutes(w.end - state.clock)} left · ${isLit(state.clock, state.mist) ? "Lighthouse stoked" : "Lighthouse dark"}`;
  const autonomy = oilAutonomy(state, state.stock.oil);
  if (preview) return Number.isFinite(autonomy) ? `Mist · oil for ${inMinutes(autonomy)}` : "Mist · your oil holds";
  const until = `Mist in ${inMinutes(w.start - state.clock)}`;
  if (!state.mist.stoke) return `${until} · stoking off`;
  return `${until} · ${autonomy >= MIST_DURATION ? "enough oil" : "not enough oil"}`;
}

/** The Leviathan's label on the sea map, from the rules: how long its hunt has left, or when it rises next. */
export function leviathanText(state: PlayerState): string {
  const w = huntAt(state.clock);
  if (leviathanUp(state.clock, state.leviathan)) return `Leviathan · ${inMinutes(w.end - state.clock)} left`;
  const next = w.on ? huntAt(w.end).start : w.start;
  return `Leviathan in ${inMinutes(next - state.clock)}`;
}

/** How long a number of the top bar takes to roll to its new value, in ms. */
export const ROLL_MS = 400;

/** The value shown `elapsed` ms into a roll from `from` to `to`: fast at first, then easing into place. */
export function rolled(from: number, to: number, elapsed: number): number {
  const t = Math.min(1, Math.max(0, elapsed / ROLL_MS));
  return from + (to - from) * (1 - (1 - t) ** 3);
}
