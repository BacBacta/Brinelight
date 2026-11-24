/**
 * Plays the Night (Hold the Light) with simple bots, to see what its values give before anyone plays it: the wave
 * reached, the time, the oil left and the loot. It changes no value.
 */
import { night as N } from "@brinelight/shared";

export type Bot = { name: string; input(n: N.NightState): N.NightInput };

/** Never moves the beam: what the Night does to a player who does nothing. */
export const still: Bot = { name: "still beam", input: () => ({ beam: 0 }) };
/** Turns the beam at once to the nearest enemy: a perfect hand, faster than any player's. */
export const aim: Bot = {
  name: "aims at the nearest",
  input: (n) => {
    let near: N.Enemy | null = null;
    for (const e of n.enemies) if (!near || e.distance < near.distance) near = e;
    return { beam: near ? near.bearing : n.beam };
  },
};
export const BOTS: readonly Bot[] = [still, aim];

export type NightRun = { night: number; seed: number; bot: string; won: boolean; wave: number; waves: number; seconds: number; oil: number; loot: N.Loot };

/** One Night, played to its end by a bot. */
export function playNight(night: number, seed: number, bot: Bot): NightRun {
  let n = N.newNight(seed, night);
  while (n.phase !== "won" && n.phase !== "lost") n = N.stepNight(n, bot.input(n));
  return { night, seed, bot: bot.name, won: n.phase === "won", wave: n.wave, waves: N.wavesOf(night), seconds: n.step / N.STEPS_PER_SECOND, oil: n.oil, loot: N.nightLoot(n) };
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

export type NightSummary = { night: number; bot: string; won: number; runs: number; wave: number; minutes: number; oil: number; wood: number; fish: number };

/** Each Night 1 to NIGHTS, each bot, over these seeds: how often it is won, and the medians. */
export function summarize(seeds: readonly number[], bots: readonly Bot[] = BOTS): NightSummary[] {
  const out: NightSummary[] = [];
  for (let night = 1; night <= N.NIGHTS; night++)
    for (const bot of bots) {
      const runs = seeds.map((seed) => playNight(night, seed, bot));
      out.push({
        night,
        bot: bot.name,
        won: runs.filter((r) => r.won).length,
        runs: runs.length,
        wave: median(runs.map((r) => r.wave)),
        minutes: median(runs.map((r) => r.seconds)) / 60,
        oil: median(runs.map((r) => r.oil)),
        wood: median(runs.map((r) => r.loot.wood)),
        fish: median(runs.map((r) => r.loot.fish)),
      });
    }
  return out;
}

/** The summary as a Markdown table. */
export const toTable = (rows: readonly NightSummary[]): string =>
  [
    "| Night | Bot | Won | Wave reached (median) | Minutes (median) | Oil left | Wood | Fish |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r.night} | ${r.bot} | ${r.won}/${r.runs} | ${r.wave} | ${r.minutes.toFixed(1)} | ${r.oil} | ${r.wood} | ${r.fish} |`),
  ].join("\n");
