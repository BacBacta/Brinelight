/**
 * A Night advances by one step of 1/30 s (Hold the Light). The client gives the beam's angle; the rules do the rest:
 * the enemies come, the beam burns what it lights, the coast is raided. Pure: the Night given is never changed.
 */
import type { NightState } from "./state.js";
import { BEAM_DPS, BEAM_WIDTH, COAST_RADIUS, FAMILY, STEP } from "./values.js";

/** What the player does in a step: where the beam points, in degrees. */
export type NightInput = { beam: number };

/** Below this, an enemy is on the coast: the float sums of its way never miss it by a rounding. */
const ON_COAST = COAST_RADIUS + 1e-9;

/** An angle brought into [0, 360); null if it is not a number. */
export function toBearing(angle: number): number | null {
  if (!Number.isFinite(angle)) return null;
  const a = angle % 360;
  return a < 0 ? a + 360 : a + 0; // + 0: never −0
}

/** Is a bearing in the beam? On its edge, yes. */
export function inBeam(beam: number, bearing: number): boolean {
  const d = Math.abs(beam - bearing) % 360;
  return Math.min(d, 360 - d) <= BEAM_WIDTH / 2 + 1e-9;
}

/** Below this, an enemy's health is spent. */
const SPENT = 1e-9;

/** The Night one step later. A Night won or lost is over: it comes back as it is. */
export function stepNight(n: NightState, input: NightInput): NightState {
  if (n.phase === "won" || n.phase === "lost") return n;
  const beam = toBearing(input.beam) ?? n.beam;
  let oil = n.oil;
  const enemies = [];
  for (const e of n.enemies) {
    // The beam burns first: what it lights this step never reaches the coast in it.
    const health = inBeam(beam, e.bearing) ? e.health - BEAM_DPS * STEP : e.health;
    if (health <= SPENT) continue;
    const distance = e.distance - FAMILY[e.family].speed * STEP;
    if (distance <= ON_COAST) {
      oil = Math.max(0, oil - FAMILY[e.family].oil);
      continue;
    }
    enemies.push({ ...e, distance, health });
  }
  return { ...n, step: n.step + 1, beam, oil, enemies, phase: oil <= 0 ? "lost" : n.phase };
}
