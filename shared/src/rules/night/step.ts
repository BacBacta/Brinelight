/**
 * A Night advances by one step of 1/30 s (Hold the Light). The client gives the beam's angle; the rules do the rest:
 * the enemies come, the beam burns what it lights, the coast is raided. Pure: the Night given is never changed.
 */
import { COUNTER_BONUS } from "../combat.js";
import type { TroopType } from "../types.js";
import { nextFloat, type Rng } from "./random.js";
import { TROOPS, type Enemy, type NightPhase, type NightState } from "./state.js";
import {
  BEAM_WIDTH,
  COAST_RADIUS,
  FAMILIES,
  FAMILY,
  NIGHT_MIX,
  WRAITH_FADE_AFTER,
  WRAITH_HIDDEN,
  type Family,
  NIGHT1_GRACE_WAVES,
  NIGHT_GROWTH,
  NIGHT_WAVES,
  POST_ARC,
  POST_DPS,
  POST_RANGE,
  SEA_RADIUS,
  SPAWN_BURST,
  SPAWN_SPACING,
  STEP,
  STEPS_PER_SECOND,
  WAVE_FIRST,
  WAVE_GROWTH,
  WAVE_PAUSE,
} from "./values.js";

/** What the player does in a step: where the beam points, in degrees; and maybe a troop put on a post. */
export type NightInput = { beam: number; post?: { slot: number; troop: TroopType } };

/** The troop that beats each family, on the troops' triangle (boarders > harpooners > crossbowmen > boarders). */
export const COUNTERED_BY: Readonly<Record<Family, TroopType>> = { raider: "crossbowmen", beast: "harpooners", wraith: "boarders" };

/** Where post `i` of `count` stands around the island, in degrees: evenly, the first at 45°. */
export const postBearing = (i: number, count: number): number => (45 + (i * 360) / count) % 360;

const angleApart = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

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
const FADE_AFTER_STEPS = Math.round(WRAITH_FADE_AFTER * STEPS_PER_SECOND);
const HIDDEN_STEPS = Math.round(WRAITH_HIDDEN * STEPS_PER_SECOND);

/** The family of a newcomer in a Night, drawn from its mix, and the generator's state after. */
export function familyAt(night: number, r: Rng): [Family, Rng] {
  const mix = NIGHT_MIX[night - 1] ?? NIGHT_MIX[NIGHT_MIX.length - 1]!;
  const [f, next] = nextFloat(r);
  let left = f;
  for (const fam of FAMILIES) {
    left -= mix[fam];
    if (left < 0) return [fam, next];
  }
  return ["raider", next];
}

/** How many come at once in a Night. */
export const burstOf = (night: number): number => SPAWN_BURST[night - 1] ?? SPAWN_BURST[SPAWN_BURST.length - 1]!;
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
  let posts = n.posts;
  const order = input.post;
  if (order && Number.isInteger(order.slot) && order.slot >= 0 && order.slot < posts.length && TROOPS.includes(order.troop)) {
    posts = posts.slice();
    posts[order.slot] = order.troop;
  }
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
    const burst = Math.min(size - spawned, burstOf(n.night));
    for (let k = 0; k < burst; k++) {
      const [family, afterFamily] = familyAt(n.night, rng);
      const [f, next] = nextFloat(afterFamily);
      rng = next;
      coming.push({ id: nextId, family, bearing: f * 360, distance: SEA_RADIUS, health: FAMILY[family].health, lit: 0, fade: 0 });
      nextId += 1;
    }
    spawned += burst;
    nextSpawn = t + SPACING_STEPS;
  }

  // Night 1's first waves leave a drop of oil: a new player learns the beam before they can lose.
  const floor = n.night === 1 && wave <= NIGHT1_GRACE_WAVES ? 1 : 0;
  let oil = n.oil;
  let burned = n.burned;
  const enemies: Enemy[] = [];
  const sea = [...n.enemies, ...coming];
  // The posts fire on their own: each at the enemy nearest the coast in its reach, harder at the family its troop beats.
  const hits = new Map<number, number>();
  posts.forEach((troop, i) => {
    if (!troop) return;
    const at = postBearing(i, posts.length);
    let target: Enemy | null = null;
    for (const e of sea) if (e.distance <= POST_RANGE && angleApart(at, e.bearing) <= POST_ARC / 2 && (!target || e.distance < target.distance)) target = e;
    if (target) hits.set(target.id, (hits.get(target.id) ?? 0) + POST_DPS * STEP * (COUNTERED_BY[target.family] === troop ? COUNTER_BONUS : 1));
  });
  for (const e of sea) {
    // The beam burns first: what it lights this step never reaches the coast in it. A faded Wraith it goes through.
    const fading = e.fade > 0;
    const lit = !fading && inBeam(beam, e.bearing);
    const health = (lit ? e.health - n.power.beamDps * STEP : e.health) - (hits.get(e.id) ?? 0);
    let litFor = lit ? e.lit + 1 : 0;
    let fade = fading ? e.fade - 1 : 0;
    if (e.family === "wraith" && litFor >= FADE_AFTER_STEPS) {
      fade = HIDDEN_STEPS;
      litFor = 0;
    }
    if (health <= SPENT) {
      burned += 1;
      continue;
    }
    const distance = e.distance - FAMILY[e.family].speed * STEP;
    if (distance <= ON_COAST) {
      oil = Math.max(Math.min(floor, oil), oil - FAMILY[e.family].oil);
      continue;
    }
    enemies.push({ ...e, distance, health, lit: litFor, fade });
  }

  // The Infirmary's second chance: once, the Lighthouse lights again.
  let rescued = n.rescued;
  if (oil <= 0 && !rescued && n.power.rescue > 0) {
    oil = Math.round(n.power.startOil * n.power.rescue);
    rescued = true;
  }
  if (oil <= 0) phase = "lost";
  else if (phase === "wave" && spawned >= size && enemies.length === 0) {
    if (wave >= wavesOf(n.night)) phase = "won";
    else {
      phase = "pause";
      pauseEnd = t + 1 + PAUSE_STEPS;
    }
  }
  return { ...n, step: t + 1, beam, oil, phase, wave, pauseEnd, spawned, nextSpawn, rng, nextId, burned, enemies, rescued, posts };
}
