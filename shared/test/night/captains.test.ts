import { describe, expect, it } from "vitest";
import { CAPTAIN_IDS, CAPTAIN_POWERS, setLead } from "../../src/rules/night/captains.js";
import { CITY_SHAPE, newCity, parseCity, type PortalCity } from "../../src/rules/night/city.js";
import { cityPowers } from "../../src/rules/night/powers.js";
import { newNight, type Enemy, type NightState } from "../../src/rules/night/state.js";
import { postBearing, stepNight } from "../../src/rules/night/step.js";
import { dawn } from "../../src/rules/night/upgrade.js";
import { FAMILY, POST_DPS, SHARDS_PER_WIN, SHARDS_TO_UNLOCK, STEP, STEPS_PER_SECOND } from "../../src/rules/night/values.js";

const foe = (family: Enemy["family"], bearing: number, distance = 25, id = 1): Enemy => ({ id, family, bearing, distance, health: FAMILY[family].health, lit: 0, fade: 0, stage: 0 });
const led = (captain: (typeof CAPTAIN_IDS)[number], enemies: Enemy[], posts?: NightState["posts"]): NightState => {
  const c: PortalCity = { ...newCity(), captains: { lead: captain, unlocked: [...CAPTAIN_IDS], shards: newCity().captains.shards } };
  const n = newNight(1, 2, cityPowers(c));
  return { ...n, enemies, nextId: 9, spawned: 99, ...(posts ? { posts } : {}) };
};

describe("the six captains", () => {
  it("Old Tom from the start; the five others each 10 shards away", () => {
    expect(CAPTAIN_IDS).toEqual(["tom", "bran", "isa", "mira", "nera", "sel"]);
    expect(newCity().captains).toEqual({ lead: "tom", unlocked: ["tom"], shards: { tom: 0, bran: 0, isa: 0, mira: 0, nera: 0, sel: 0 } });
    expect(SHARDS_TO_UNLOCK).toBe(10);
  });

  it("a Night won gives shards to the first captain still locked; enough of them, and the captain joins", () => {
    const won = { ...newNight(1, 1), phase: "won" as const, wave: 5 };
    let c = newCity();
    for (let i = 0; i < 3; i++) {
      const r = dawn(c, won);
      if (r.ok) c = r.city;
    }
    expect(c.captains.shards.bran).toBe(3 * SHARDS_PER_WIN);
    expect(c.captains.unlocked).toContain("bran");
    const lost = dawn(newCity(), { ...won, phase: "lost", oil: 0 });
    expect(lost.ok && lost.city.captains.shards.bran).toBe(0);
  });

  it("you lead with a captain you have; not one still locked", () => {
    expect(setLead(newCity(), "bran")).toEqual({ ok: false, reason: "Bran the Boarder has not joined you yet." });
    const c = { ...newCity(), captains: { ...newCity().captains, unlocked: ["tom", "bran"] as PortalCity["captains"]["unlocked"] } };
    const r = setLead(c, "bran");
    expect(r.ok && r.city.captains.lead).toBe("bran");
    expect(cityPowers(r.ok ? r.city : c).captain).toBe("bran");
  });

  it("a city saved before the captains is read with Old Tom alone", () => {
    const v2 = { v: 2, buildings: { ...newCity().buildings }, stock: { wood: 1, fish: 2, pearls: 3 }, won: 1, played: 2 };
    expect(parseCity(v2)).toEqual({ ...v2, v: CITY_SHAPE, captains: newCity().captains, record: 0, away: 0, daily: newCity().daily });
  });
});

describe("each captain's power", () => {
  it("Old Tom, Flare: the whole sea burns, half the beam's strength", () => {
    expect(CAPTAIN_POWERS.tom.name).toBe("Flare");
  });

  it("Bran, Boarding: the posts' troops twice as hard for 4 s", () => {
    const b = postBearing(0, 2);
    const n = stepNight(led("bran", [foe("raider", b, 12)], ["harpooners", null]), { beam: (b + 180) % 360, power: true });
    expect(FAMILY.raider.health - n.enemies[0]!.health).toBeCloseTo(POST_DPS * 2 * STEP, 9);
    expect(n.flare).toBe(Math.round(CAPTAIN_POWERS.bran.seconds * STEPS_PER_SECOND) - 1);
  });

  it("Isa, Harpoon: 300 to the enemy nearest the coast, at once", () => {
    const n = stepNight(led("isa", [foe("beast", 90, 20, 1), foe("galleon", 200, 10, 2)]), { beam: 0, power: true });
    expect(FAMILY.galleon.health - n.enemies.find((e) => e.id === 2)!.health).toBeCloseTo(300, 6);
    expect(n.enemies.find((e) => e.id === 1)!.health).toBe(FAMILY.beast.health);
  });

  it("Mira, Crossfire: 80 to every Raider on the sea, at once", () => {
    const n = stepNight(led("mira", [foe("raider", 90, 25, 1), foe("raider", 200, 25, 2), foe("beast", 300, 25, 3)]), { beam: 0, power: true });
    expect(n.enemies.filter((e) => e.family === "raider")).toEqual([]);
    expect(n.enemies.find((e) => e.id === 3)!.health).toBe(FAMILY.beast.health);
  });

  it("Nera, Mist veil: the enemies stop for 3 s", () => {
    const n = stepNight(led("nera", [foe("raider", 90)]), { beam: 0, power: true });
    expect(n.enemies[0]!.distance).toBe(25);
  });

  it("Sel, Bright lens: the beam twice as hard for 4 s", () => {
    const n = stepNight(led("sel", [foe("beast", 0)]), { beam: 0, power: true });
    expect(FAMILY.beast.health - n.enemies[0]!.health).toBeCloseTo(n.power.beamDps * 2 * STEP, 9);
  });
});
