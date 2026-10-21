/**
 * A study, not a rule (docs/studies/depletion.md): "the island runs out of breath". Each resource of the island (wood,
 * fish, oil) has a reserve from 0 to 1. Harvesting lowers it, faster as the Lumberyard, the Fishery and the Refinery
 * go up; it fills again with time, faster when less is harvested. The island's production is the rules' production
 * times (floor + (1 − floor) × reserve). The players and their choices are the balance's (simulate.ts); the rules of
 * shared/ are played as they are, and nothing here changes them: the study scales the three producers' levels while
 * the rules advance the city, then puts the true levels back.
 */
import {
  BUILDERS,
  COLLECT_STAY,
  HOUR,
  DAY,
  SEA_SITES,
  WRECK_REFILL,
  advance,
  applyAction,
  distance,
  fleetsMax,
  holdCapacity,
  isLit,
  leadOf,
  lightReach,
  mistAt,
  netRates,
  storeCap,
  travelTime,
  upgradeCost,
  type GameAction,
  type PlayerState,
} from "@brinelight/shared";
import { FOUNDED, simulate, type Block, type Profile, type Run } from "./simulate.js";

export type IslandResource = "oil" | "fish" | "wood";
export const ISLAND: readonly IslandResource[] = ["oil", "fish", "wood"];
const PRODUCER: Record<IslandResource, "refinery" | "fishery" | "lumberyard"> = { oil: "refinery", fish: "fishery", wood: "lumberyard" };

/**
 * A setting of the depletion. `floor`: the share of its production the island keeps with an empty reserve (null: no
 * depletion, the game as it is). The speeds, per real hour:
 * - `sustain`: the producer's level the island renews by itself: harvesting at or below it never lowers the reserve;
 * - `draw`: what each level above `sustain` takes from the reserve per hour of harvest;
 * - `regrowWork`: how fast the reserve fills again while harvested (share of what is missing, per hour);
 * - `regrowRest`: the same while nothing is harvested (the storage is full) or while the island rests;
 * - `restAfter`: real seconds without a session after which the island rests: it is no longer worn, and gives only
 *   its floor while it rests (`fallow`; without it, it gives as its reserve allows, which favors the player away).
 */
export type Setting = { id: string; name: string; floor: number | null; sustain: number; draw: number; regrowWork: number; regrowRest: number; restAfter: number; fallow: boolean };

/**
 * The speeds proposed (the same for the three settings, so that only the floor tells them apart): the island renews
 * 7 levels of each producer; harvested without a pause, the reserve settles at 1 − (level − 7) / 8 (0.875 at level 8,
 * 0.5 at 11, empty from 15), within about two days (regrowWork = 1/48); resting, it fills again in about a day
 * (regrowRest = 1/8: 95 % in a day). Past 30 hours without a session the island rests (a player away comes back to
 * full reserves; one session a day never reaches it).
 */
export const SPEEDS = { sustain: 7, draw: 1 / 384, regrowWork: 1 / 48, regrowRest: 1 / 8, restAfter: 30 * HOUR, fallow: true } as const;

export const SETTINGS: readonly Setting[] = [
  { id: "none", name: "No depletion (the game today)", floor: null, ...SPEEDS },
  { id: "soft", name: "Soft (floor 60 %)", floor: 0.6, ...SPEEDS },
  { id: "medium", name: "Medium (floor 40 %)", floor: 0.4, ...SPEEDS },
  { id: "strong", name: "Strong (floor 25 %)", floor: 0.25, ...SPEEDS },
];

/** The sea as it is (wrecks and camps), or with the Fish Shoals and Wooded Isles of the map open as wrecks are (a guess). */
export type SeaMode = "today" | "full";

/** The Tide: +15 % to one island resource's harvest, a week each, in turn (a variant). */
export const TIDE_BONUS = 0.15;
const TIDE_ORDER: readonly IslandResource[] = ["wood", "fish", "oil"];
export const tideOn = (clock: number): IslandResource => TIDE_ORDER[Math.floor((clock - FOUNDED) / (7 * DAY)) % TIDE_ORDER.length]!;

/** The Lighthouse's levels, grouped for the shares of island and sea. */
export const BRACKETS: readonly [number, number][] = [
  [1, 7],
  [8, 10],
  [11, 15],
  [16, 20],
  [21, 25],
  [26, 30],
];
export const bracketOf = (level: number): number => BRACKETS.findIndex(([a, b]) => level >= a && level <= b);

type Amounts = Record<IslandResource | "rope", number>;
const none = (): Amounts => ({ oil: 0, fish: 0, wood: 0, rope: 0 });

