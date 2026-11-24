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
/** Turns toward the nearest enemy at most this fast, as a hand on the keys does (180° a second): closer to a player. */
export const steady: Bot = {
  name: "turns at 180°/s",
  input: (n) => {
    let near: N.Enemy | null = null;
    for (const e of n.enemies) if (!near || e.distance < near.distance) near = e;
    if (!near) return { beam: n.beam };
    const d = ((near.bearing - n.beam + 540) % 360) - 180;
    const most = 180 * N.STEP;
    return { beam: n.beam + Math.max(-most, Math.min(most, d)) };
  },
};
export const BOTS: readonly Bot[] = [still, steady, aim];

export type NightRun = { night: number; seed: number; bot: string; won: boolean; wave: number; waves: number; seconds: number; oil: number; loot: N.Loot };

/** One Night, played to its end by a bot. */
/** A bot's input, with the first card offered taken: the bots choose no better than that. */
const play = (bot: Bot, n: N.NightState): N.NightInput => ({ ...bot.input(n), card: n.offer[0] });

export function playNight(night: number, seed: number, bot: Bot, powers: N.NightPowers = N.BASE_POWERS): NightRun {
  let n = N.newNight(seed, night, powers);
  while (n.phase !== "won" && n.phase !== "lost") n = N.stepNight(n, play(bot, n));
  return { night, seed, bot: bot.name, won: n.phase === "won", wave: n.wave, waves: N.wavesOf(night), seconds: n.step / N.STEPS_PER_SECOND, oil: n.oil, loot: N.nightLoot(n) };
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

export type NightSummary = { night: number; bot: string; won: number; runs: number; wave: number; minutes: number; oil: number; wood: number; fish: number };

/** Each Night 1 to NIGHTS, each bot, over these seeds: how often it is won, and the medians. */
export function summarize(seeds: readonly number[], bots: readonly Bot[] = BOTS, upTo = 5): NightSummary[] {
  const out: NightSummary[] = [];
  for (let night = 1; night <= upTo; night++)
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

/** What the guide would buy: the Lighthouse when it can, else the cheapest upgrade it can pay. */
function buyAll(c: N.PortalCity): N.PortalCity {
  let city = c;
  for (;;) {
    const able = N.CITY_BUILDINGS.filter((b) => N.upgradeCity(city, b).ok);
    if (able.length === 0) return city;
    const cost = (b: N.CityBuilding) => N.upgradeCost(b, city.buildings[b]).wood + N.upgradeCost(b, city.buildings[b]).fish;
    const pick = able.includes("lighthouse") ? "lighthouse" : able.reduce((a, b) => (cost(b) < cost(a) ? b : a));
    const r = N.upgradeCity(city, pick);
    if (!r.ok) return city;
    city = r.city;
  }
}

export type Campaign = { bot: string; seed: number; tries: number[]; minutes: number; city: N.PortalCity; done: boolean };

/** A new city played Night after Night by a bot, its loot spent as the guide says, until Night 5 is won (or `maxNights`). */
export function campaign(bot: Bot, seed: number, maxNights = 60, upTo = 5): Campaign {
  let city = N.newCity();
  const tries = new Array<number>(upTo).fill(0);
  let seconds = 0;
  for (let i = 0; i < maxNights && city.won < upTo; i++) {
    const night = N.nextNight(city);
    let n = N.newNight((seed * 7919 + i) >>> 0, night, N.cityPowers(city));
    while (n.phase !== "won" && n.phase !== "lost") n = N.stepNight(n, play(bot, n));
    seconds += n.step / N.STEPS_PER_SECOND;
    tries[night - 1]! += 1;
    const r = N.dawn(city, n);
    if (r.ok) city = buyAll(r.city);
  }
  return { bot: bot.name, seed, tries, minutes: seconds / 60, city, done: city.won >= upTo };
}

/** Campaigns over these seeds, as a Markdown table: the tries each Night took (median), the minutes, the city at the end. */
export function campaignTable(seeds: readonly number[], bots: readonly Bot[] = [steady, aim]): string {
  const rows = bots.map((bot) => {
    const runs = seeds.map((seed) => campaign(bot, seed));
    const tries = Array.from({ length: 5 }, (_, k) => median(runs.map((r) => r.tries[k]!)));
    const last = runs[Math.floor(runs.length / 2)]!.city.buildings;
    return `| ${bot.name} | ${runs.filter((r) => r.done).length}/${runs.length} | ${tries.join(" · ")} | ${median(runs.map((r) => r.minutes)).toFixed(0)} | ${last.lighthouse} · ${last.refinery} · ${last.infirmary} |`;
  });
  return ["| Bot | Night 5 won | Tries for Nights 1 to 5 (median) | Minutes (median) | Lighthouse · Refinery · Infirmary at the end |", "| --- | --- | --- | --- | --- |", ...rows].join("\n");
}
