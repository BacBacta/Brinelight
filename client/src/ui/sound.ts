/**
 * The game's sounds (week 6, task 3), made by the game with the Web Audio API: no file, no dependency. One family, wood
 * and rope, never metal: knocks, a rope's creak, a marimba. Quiet, each under a second. Nothing is made before your
 * first tap (browsers only allow sound after one). On by default; turned off in the Profile, they stay off on this device.
 */
import type { KeyValueStore } from "../state/save.js";

export type SoundId = "tap" | "open" | "close" | "refused" | "start" | "done" | "troops" | "lighthouse" | "captain" | "away";

/** One sound in a sound: a wooden knock, a marimba note, a rope's creak, or a dull thud. `at` and `dur` in seconds. */
export type Note = { kind: "knock" | "marimba" | "rope" | "thud"; at: number; freq: number; dur: number; gain: number };

/** Notes of the marimba (Hz): C major, from C4. */
const C4 = 261.6, E4 = 329.6, G4 = 392, A4 = 440, C5 = 523.3, E5 = 659.3, G5 = 784;

/** The ten sounds. Each lasts under a second, and no note is louder than 0.3. */
export const SOUNDS: Record<SoundId, readonly Note[]> = {
  tap: [{ kind: "knock", at: 0, freq: 900, dur: 0.06, gain: 0.12 }],
  open: [{ kind: "rope", at: 0, freq: 220, dur: 0.22, gain: 0.08 }],
  close: [{ kind: "rope", at: 0, freq: 160, dur: 0.16, gain: 0.06 }],
  refused: [{ kind: "thud", at: 0, freq: 110, dur: 0.18, gain: 0.22 }],
  start: [
    { kind: "knock", at: 0, freq: 700, dur: 0.07, gain: 0.14 },
    { kind: "knock", at: 0.11, freq: 820, dur: 0.07, gain: 0.14 },
  ],
  done: [
    { kind: "marimba", at: 0, freq: C5, dur: 0.35, gain: 0.18 },
    { kind: "marimba", at: 0.1, freq: E5, dur: 0.35, gain: 0.18 },
    { kind: "marimba", at: 0.2, freq: G5, dur: 0.5, gain: 0.2 },
  ],
  troops: [
    { kind: "thud", at: 0, freq: 130, dur: 0.16, gain: 0.25 },
    { kind: "thud", at: 0.18, freq: 130, dur: 0.2, gain: 0.25 },
  ],
  lighthouse: [
    { kind: "marimba", at: 0, freq: C4, dur: 0.9, gain: 0.16 },
    { kind: "marimba", at: 0.12, freq: E4, dur: 0.5, gain: 0.16 },
    { kind: "marimba", at: 0.24, freq: G4, dur: 0.5, gain: 0.16 },
    { kind: "marimba", at: 0.36, freq: C5, dur: 0.55, gain: 0.2 },
  ],
  captain: [
    { kind: "marimba", at: 0, freq: G4, dur: 0.3, gain: 0.16 },
    { kind: "marimba", at: 0.09, freq: A4, dur: 0.3, gain: 0.16 },
    { kind: "marimba", at: 0.18, freq: C5, dur: 0.3, gain: 0.18 },
    { kind: "marimba", at: 0.27, freq: E5, dur: 0.6, gain: 0.2 },
  ],
  away: [
    { kind: "rope", at: 0, freq: 200, dur: 0.3, gain: 0.07 },
    { kind: "marimba", at: 0.2, freq: E5, dur: 0.5, gain: 0.16 },
  ],
};

/** The choice kept on this device: "off" when turned off; anything else, sounds on. */
export const SOUND_KEY = "brinelight-sound-v1";

export function soundOn(store: KeyValueStore | null): boolean {
  try {
    return store?.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function keepSoundOn(store: KeyValueStore | null, on: boolean): void {
  try {
    store?.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Storage full or blocked: the choice lasts as long as the page.
  }
}

/** Plays one note on `ctx`, into `out`. */
function playNote(ctx: AudioContext, out: AudioNode, n: Note): void {
  const t = ctx.currentTime + n.at;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(n.gain, t + (n.kind === "rope" ? 0.04 : 0.004));
  env.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
  env.connect(out);
  const stop = t + n.dur + 0.02;
  if (n.kind === "marimba") {
    // A wooden bar: the note, and its fourth partial, quieter and shorter.
    for (const [mult, share] of [[1, 1], [3.9, 0.25]] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = n.freq * mult;
      g.gain.value = share;
      o.connect(g).connect(env);
      o.start(t);
      o.stop(mult === 1 ? stop : t + n.dur / 3);
    }
    return;
  }
  if (n.kind === "knock" || n.kind === "thud") {
    // A hollow knock: a sine that drops fast in pitch.
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(n.freq * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(n.freq, t + n.dur * 0.6);
    o.connect(env);
    o.start(t);
    o.stop(stop);
    return;
  }
  // A rope's creak: a soft sawtooth through a narrow filter, its pitch bending a little.
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(n.freq, t);
  o.frequency.linearRampToValueAtTime(n.freq * 1.12, t + n.dur);
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = n.freq * 4;
  f.Q.value = 6;
  o.connect(f).connect(env);
  o.start(t);
  o.stop(stop);
}

/**
 * The sounds of the page. The AudioContext is only made at the first tap on the page (and only if sounds are on), so
 * that nothing sounds, or asks to, before you touch the game.
 */
export function createSound(store: KeyValueStore | null, target: Pick<Window, "addEventListener" | "removeEventListener"> = window) {
  let on = soundOn(store);
  let touched = false;
  let ctx: AudioContext | null = null;
  let out: GainNode | null = null;
  const touch = () => {
    touched = true;
    target.removeEventListener("pointerdown", touch, true);
  };
  target.addEventListener("pointerdown", touch, true);
  return {
    get on(): boolean {
      return on;
    },
    set on(value: boolean) {
      on = value;
      keepSoundOn(store, value);
    },
    play(id: SoundId): void {
      if (!on || !touched) return;
      if (!ctx) {
        ctx = new AudioContext();
        out = ctx.createGain();
        out.gain.value = 0.8;
        out.connect(ctx.destination);
      }
      if (ctx.state === "suspended") void ctx.resume();
      for (const n of SOUNDS[id]) playNote(ctx, out!, n);
    },
  };
}