export type StudyDay = {
  day: number;
  lighthouse: number;
  reserve: Record<IslandResource, number>;
  /** The island's production, in share of the rules' (the reserve's effect, and the Tide's). */
  output: Record<IslandResource, number>;
  /** Hours a builder stayed free while the last session found nothing it could pay for. */
  waitHours: number;
  stock: Record<IslandResource, number>;
  storage: number;
};

export type StudyRun = {
  setting: Setting;
  profile: Profile;
  seaMode: SeaMode;
  tide: boolean;
  run: Run;
  days: StudyDay[];
  /** By bracket of the Lighthouse: what the island gave (harvested, not lost to a full storage) and what the sea brought. */
  island: Amounts[];
  fromSea: Amounts[];
  /** By bracket: hours a builder waited for resources, and the days spent in the bracket. */
  waits: number[];
  bracketDays: number[];
  /** The city as it was when each Lighthouse level was reached (for the Mist's margin and the spiral). */
  snapshots: Record<number, PlayerState>;
};

/** The hypothetical sites of the full sea: the map's Fish Shoals and Wooded Isles, emptied and refilled as wrecks are. */
const EXTRA = SEA_SITES.filter((x) => x.kind === "fish" || x.kind === "isle").sort((a, b) => distance(a) - distance(b));
type Trip = { site: string; resource: "fish" | "wood"; phase: "out" | "stay" | "back"; left: number; travel: number; hold: number; got: number };

