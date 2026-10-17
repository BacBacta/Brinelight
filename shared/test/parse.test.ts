import { describe, expect, it } from "vitest";
import {
  BUILDING_IDS,
  CAPTAIN_MAX_LEVEL,
  HOUR,
  LIGHTHOUSE_MAX,
  RAFT_BUILDING_MAX_LEVEL,
  RAFT_SLOTS,
  SEA_SITES,
  TECHS,
  advance,
  newPlayerState,
  parseState,
  readReport,
  research,
  dockRaft,
  heal,
  installOnRaft,
  promote,
  upgradeRaft,
  sail,
  train,
  upgrade,
  type PlayerState,
} from "../src/index.js";

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const SLOT = RAFT_SLOTS[0]!.key;

/** A city with research, a second captain and a damaged Watchtower raft: every part parseState now reads. */
const richCity = (): PlayerState => ({
  ...newPlayerState(),
  techs: { blades: 2, sails: 1 },
  captains: { ...newPlayerState().captains, mira: { level: 3, xp: 12.5, stars: 2 } },
  rafts: { [SLOT]: { hp: 40.5, building: "watchtower", level: 2 } },
});

/** Every field that must be a whole number, with its value, wherever it is in the city. */
function wholeFields(s: PlayerState): [string, number][] {
  const out: [string, number][] = [];
  const troops = (where: string, t: Record<string, number>) => Object.entries(t).forEach(([k, v]) => out.push([`${where}.${k}`, v]));
  for (const id of BUILDING_IDS) out.push([`buildings.${id}`, s.buildings[id]]);
  troops("troops", s.troops);
  troops("veterans", s.veterans);
  troops("wounded", s.wounded);
  out.push(["survivors", s.survivors], ["pearls", s.pearls], ["reportSeq", s.reportSeq]);
  for (const [id, v] of Object.entries(s.techs)) out.push([`techs.${id}`, v ?? 0]);
  for (const [id, c] of Object.entries(s.captains)) out.push([`captains.${id}.level`, c!.level], [`captains.${id}.stars`, c!.stars]);
  for (const [k, r] of Object.entries(s.rafts)) out.push([`rafts.${k}.level`, r.level]);
  if (s.training) out.push(["training.count", s.training.count]);
  if (s.healing) troops("healing.wounded", s.healing.wounded);
  for (const [id, v] of Object.entries(s.world.camps)) out.push([`camps.${id}`, v]);
  s.fleets.forEach((f, i) => {
    troops(`fleets.${i}.troops`, f.troops);
    troops(`fleets.${i}.veterans`, f.veterans);
    out.push([`fleets.${i}.pearls`, f.pearls]);
    if (f.lead) out.push([`fleets.${i}.lead.level`, f.lead.level]);
  });
  for (const r of s.reports) {
    out.push([`${r.id}.level`, r.level]);
    for (const part of ["sent", "losses", "wounded", "enemy"] as const) troops(`${r.id}.${part}`, r[part]);
    if (r.veteranSent) troops(`${r.id}.veteranSent`, r.veteranSent);
    if (r.veteranLosses) troops(`${r.id}.veteranLosses`, r.veteranLosses);
    if (r.loot) out.push([`${r.id}.loot.pearls`, r.loot.pearls]);
  }
  return out;
}

