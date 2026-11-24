/**
 * The Night's sounds and music (Hold the Light, task 6.3), made with ElevenLabs (docs/decisions.md has their origin and
 * license). A Web Audio player of its own: nothing before the first tap (iOS), the game's Sounds switch obeyed, all of it
 * silent while the page is hidden. Which sound a step calls for is pure (`soundsBetween`), tested.
 */
import { night as N } from "@brinelight/shared";

export const NIGHT_SOUNDS = ["burn", "land", "wave", "card", "boss", "power", "lost", "dawn"] as const;
export type NightSound = (typeof NIGHT_SOUNDS)[number];

export const nightSoundUrl = (s: NightSound | "music"): string => `${import.meta.env.BASE_URL}night/sounds/${s}.mp3`;

/** The sounds a step calls for, from the Night before it and after it. */
export function soundsBetween(a: N.NightState, b: N.NightState): NightSound[] {
  const out: NightSound[] = [];
  if (b.burned > a.burned) out.push("burn");
  if (b.oil < a.oil && b.phase !== "lost") out.push("land");
  if (b.phase === "wave" && b.wave > a.wave) out.push("wave");
  if (b.offer.length > 0 && a.offer.length === 0) out.push("card");
  const boss = (n: N.NightState) => n.enemies.filter((e) => N.BOSSES[e.family]).length;
  if (boss(b) > boss(a)) out.push("boss");
  if (b.cooldown > a.cooldown) out.push("power");
  if (b.phase === "lost" && a.phase !== "lost") out.push("lost");
  if (b.phase === "won" && a.phase !== "won") out.push("dawn");
  return out;
}

/** The player: sounds and a looped music, started at the first tap. */
export function createNightAudio(isOn: () => boolean) {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  const buffers = new Map<string, AudioBuffer>();
  let music: AudioBufferSourceNode | null = null;
  let lastBurn = 0;

  const load = (c: AudioContext, name: NightSound | "music") =>
    fetch(nightSoundUrl(name))
      .then((r) => r.arrayBuffer())
      .then((b) => c.decodeAudioData(b))
      .then((buf) => void buffers.set(name, buf))
      .catch(() => undefined);

  const start = () => {
    if (ctx || !isOn()) return;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    master = ctx.createGain();
    master.connect(ctx.destination);
    for (const s of NIGHT_SOUNDS) void load(ctx, s);
    void load(ctx, "music").then(() => playMusic());
  };
  const playMusic = () => {
    const buf = buffers.get("music");
    if (!ctx || !master || !buf || music) return;
    const g = ctx.createGain();
    g.gain.value = 0.3;
    g.connect(master);
    music = ctx.createBufferSource();
    music.buffer = buf;
    music.loop = true;
    music.connect(g);
    music.start();
  };
  const onTap = () => {
    start();
    if (ctx?.state === "suspended" && !document.hidden) void ctx.resume();
  };
  addEventListener("pointerdown", onTap);
  addEventListener("keydown", onTap);
  const onVisibility = () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else if (isOn()) void ctx.resume();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    play(s: NightSound) {
      if (!ctx || !master || !isOn()) return;
      const now = ctx.currentTime;
      if (s === "burn") {
        if (now - lastBurn < 0.09) return;
        lastBurn = now;
      }
      const buf = buffers.get(s);
      if (!buf) return;
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      g.gain.value = s === "burn" ? 0.45 : 0.8;
      src.buffer = buf;
      src.connect(g).connect(master);
      src.start();
    },
    /** The Sounds switch was turned: the music follows it. */
    refresh() {
      if (!ctx || !master) return;
      master.gain.value = isOn() ? 1 : 0;
    },
    dispose() {
      removeEventListener("pointerdown", onTap);
      removeEventListener("keydown", onTap);
      document.removeEventListener("visibilitychange", onVisibility);
      music?.stop();
      void ctx?.close();
    },
  };
}