/** Plays one profile under one setting. */
export function study(setting: Setting, profile: Profile, days: number, options: { sea?: SeaMode; tide?: boolean } = {}): StudyRun {
  const seaMode = options.sea ?? "today";
  const tide = options.tide ?? false;
  const reserve: Record<IslandResource, number> = { oil: 1, fish: 1, wood: 1 };
  const island = BRACKETS.map(none);
  const fromSea = BRACKETS.map(none);
  const waits = BRACKETS.map(() => 0);
  const bracketDays = BRACKETS.map(() => 0);
  const snapshots: Record<number, PlayerState> = {};
  const rows: StudyDay[] = [];
  const trips: Trip[] = [];
  const sites: Record<string, { left: number; refill: number }> = Object.fromEntries(EXTRA.map((x) => [x.id, { left: x.amount ?? 0, refill: 0 }]));
  let lastBlock: Block | null = null;
  let lastSession = FOUNDED;
  let dayWait = 0;
  let dayEnd = DAY;

  /** The island's production in share of the rules', for a resource, now. */
  const resting = (clock: number) => clock - lastSession > setting.restAfter;
  const output = (k: IslandResource, clock: number) => {
    const depleted = setting.floor === null ? 1 : setting.fallow && resting(clock) ? setting.floor : setting.floor + (1 - setting.floor) * reserve[k];
    return depleted * (tide && tideOn(clock) === k ? 1 + TIDE_BONUS : 1);
  };

  /** Moves the city on by `dt`, with no fleet's phase ending inside it. */
  const sub = (s: PlayerState, dt: number): PlayerState => {
    const weather = { mist: mistAt(s.clock).on, stoked: isLit(s.clock, s.mist) };
    const share = Object.fromEntries(ISLAND.map((k) => [k, output(k, s.clock)])) as Record<IslandResource, number>;
    const without = netRates({ ...s, buildings: { ...s.buildings, refinery: 0, fishery: 0, lumberyard: 0 } }, weather);
    const full = netRates(s, weather);
    const levels = { refinery: s.buildings.refinery, fishery: s.buildings.fishery, lumberyard: s.buildings.lumberyard };
    const scaled: PlayerState = {
      ...s,
      buildings: { ...s.buildings, refinery: levels.refinery * share.oil, fishery: levels.fishery * share.fish, lumberyard: levels.lumberyard * share.wood },
    };
    // The fleets home by the end of this step bring their cargo (each step ends where a fleet's phase does).
    const home = s.fleets.filter((f) => f.phase === "back" && f.left <= dt);
    let a = advance(scaled, dt);
    a = {
      ...a,
      buildings: {
        ...a.buildings,
        refinery: levels.refinery + Math.round(a.buildings.refinery - scaled.buildings.refinery),
        fishery: levels.fishery + Math.round(a.buildings.fishery - scaled.buildings.fishery),
        lumberyard: levels.lumberyard + Math.round(a.buildings.lumberyard - scaled.buildings.lumberyard),
      },
    };
    const b = bracketOf(s.buildings.lighthouse);
    const brought = none();
    for (const f of home) for (const k of ["oil", "fish", "wood", "rope"] as const) brought[k] += f.cargo[k] ?? 0;
    // The hypothetical shoals and isles: trips move on, cargo comes home.
    for (const tr of trips) {
      tr.left -= dt;
      if (tr.left > 0) continue;
      if (tr.phase === "out") (tr.phase = "stay"), (tr.left = COLLECT_STAY);
      else if (tr.phase === "stay") {
        const site = sites[tr.site]!;
        tr.got = Math.min(tr.hold, site.left);
        site.left -= tr.got;
        if (site.left <= 0) site.refill = WRECK_REFILL;
        tr.phase = "back";
        tr.left = tr.travel;
      } else {
        a = { ...a, stock: { ...a.stock, [tr.resource]: a.stock[tr.resource] + tr.got } };
        brought[tr.resource] += tr.got;
        tr.left = -1;
      }
    }
    for (let i = trips.length - 1; i >= 0; i--) if (trips[i]!.left === -1) trips.splice(i, 1);
    for (const x of EXTRA) {
      const site = sites[x.id]!;
      if (site.refill <= 0) continue;
      site.refill -= dt;
      if (site.refill <= 0) (site.refill = 0), (site.left = x.amount ?? 0);
    }
    for (const k of ["oil", "fish", "wood", "rope"] as const) fromSea[b]![k] += brought[k];
    // What the island gave, and how it wore: harvested only while the storage had room.
    const cap = storeCap(s.buildings.lighthouse, s.techs);
    const h = dt / HOUR;
    for (const k of ISLAND) {
      const gross = Math.max(0, full[k] - without[k]) * share[k];
      const net = (full[k] - without[k]) * share[k] + without[k];
      const before = s.stock[k];
      const after = a.stock[k] - brought[k];
      const used = before >= cap ? 0 : after < cap ? 1 : net > 0 ? Math.min(1, (cap - before) / (net * h)) : 1;
      island[b]![k] += gross * h * used;
      const level = s.buildings[PRODUCER[k]];
      const tideDraw = tide && tideOn(s.clock) === k ? 1 + TIDE_BONUS : 1;
      const wear = resting(s.clock) ? 0 : used;
      const draw = wear * setting.draw * Math.max(0, level - setting.sustain) * tideDraw;
      const regrow = (setting.regrowRest * (1 - wear) + setting.regrowWork * wear) * (1 - reserve[k]);
      reserve[k] = Math.min(1, Math.max(0, reserve[k] + (regrow - draw) * h));
    }
    if (lastBlock?.reason === "resources" && a.queue.length < BUILDERS) {
      waits[b]! += h;
      dayWait += h;
    }
    bracketDays[b]! += dt / DAY;
    if (a.buildings.lighthouse > s.buildings.lighthouse) snapshots[a.buildings.lighthouse] = a;
    return a;
  };

  const step = (state: PlayerState, seconds: number): PlayerState => {
    let s = state;
    let rest = seconds;
    while (rest > 0) {
      const ends = [...s.fleets.map((f) => f.left), ...trips.map((t) => t.left)].filter((l) => l > 0);
      const dt = Math.min(rest, ...ends);
      s = sub(s, dt);
      rest -= dt;
      while (s.clock >= dayEnd) endOfDay(s);
    }
    return s;
  };

  const endOfDay = (s: PlayerState) => {
    rows.push({
      day: Math.round(dayEnd / DAY),
      lighthouse: s.buildings.lighthouse,
      reserve: { ...reserve },
      output: Object.fromEntries(ISLAND.map((k) => [k, output(k, s.clock - 1)])) as Record<IslandResource, number>,
      waitHours: dayWait,
      stock: { oil: s.stock.oil, fish: s.stock.fish, wood: s.stock.wood },
      storage: storeCap(s.buildings.lighthouse, s.techs),
    });
    dayWait = 0;
    dayEnd += DAY;
  };

  /**
   * The hypothetical shoals and isles: while the Lighthouse's next level lacks wood or fish, up to half the free fleets
   * sail to the nearest isle or shoal of what it lacks most (the wrecks take the rest).
   */
  const beforeWrecks = (s: PlayerState) => {
    if (seaMode !== "full") return;
    const lead = leadOf(s.lead, s.captains);
    const reach = mistAt(s.clock).on ? lightReach(s.buildings.lighthouse, isLit(s.clock, s.mist)) : Infinity;
    const cost = upgradeCost("lighthouse", s.buildings.lighthouse);
    const free = fleetsMax(s.buildings.harbor) - s.fleets.length - trips.length;
    const lack = (k: "fish" | "wood") => (cost[k] ?? 0) - s.stock[k] - trips.filter((t) => t.resource === k).reduce((n, t) => n + t.hold, 0);
    for (let n = 0; n < Math.ceil(free / 2); n++) {
      const wanted = (["wood", "fish"] as const).filter((k) => lack(k) > 0).sort((a, b) => lack(b) - lack(a));
      const target = wanted
        .map((k) => EXTRA.find((x) => x.kind === (k === "fish" ? "fish" : "isle") && sites[x.id]!.left > 0 && !trips.some((t) => t.site === x.id) && distance(x) <= reach))
        .find((x) => x);
      if (!target) return;
      const travel = travelTime(target, s.techs, lead);
      trips.push({ site: target.id, resource: target.kind === "fish" ? "fish" : "wood", phase: "out", left: travel, travel, hold: holdCapacity(s.buildings.harbor, s.techs, lead), got: 0 });
    }
  };

  const run = simulate(profile, days, {
    advance: step,
    busyFleets: () => trips.length,
    beforeWrecks,
    onSession: (s, block) => {
      lastBlock = block;
      lastSession = s.clock;
    },
  });
  return { setting, profile, seaMode, tide, run, days: rows, island, fromSea, waits, bracketDays, snapshots };
}

