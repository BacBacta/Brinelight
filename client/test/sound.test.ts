import { afterEach, describe, expect, it, vi } from "vitest";
import { AMBIENCE, SAMPLES, SOUNDS, SOUND_KEY, createSound, keepSoundOn, soundOn } from "../src/ui/sound.js";
import type { KeyValueStore } from "../src/state/save.js";

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

/** A stand-in for the browser's AudioContext: counts the contexts made and the notes started. */
function fakeAudio() {
  const made: unknown[] = [];
  let started = 0;
  type Source = { buffer: unknown; loop: boolean; started: number; stopped: number };
  const sources: Source[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = () => ({ gain: param(), frequency: param(), Q: param(), type: "", connect: (n: unknown) => n, start: () => void started++, stop() {} });
  const bufferSource = () => {
    const s: Source & { connect: (n: unknown) => unknown; start(): void; stop(): void } = {
      buffer: null,
      loop: false,
      started: 0,
      stopped: 0,
      connect: (n) => n,
      start: () => void s.started++,
      stop: () => void s.stopped++,
    };
    sources.push(s);
    return s;
  };
  class AudioContext {
    currentTime = 0;
    state = "running";
    destination = {};
    constructor() {
      made.push(this);
    }
    createGain = node;
    createOscillator = node;
    createBiquadFilter = node;
    createBufferSource = bufferSource;
    resume = async () => undefined;
  }
  vi.stubGlobal("AudioContext", AudioContext);
  return { made, started: () => started, sources: () => sources };
}
/** A page that only knows its listeners, to tap it. */
function fakePage() {
  const listeners = new Map<string, () => void>();
  return {
    addEventListener: (type: string, fn: () => void) => void listeners.set(type, fn),
    removeEventListener: (type: string) => void listeners.delete(type),
    tap: () => listeners.get("pointerdown")?.(),
    listening: () => listeners.has("pointerdown"),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("the sounds", () => {
  it("ten sounds of wood and rope: each under a second, quiet", () => {
    expect(Object.keys(SOUNDS)).toHaveLength(10);
    for (const [id, notes] of Object.entries(SOUNDS)) {
      expect(notes.length, id).toBeGreaterThan(0);
      expect(Math.max(...notes.map((n) => n.at + n.dur)), id).toBeLessThan(1);
      for (const n of notes) {
        expect(["knock", "marimba", "rope", "thud"], id).toContain(n.kind);
        expect(n.gain, id).toBeLessThanOrEqual(0.3);
      }
    }
  });

  it("on by default; turned off, kept off on this device", () => {
    const store = memoryStore();
    expect(soundOn(store)).toBe(true);
    keepSoundOn(store, false);
    expect(store.data.get(SOUND_KEY)).toBe("off");
    expect(soundOn(store)).toBe(false);
    keepSoundOn(store, true);
    expect(soundOn(store)).toBe(true);
    expect(soundOn(null)).toBe(true);
  });

  it("nothing is made before the first tap, then a sound plays; off, nothing plays", () => {
    const audio = fakeAudio();
    const page = fakePage();
    const store = memoryStore();
    const sound = createSound(store, page as unknown as Window);
    sound.play("done");
    expect(audio.made).toHaveLength(0);
    page.tap();
    expect(page.listening()).toBe(false);
    sound.play("done");
    expect(audio.made).toHaveLength(1);
    expect(audio.started()).toBeGreaterThan(0);
    const before = audio.started();
    sound.on = false;
    sound.play("tap");
    expect(audio.started()).toBe(before);
    expect(soundOn(store)).toBe(false);
    // One context for the page.
    sound.on = true;
    sound.play("tap");
    expect(audio.made).toHaveLength(1);
  });

  it("each sound has its recorded sound, quiet; the sea is quieter still", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(SOUNDS).sort());
    for (const [id, s] of Object.entries(SAMPLES)) {
      expect(s.file, id).toMatch(/^[a-z-]+$/);
      expect(s.gain, id).toBeGreaterThan(0);
      expect(s.gain, id).toBeLessThanOrEqual(0.85);
    }
    expect(AMBIENCE.gain).toBeLessThan(0.2);
  });

  it("nothing loads before the first tap; then the recorded sounds play, and the sea loops until sounds are off", async () => {
    const audio = fakeAudio();
    const page = fakePage();
    const store = memoryStore();
    const asked: string[] = [];
    const load = async (_ctx: AudioContext, file: string) => {
      asked.push(file);
      return { file } as unknown as AudioBuffer;
    };
    const sound = createSound(store, page as unknown as Window, load);
    sound.play("done");
    expect(asked).toHaveLength(0);
    page.tap();
    await Promise.resolve();
    await Promise.resolve();
    // Every file once, the sea included.
    expect(new Set(asked)).toEqual(new Set([...Object.values(SAMPLES).map((s) => s.file), AMBIENCE.file]));
    expect(asked).toHaveLength(new Set(asked).size);
    const sea = audio.sources().find((s) => (s.buffer as unknown as { file: string }).file === AMBIENCE.file)!;
    expect(sea.loop).toBe(true);
    expect(sea.started).toBe(1);
    sound.play("done");
    const done = audio.sources().filter((s) => (s.buffer as unknown as { file: string }).file === SAMPLES.done.file);
    expect(done).toHaveLength(1);
    expect(done[0]!.started).toBe(1);
    sound.on = false;
    expect(sea.stopped).toBe(1);
    sound.on = true;
    const seas = audio.sources().filter((s) => (s.buffer as unknown as { file: string }).file === AMBIENCE.file);
    expect(seas).toHaveLength(2);
  });

  it("a recorded sound that cannot load: the made sound plays instead", async () => {
    const audio = fakeAudio();
    const page = fakePage();
    const sound = createSound(memoryStore(), page as unknown as Window, async () => null);
    page.tap();
    await Promise.resolve();
    sound.play("tap");
    expect(audio.started()).toBeGreaterThan(0);
    expect(audio.sources()).toHaveLength(0);
  });

  it("turned off before the first tap: no AudioContext at all", () => {
    const audio = fakeAudio();
    const page = fakePage();
    const store = memoryStore();
    keepSoundOn(store, false);
    const sound = createSound(store, page as unknown as Window);
    page.tap();
    sound.play("captain");
    expect(audio.made).toHaveLength(0);
  });
});