describe("parseState: whole numbers, nothing below 0", () => {
  it("the rules never give a decimal where a whole number is required: a long game, time cut at odd lengths", () => {
    let s: PlayerState = {
      ...richCity(),
      techs: { ...richCity().techs, veterans: 1 },
      buildings: { ...richCity().buildings, observatory: 2, barracks: 3, infirmary: 1 },
    };
    const camps = SEA_SITES.filter((x) => x.kind === "camp").map((x) => x.id);
    const wrecks = SEA_SITES.filter((x) => x.kind === "wreck").map((x) => x.id);
    const steps = [0.37, 13.1, 600.5, 2.3 * HOUR, 0.001, 7.77 * HOUR, 1.7 * 24 * HOUR, 59.9, 3.3 * HOUR, 4 * 24 * HOUR];
    let checked = 0;
    let trained = 0;
    let healed = 0;
    let promoted = 0;
    let shipyard = 0;
    for (let round = 0; round < 40; round++) {
      for (const id of BUILDING_IDS) {
        const r = upgrade(s, id);
        if (r.ok) s = r.state;
      }
      const studied = research(s, (Object.keys(TECHS) as (keyof typeof TECHS)[])[round % 10]!);
      if (studied.ok) s = studied.state;
      // The shipyard: a new raft, a building on a free raft, or a building one level up, whichever the rules allow.
      const slots = RAFT_SLOTS.filter((x) => x.ring === 3).map((x) => x.key);
      const types = ["greenhouse", "smokehouse", "watchtower"] as const;
      const yardWork = [
        ...slots.map((k) => () => dockRaft(s, k)),
        ...slots.map((k) => () => installOnRaft(s, k, types[round % 3]!)),
        ...slots.map((k) => () => upgradeRaft(s, k)),
      ].map((f) => f()).find((r) => r.ok);
      if (yardWork?.ok) {
        s = yardWork.state;
        shipyard++;
      }
      const raised = round % 2 ? promote(s, (["boarders", "harpooners", "crossbowmen"] as const)[round % 3]!) : null;
      if (raised?.ok) {
        s = raised.state;
        promoted++;
      }
      const drilled = train(s, (["boarders", "harpooners", "crossbowmen"] as const)[round % 3]!);
      if (drilled.ok) {
        s = drilled.state;
        trained++;
      }
      const cared = heal(s);
      if (cared.ok) {
        s = cared.state;
        healed++;
      }
      const to = round % 3 === 2 ? wrecks[round % wrecks.length]! : camps[round % camps.length]!;
      const sent = sail(round % 5 === 0 ? { ...s, troops: { boarders: 40, harpooners: 31, crossbowmen: 27 } } : s, to);
      if (sent.ok) s = sent.state;
      s = advance(s, steps[round % steps.length]!);
      const unread = s.reports.find((r) => !r.read);
      if (unread && round % 2) s = readReport(s, unread.id);

      const read = parseState(json(s));
      expect(read, `round ${round}`).not.toBeNull();
      expect(read).toEqual(json(s));
      for (const [where, v] of wholeFields(s)) {
        expect(Number.isInteger(v) && v >= 0, `round ${round}: ${where} = ${v}`).toBe(true);
        checked++;
      }
    }
    // The game really went somewhere: fleets came back, with reports and loot; resources hold decimals.
    expect(s.reports.length).toBeGreaterThan(5);
    expect(s.reports.some((r) => r.loot)).toBe(true);
    expect(Object.values(s.stock).some((v) => !Number.isInteger(v))).toBe(true);
    expect(checked).toBeGreaterThan(1000);
    // Training too: batches started, and some finished along the way.
    expect(trained).toBeGreaterThan(3);
    // The shipyard too: rafts, buildings put on them and upgraded.
    expect(shipyard).toBeGreaterThan(5);
    expect(Object.values(s.rafts).filter((x) => x.building).length).toBeGreaterThan(2);
    // Promotions too: veterans went to sea, and some came back from the battles.
    expect(promoted).toBeGreaterThan(1);
    expect(s.reports.some((r) => Object.values(r.veteranSent ?? {}).some((n) => n > 0))).toBe(true);
    // Healing too: wounded from the battles were healed.
    expect(healed).toBeGreaterThan(1);
    // Research too: some finished along the way.
    expect(Object.values(s.techs).reduce((a, b) => a + (b ?? 0), 0)).toBeGreaterThan(richCity().techs.blades! + richCity().techs.sails!);
  });

  it("reads research, captains and rafts within the bounds of the rules; a missing id is level 0 or not owned yet", () => {
    expect(parseState(json(richCity()))).toEqual(richCity());
    expect(parseState(json({ ...richCity(), techs: {}, captains: {}, rafts: {} }))).not.toBeNull();
    const maxed = {
      ...richCity(),
      techs: Object.fromEntries(Object.entries(TECHS).map(([id, t]) => [id, t.max])),
      captains: { tom: { level: CAPTAIN_MAX_LEVEL, xp: 0, stars: 5 } },
      rafts: { [SLOT]: { hp: 100, building: "smokehouse", level: RAFT_BUILDING_MAX_LEVEL } },
      buildings: Object.fromEntries(BUILDING_IDS.map((id) => [id, LIGHTHOUSE_MAX])),
    };
    expect(parseState(json(maxed))).not.toBeNull();
  });

  it("resources, cargo and wrecks may hold decimals", () => {
    const s = newPlayerState();
    const r = sail(s, "camp-1");
    if (!r.ok) throw new Error(r.reason);
    const fleet = { ...r.state.fleets[0]!, cargo: { oil: 12.345, rope: 2 } };
    const wreck = SEA_SITES.find((x) => x.kind === "wreck")!;
    const city = { ...r.state, stock: { oil: 0.5, fish: 1e-9, wood: 99.99, rope: 0 }, morale: 83.5, fleets: [fleet], world: { ...s.world, wrecks: { ...s.world.wrecks, [wreck.id]: 0.25 } } };
    expect(parseState(json(city))).toEqual(city);
  });

  const s = richCity();
  const bad: [string, unknown][] = [
    ["a building at level −1", { ...s, buildings: { ...s.buildings, refinery: -1 } }],
    ["a building at level 2.5", { ...s, buildings: { ...s.buildings, refinery: 2.5 } }],
    [`a building above level ${LIGHTHOUSE_MAX}`, { ...s, buildings: { ...s.buildings, lighthouse: LIGHTHOUSE_MAX + 1 } }],
    ["troops in decimals", { ...s, troops: { ...s.troops, boarders: 10.5 } }],
    ["troops below 0", { ...s, troops: { ...s.troops, harpooners: -1 } }],
    ["wounded in decimals", { ...s, wounded: { ...s.wounded, crossbowmen: 0.1 } }],
    ["a resource below 0", { ...s, stock: { ...s.stock, fish: -0.01 } }],
    ["Pearls in decimals", { ...s, pearls: 200.5 }],
    ["survivors in decimals", { ...s, survivors: 8.5 }],
    ["survivors below 0", { ...s, survivors: -1 }],
    ["morale below 0", { ...s, morale: -0.5 }],
    ["an unknown research", { ...s, techs: { teleport: 1 } }],
    ["a research above its maximum", { ...s, techs: { blades: TECHS.blades.max + 1 } }],
    ["a research level in decimals", { ...s, techs: { blades: 1.5 } }],
    ["a lead captain inherited from Object (toString)", { ...s, lead: "toString" }],
    ["a lead captain inherited from Object (constructor)", { ...s, lead: "constructor" }],
    ["an unknown captain", { ...s, captains: { ...s.captains, blackbeard: { level: 1, xp: 0, stars: 1 } } }],
    [`a captain above level ${CAPTAIN_MAX_LEVEL}`, { ...s, captains: { tom: { level: CAPTAIN_MAX_LEVEL + 1, xp: 0, stars: 1 } } }],
    ["a captain at level 0", { ...s, captains: { tom: { level: 0, xp: 0, stars: 1 } } }],
    ["a captain without stars", { ...s, captains: { tom: { level: 1, xp: 0, stars: 0 } } }],
    ["a captain with xp below 0", { ...s, captains: { tom: { level: 1, xp: -1, stars: 1 } } }],
    ["a raft on an unknown slot", { ...s, rafts: { "0,0": { hp: 100, building: null, level: 0 } } }],
    [`a raft above level ${RAFT_BUILDING_MAX_LEVEL}`, { ...s, rafts: { [SLOT]: { hp: 100, building: "greenhouse", level: RAFT_BUILDING_MAX_LEVEL + 1 } } }],
    ["a raft with an unknown building", { ...s, rafts: { [SLOT]: { hp: 100, building: "casino", level: 1 } } }],
    ["a raft above 100 condition", { ...s, rafts: { [SLOT]: { hp: 101, building: null, level: 0 } } }],
    ["a raft below 0 condition", { ...s, rafts: { [SLOT]: { hp: -1, building: null, level: 0 } } }],
  ];
  for (const [name, city] of bad) {
    it(`refuses ${name}`, () => {
      expect(parseState(json(city))).toBeNull();
    });
  }

  it("refuses a report or a fleet with troops in decimals, or Pearls in decimals", () => {
    let c = newPlayerState();
    const r = sail(c, "camp-1");
    if (!r.ok) throw new Error(r.reason);
    c = advance(r.state, 8 * HOUR);
    const report = c.reports[0]!;
    expect(parseState(json({ ...c, reports: [{ ...report, losses: { ...report.losses, boarders: 1.5 } }] }))).toBeNull();
    expect(parseState(json({ ...c, reports: [{ ...report, level: 1.5 }] }))).toBeNull();
    const out = sail(newPlayerState(), "camp-1");
    if (!out.ok) throw new Error(out.reason);
    const fleet = out.state.fleets[0]!;
    // A bad fleet is dropped (cleanFleets), never kept as it is.
    expect(parseState(json({ ...out.state, fleets: [{ ...fleet, troops: { ...fleet.troops, boarders: 2.5 } }] }))?.fleets).toEqual([]);
    expect(parseState(json({ ...out.state, fleets: [{ ...fleet, pearls: 0.5 }] }))?.fleets).toEqual([]);
    expect(parseState(json({ ...out.state, fleets: [{ ...fleet, lead: { ...fleet.lead!, level: CAPTAIN_MAX_LEVEL + 1 } }] }))?.fleets).toEqual([]);
  });
});
