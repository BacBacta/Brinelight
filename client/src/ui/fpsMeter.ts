/** Frame rate measure for the ?fps counter. Pure: times are passed in, in seconds. */

/** The minimum is taken over this many seconds. */
export const MIN_WINDOW = 10;
/** Seconds ignored after the 3D models load: the first frames are always slow. */
export const WARMUP = 5;
/** A gap between two frames longer than this means the tab was hidden: the measure starts over. */
export const GAP = 1;

export type FpsMeter = {
  view: string;
  /** Time of the last frame, or null before the first one. */
  last: number | null;
  /** Start of the second being counted, and frames counted since then. */
  secStart: number;
  frames: number;
  /** Average of the last full second. */
  avg: number | null;
  /** Full seconds measured: when they started and their frame rate. */
  seconds: { start: number; fps: number }[];
  /** Seconds starting before this time do not count in the minimum (Infinity until the models load). */
  countFrom: number;
};

export const newFpsMeter = (view: string): FpsMeter => ({ view, last: null, secStart: 0, frames: 0, avg: null, seconds: [], countFrom: Infinity });

/** The 3D models just loaded at `t`: the minimum ignores the next WARMUP seconds. */
export const modelsLoaded = (m: FpsMeter, t: number): FpsMeter => ({ ...m, countFrom: t + WARMUP });

/** One drawn frame at time `t`, in view `view`. A view change or a gap over GAP starts the measure over. */
export function fpsFrame(m: FpsMeter, t: number, view: string): FpsMeter {
  if (m.last === null || t - m.last > GAP || view !== m.view) {
    return { ...m, view, last: t, secStart: t, frames: 0, avg: null, seconds: [] };
  }
  let next: FpsMeter = { ...m, last: t, frames: m.frames + 1 };
  const span = t - m.secStart;
  if (span >= 1) {
    const fps = next.frames / span;
    const seconds = [...m.seconds, { start: m.secStart, fps }].filter((s) => s.start > t - MIN_WINDOW);
    next = { ...next, secStart: t, frames: 0, avg: fps, seconds };
  }
  return next;
}

/** The lowest one-second frame rate of the last MIN_WINDOW seconds, warm-up excluded; null when there is none yet. */
export function fpsMin(m: FpsMeter): number | null {
  const counted = m.seconds.filter((s) => s.start >= m.countFrom);
  return counted.length ? Math.min(...counted.map((s) => s.fps)) : null;
}

/** Reads ?fps in the URL. */
export const fpsWanted = (search: string): boolean => new URLSearchParams(search).has("fps");
