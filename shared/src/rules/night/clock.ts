/**
 * Real time into whole steps (Hold the Light): the client feeds the time a frame took; the Night runs the whole steps
 * it holds and keeps the rest for the next frame. The same Night at 60, 144 or 165 Hz.
 */
import { stepNight, type NightInput } from "./step.js";
import type { NightState } from "./state.js";
import { MAX_STEPS_PER_FEED, STEPS_PER_SECOND } from "./values.js";

/** A Night and the part of a step not run yet, in steps, [0, 1). */
export type NightClock = { night: NightState; spare: number };

/** A frame's time (seconds) run as whole steps, at most MAX_STEPS_PER_FEED: a slow frame slows the Night rather than jumping it ahead. */
export function feedTime(c: NightClock, seconds: number, input: NightInput): NightClock {
  if (!Number.isFinite(seconds) || seconds <= 0) return c;
  // A hair over, so that 1/15 s is two steps and not 1.9999999.
  const total = c.spare + seconds * STEPS_PER_SECOND + 1e-9;
  const steps = Math.floor(total);
  const run = Math.min(steps, MAX_STEPS_PER_FEED);
  let night = c.night;
  for (let i = 0; i < run; i++) night = stepNight(night, input);
  return { night, spare: steps > run ? 0 : Math.max(0, total - steps - 1e-9) };
}
