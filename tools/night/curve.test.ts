import { night as N } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { aim, campaign, playNight } from "./simulate.js";

/**
 * The chart's curve (Hold the Light, task 5.8): the aiming bot, its rafts manned, plays the whole chart from a new city,
 * its loot spent as the guide says. Each Night is won with the city its place on the chart gives, and lost, nearly
 * always, with the city of five Nights before: a curve, not a wall.
 */
describe("the sea chart's curve", () => {
  const run = campaign(aim, 1, 400, N.NIGHTS);

  it("a new city wins all 30 Nights, Night after Night", () => {
    expect(run.done).toBe(true);
    expect(run.city.won).toBe(N.NIGHTS);
    // No Night is a wall: none takes more than 40 tries.
    expect(Math.max(...run.tries)).toBeLessThanOrEqual(40);
  });

  it("with the city of five Nights before, nine Nights in ten of 6 to 30 are lost", () => {
    let lost = 0;
    for (let k = 6; k <= N.NIGHTS; k++) if (!playNight(k, 99, aim, N.cityPowers(run.cities[k - 6]!)).won) lost += 1;
    expect(lost / (N.NIGHTS - 5)).toBeGreaterThanOrEqual(0.9);
  });
}, 60_000);
