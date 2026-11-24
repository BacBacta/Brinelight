/**
 * A Night advances by one step of 1/30 s (Hold the Light). The client gives the beam's angle; the rules do the rest:
 * the enemies come, the beam burns what it lights, the coast is raided. Pure: the Night given is never changed.
 */
import { nextFloat } from "./random.js";
import type { Enemy, NightPhase, NightState } from "./state.js";
import {
  BEAM_DPS,
  BEAM_WIDTH,
  COAST_RADIUS,
  FAMILY,
  NIGHT1_GRACE_WAVES,
  NIGHT_GROWTH,
  NIGHT_WAVES,
  SEA_RADIUS,
  SPAWN_SPACING,
  STEP,
  STEPS_PER_SECOND,
  WAVE_FIRST,
  WAVE_GROWTH,
  WAVE_PAUSE,
} from "./values.js";

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

/** The waves of a Night. */
export const wavesOf = (night: number): number => NIGHT_WAVES[night - 1] ?? NIGHT_WAVES[NIGHT_WAVES.length - 1]!;
/** The Raiders of a wave. */
export const waveSize = (night: number, wave: number): number => WAVE_FIRST + WAVE_GROWTH * (wave - 1) + NIGHT_GROWTH * (night - 1);

const SPACING_STEPS = Math.round(SPAWN_SPACING * STEPS_PER_SECOND);
const PAUSE_STEPS = Math.round(WAVE_PAUSE * STEPS_PER_SECOND);

/** Below this, an enemy's health is spent. */
const SPENT = 1e-9;

/** The Night one step later. A Night won or lost is over: it comes back as it is. */
export function stepNight(n: NightState, input: NightInput): NightState {
  if (n.phase === "won" || n.phase === "lost") return n;
  const t = n.step;
  const beam = toBearing(input.beam) ?? n.beam;
  let phase: NightPhase = n.phase;
  let { wave, pauseEnd, spawned, nextSpawn, rng, nextId } = n;

  // The pause over, the next wave begins at once.
  if (phase === "pause" && t >= pauseEnd) {
    phase = "wave";
    wave += 1;
    pauseEnd = -1;
    spawned = 0;
    nextSpawn = t;
  }
  const size = waveSize(n.night, wave);
  const coming: Enemy[] = [];
  if (phase === "wave" && spawned < size && t >= nextSpawn) {
    const [f, next] = nextFloat(rng);
    rng = next;
    coming.push({ id: nextId, family: "raider", bearing: f * 360, distance: SEA_RADIUS, health: FAMILY.raider.health });
    nextId += 1;
    spawned += 1;
    nextSpawn = t + SPACING_STEPS;
  }

  // Night 1's first waves leave a drop of oil: a new player learns the beam before they can lose.
  const floor = n.night === 1 && wave <= NIGHT1_GRACE_WAVES ? 1 : 0;
  let oil = n.oil;
  let burned = n.burned;
  const enemies: Enemy[] = [];
  for (const e of [...n.enemies, ...coming]) {
    // The beam burns first: what it lights this step never reaches the coast in it.
    const health = inBeam(beam, e.bearing) ? e.health - BEAM_DPS * STEP : e.health;
    if (health <= SPENT) {
      burned += 1;
      continue;
    }
    const distance = e.distance - FAMILY[e.family].speed * STEP;
    if (distance <= ON_COAST) {
      oil = Math.max(Math.min(floor, oil), oil - FAMILY[e.family].oil);
      continue;
    }
    enemies.push({ ...e, distance, health });
  }

  if (oil <= 0) phase = "lost";
  else if (phase === "wave" && spawned >= size && enemies.length === 0) {
    if (wave >= wavesOf(n.night)) phase = "won";
    else {
      phase = "pause";
      pauseEnd = t + 1 + PAUSE_STEPS;
    }
  }
  return { ...n, step: t + 1, beam, oil, phase, wave, pauseEnd, spawned, nextSpawn, rng, nextId, burned, enemies };
}