/** The Mist's oil with the island at its floor, a day at a Lighthouse level, with the city as it was then. */
export type MistMargin = { level: number; refinery: number; refining: number; produced: number; burnt: number; margin: number; held: boolean };

/**
 * A day of oil at the floor (an empty reserve): what the Refinery makes in 24 hours (stoked in the three Mists, so no
 * slowdown) against what the Lighthouse burns (18 hours as usual, 6 stoked). `margin`: what is left, in share of
 * what is burnt; `held`: every Mist of the day is held with no oil in store and no sea.
 */
export function mistMargin(floor: number, s: PlayerState): MistMargin {
  const calm = netRates(s);
  const stoked = netRates(s, { mist: true, stoked: true });
  const without = netRates({ ...s, buildings: { ...s.buildings, refinery: 0 } });
  const withoutStoked = netRates({ ...s, buildings: { ...s.buildings, refinery: 0 } }, { mist: true, stoked: true });
  const make = (calm.oil - without.oil) * floor;
  const makeStoked = (stoked.oil - withoutStoked.oil) * floor;
  const produced = make * 18 + makeStoked * 6;
  const burnt = -without.oil * 18 - withoutStoked.oil * 6;
  // Held with nothing in store: the oil made between two Mists covers what each Mist burns beyond what it makes.
  const perMist = Math.max(0, -withoutStoked.oil - makeStoked) * 2;
  const between = Math.max(0, make + without.oil) * 6;
  return { level: s.buildings.lighthouse, refinery: s.buildings.refinery, refining: s.techs.refining ?? 0, produced, burnt, margin: produced / burnt - 1, held: between >= perMist };
}

/**
 * The spiral, looked for: the city as it was at a Lighthouse level, its oil gone and its island at the floor, no sea,
 * nothing built; the order to stoke on; repairs as the player of the balance makes them (as soon as a raft is below
 * 60) or never. Returns the Mists missed day by day for `days` days.
 */
export function spiral(floor: number, start: PlayerState, days: number, repairs: boolean): number[] {
  const share = floor;
  let s: PlayerState = { ...start, stock: { ...start.stock, oil: 0 }, queue: [], research: null, training: null, healing: null, fleets: [], yard: null, mist: { ...start.mist, stoke: true, dark: false } };
  const levels = { refinery: s.buildings.refinery, fishery: s.buildings.fishery, lumberyard: s.buildings.lumberyard };
  const missed: number[] = [];
  let ids = 0;
  for (let d = 0; d < days; d++) {
    const before = s.mist.missed;
    for (let hour = 0; hour < 24; hour++) {
      if (repairs && !s.yard && Object.values(s.rafts).some((r) => r.hp < 60)) {
        const r = applyAction(s, { type: "repairRafts", id: `00000000-0000-4000-8000-${(++ids).toString(16).padStart(12, "0")}` } as GameAction);
        if (r.ok) s = r.state;
      }
      const scaled = { ...s, buildings: { ...s.buildings, refinery: levels.refinery * share, fishery: levels.fishery * share, lumberyard: levels.lumberyard * share } };
      const a = advance(scaled, HOUR);
      s = { ...a, buildings: { ...a.buildings, ...levels } };
    }
    missed.push(s.mist.missed - before);
  }
  return missed;
}
