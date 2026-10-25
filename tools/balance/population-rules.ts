/**
 * The rules of `shared/` as the population study plays them (docs/studies/population.md). The balance's simulator
 * (`simulate.ts`) imports this module in place of `@brinelight/shared` when, and only when, `population-run.ts` runs
 * it (through `population-hooks.mjs`). Without a proposal, every rule is the shared one and a run is the balance's own;
 * with one, the survivors come and eat, the morale moves, the Houses stand on the plots won and the builders follow
 * the survivors (`population.ts`). Nothing is changed in `shared/`.
 *
 * It also writes down what the study measures: the population and the morale day by day, the fish made and eaten,
 * the hours without fish, the survivors the fleets brought, and the builders' free time by the Lighthouse's level.
 */
import * as rules from "@brinelight/shared";
import type { ActionResult, Cost, GameAction, PlayerState, RaftBuildingId, ServerId } from "@brinelight/shared";
import { arrivalsPerHour, buildersFor, houseCost, houseMaxLevel, moraleAfter, moraleAfterMists, room, type Proposal } from "./population.js";

export * from "@brinelight/shared";

/** The House's id on a raft, in the study only. */
export const HOUSE = "house";

/** One day of a run, as it ends. */
export type Day = {
  day: number;
  lighthouse: number;
  survivors: number;
  room: number;
  morale: number;
  builders: number;
  /** Houses standing, and their levels added up; rafts moored. */
  houses: number;
  houseLevels: number;
  rafts: number;
  /** Fish made by the city (the Fishery and the Greenhouses) and eaten by the survivors that day. */
  fishMade: number;
  fishEaten: number;
  /** Hours that day without fish. */
  hungry: number;
  fishFull: boolean;
};

/** The builders' time at one Lighthouse level: hours, and free builder hours, the player away (something could start) or nothing to start. */
export type Builders = { hours: number; away: number; nothing: number };

export type Study = {
  proposal: Proposal | null;
  /** Survivors on their way (a fraction of one), until they come. */
  coming: number;
  days: Day[];
  builders: Record<number, Builders>;
  arrived: number;
  rescued: number;
  /** Hours with every room taken, out of all hours. */
  fullHours: number;
  hours: number;
  /** The Fishery's last level, to play a city short of fish (none: the balance's player). */
  fisheryMax: number | null;
  /** How many times the rules' production of oil, fish and wood the city's buildings make (the idle study's option A: 3.5). */
  production: number;
  /** What the Houses and the rafts cost the city, wood and fish. */
  spent: { houses: { wood: number; fish: number }; rafts: { wood: number; fish: number } };
};

const fresh = (proposal: Proposal | null, fisheryMax: number | null = null, production = 1): Study => ({ proposal, coming: 0, days: [], builders: {}, arrived: 0, rescued: 0, fullHours: 0, hours: 0, fisheryMax, production, spent: { houses: { wood: 0, fish: 0 }, rafts: { wood: 0, fish: 0 } } });

/** Shared through the global object: the hooks' knob and `population-run.ts` may see this module under two names. */
const g = globalThis as { brinelightPopulationStudy?: Study; brinelightPopulation?: { builders: number } };
export const study: Study = (g.brinelightPopulationStudy ??= fresh(null));
const knob = (g.brinelightPopulation ??= { builders: rules.BUILDERS });

/** A new run: the study's measures from nothing, with this proposal (or the rules). */
export function begin(proposal: Proposal | null, fisheryMax: number | null = null, production = 1): void {
  Object.assign(study, fresh(proposal, fisheryMax, production));
}

const isHouse = (r: rules.Raft | undefined): boolean => (r?.building as string | null | undefined) === HOUSE;
export const houseLevels = (s: PlayerState): number => Object.values(s.rafts).reduce((n, r) => n + (isHouse(r) ? r.level : 0), 0);
export const roomOf = (s: PlayerState): number => (study.proposal ? room(study.proposal, s.buildings.shelters, houseLevels(s)) : rules.survivorCap(s.buildings.shelters));

/** The builders, as the simulator reads them: a live binding, set from the city at each step (the hooks read the knob). */
export let BUILDERS = rules.BUILDERS;
const buildersOf = (s: PlayerState) => (study.proposal ? buildersFor(study.proposal, s.survivors) : rules.builders(s.survivors));
/** The builders, as the simulator reads them (`builders`): the live count above, whatever the survivors given. */
export const builders = (_survivors: number): number => BUILDERS;
const sync = (s: PlayerState) => {
  BUILDERS = knob.builders = buildersOf(s);
};

export function newPlayerState(clock?: number, server?: ServerId): PlayerState {
  const s = rules.newPlayerState(clock, server);
  sync(s);
  return s;
}

const refuse = (reason: string): ActionResult => ({ ok: false, reason });

/** Builds a House on a free raft: the shipyard, as for the other raft buildings; at level 1 when done. */
function buildHouse(s: PlayerState, slot: string, p: Proposal): ActionResult {
  const raft = s.rafts[slot];
  if (!raft) return refuse("There is nothing here yet");
  if (raft.building) return refuse("There is already a building here");
  if (s.yard) return refuse(rules.YARD_BUSY);
  const cost = houseCost(p, 0);
  if (!rules.canPay(s.stock, cost)) return refuse("Not enough resources");
  const time = rules.installTime(s.buildings.lighthouse);
  return { ok: true, state: { ...s, stock: rules.payCost(s.stock, cost), yard: { slot, kind: "install", building: HOUSE as RaftBuildingId, left: time, duration: time } } };
}

/** Takes a House one level up at the shipyard, in the time a raft building takes. */
function upgradeHouse(s: PlayerState, slot: string, p: Proposal): ActionResult {
  const raft = s.rafts[slot]!;
  if (raft.level >= p.house!.maxLevel) return refuse("Max level");
  if (raft.level >= houseMaxLevel(p, s.buildings.lighthouse)) return refuse("Upgrade the Lighthouse first");
  if (raft.hp < rules.RAFT_DAMAGED_BELOW) return refuse("Mend this first");
  if (s.yard) return refuse(rules.YARD_BUSY);
  const cost = houseCost(p, raft.level);
  if (!rules.canPay(s.stock, cost)) return refuse("Not enough resources");
  const time = rules.raftUpgradeTime(raft.level);
  return { ok: true, state: { ...s, stock: rules.payCost(s.stock, cost), yard: { slot, kind: "upgrade", left: time, duration: time } } };
}

export function applyAction(state: PlayerState, action: GameAction): ActionResult {
  const p = study.proposal;
  const spend = (r: ActionResult, on: "houses" | "rafts") => {
    // The simulator tries some actions and keeps them only if the Lighthouse's reserve stays: written down as it keeps them.
    if (r.ok) pending = { on, wood: state.stock.wood - r.state.stock.wood, fish: state.stock.fish - r.state.stock.fish, after: r.state };
    return r;
  };
  if (p?.house && action.type === "installOnRaft" && (action.building as string) === HOUSE) return spend(buildHouse(state, action.slot, p), "houses");
  if (p?.house && action.type === "upgradeRaft" && isHouse(state.rafts[action.slot])) return spend(upgradeHouse(state, action.slot, p), "houses");
  if (study.fisheryMax !== null && action.type === "upgrade" && action.building === "fishery" && state.buildings.fishery >= study.fisheryMax) return refuse("The study keeps the Fishery here");
  sync(state);
  const r = rules.applyAction(state, action);
  if (r.ok) sync(r.state);
  return action.type === "dockRaft" ? spend(r, "rafts") : r;
}

/** The last spending tried, counted once the city goes on from it (the simulator kept it). */
let pending: { on: "houses" | "rafts"; wood: number; fish: number; after: PlayerState } | null = null;
const settle = (s: PlayerState) => {
  if (pending && pending.after.yard && s.yard === pending.after.yard) {
    study.spent[pending.on].wood += pending.wood;
    study.spent[pending.on].fish += pending.fish;
  }
  pending = null;
};

/**
 * Could the balance's player start an upgrade now, builders aside: the Lighthouse's next level paid in full, or another
 * building under its cap whose cost leaves the Lighthouse's reserve on what it spends (as `simulate.ts` plays it).
 */
function affordable(s: PlayerState): boolean {
  const lighthouseFree = !s.queue.some((j) => j.id === "lighthouse") && s.buildings.lighthouse < rules.LIGHTHOUSE_MAX;
  const reserve: Cost = {};
  if (lighthouseFree) {
    const storage = rules.storeCap(s.buildings.lighthouse, s.techs);
    for (const [k, v] of Object.entries(rules.upgradeCost("lighthouse", s.buildings.lighthouse)) as [keyof Cost, number][]) reserve[k] = Math.min(v, storage);
  }
  return rules.BUILDING_IDS.some((id) => {
    if (s.queue.some((j) => j.id === id) || s.buildings[id] >= rules.maxLevel(id, s.buildings)) return false;
    const cost = rules.upgradeCost(id, s.buildings[id]);
    if (!rules.canPay(s.stock, cost) || s.pearls < rules.upgradePearls(id, s.buildings[id])) return false;
    return id === "lighthouse" || (Object.entries(cost) as [keyof Cost, number][]).every(([k, v]) => s.stock[k] - v >= (reserve[k] ?? 0));
  });
}

export function advance(state: PlayerState, seconds: number): PlayerState {
  settle(state);
  sync(state);
  const hours = seconds / rules.HOUR;
  const b = (study.builders[state.buildings.lighthouse] ??= { hours: 0, away: 0, nothing: 0 });
  b.hours += hours;
  const free = Math.max(0, BUILDERS - state.queue.length);
  if (free > 0) b[affordable(state) ? "away" : "nothing"] += free * hours;

  // The fish made and eaten in this step, at its weather (the Mist slows the Fishery unless the Lighthouse is stoked).
  const w = { mist: rules.mistAt(state.clock, state.server).on, stoked: rules.isLit(state.clock, state.server, state.mist) };
  const making = rules.netRates({ ...state, buildings: { ...state.buildings, lighthouse: 0 }, survivors: 0 }, w);
  const made = making.fish * study.production;
  const eaten = making.fish - rules.netRates(state, w).fish;

  const p = study.proposal;
  const yard = state.yard;
  const houseUp = p && yard?.kind === "upgrade" && isHouse(state.rafts[yard.slot]) ? { slot: yard.slot, level: state.rafts[yard.slot]!.level } : null;
  let s = rules.advance(state, seconds);
  // The rules stop a raft building at their level 3: a House goes on to its own last level.
  if (houseUp && !s.yard && s.rafts[houseUp.slot]) s = { ...s, rafts: { ...s.rafts, [houseUp.slot]: { ...s.rafts[houseUp.slot]!, level: houseUp.level + 1 } } };
  if (study.production !== 1) {
    // What the city's buildings made in this step, made `production` times, within the storage (as the idle study).
    const cap = rules.storeCap(s.buildings.lighthouse, s.techs);
    const stock = { ...s.stock };
    for (const k of ["oil", "fish", "wood"] as const) if (stock[k] < cap) stock[k] = Math.min(cap, stock[k] + (Math.max(0, making[k]) * (study.production - 1) * seconds) / rules.HOUR);
    s = { ...s, stock };
  }

  if (p?.eats !== undefined && p.eats !== 1) {
    // The survivors eat `eats` times the rules' fish: what they did not eat goes back to the stock, within the storage.
    const back = (eaten * (1 - p.eats) * seconds) / rules.HOUR;
    const cap = rules.storeCap(s.buildings.lighthouse, s.techs);
    if (s.stock.fish < cap) s = { ...s, stock: { ...s.stock, fish: Math.min(cap, s.stock.fish + back) } };
  }
  const fed = s.stock.fish > 0;
  if (p) {
    // The survivors the fleets back home bring: one a wreck salvaged, two a camp beaten.
    const back = state.fleets.filter((f) => f.kind === "collect" && rules.seaSite(f.site)?.kind === "wreck" && !s.fleets.some((x) => x.site === f.site && x.kind === f.kind)).length;
    const won = s.reports.slice(s.reports.length - Math.min(s.reports.length, s.reportSeq - state.reportSeq)).filter((r) => r.win && rules.seaSite(r.site)?.kind === "camp").length;
    const rescued = back * p.rescues.wreck + won * p.rescues.camp;
    let morale = moraleAfterMists(p, state.morale, s.mist.held - state.mist.held, s.mist.missed - state.mist.missed);
    morale = moraleAfter(p, morale, fed, hours);
    study.coming += arrivalsPerHour(p, state.buildings.lighthouse, morale, fed) * hours;
    const whole = Math.floor(study.coming);
    study.coming -= whole;
    const space = Math.max(0, roomOf(s) - s.survivors);
    const come = Math.min(space, whole);
    const saved = Math.min(space - come, rescued);
    study.arrived += come;
    study.rescued += saved;
    // No room: no one waits on the way.
    if (space - come - saved <= 0) study.coming = 0;
    s = { ...s, survivors: s.survivors + come + saved, morale };
    study.hours += hours;
    if (s.survivors >= roomOf(s)) study.fullHours += hours;
  }
  sync(s);

  const day = Math.floor((s.clock - 1) / rules.DAY);
  const last = study.days.at(-1);
  const row: Day =
    last && last.day === day
      ? last
      : { day, lighthouse: 0, survivors: 0, room: 0, morale: 0, builders: 0, houses: 0, houseLevels: 0, rafts: 0, fishMade: 0, fishEaten: 0, hungry: 0, fishFull: false };
  if (row !== last) study.days.push(row);
  row.lighthouse = s.buildings.lighthouse;
  row.survivors = s.survivors;
  row.room = roomOf(s);
  row.morale = s.morale;
  row.builders = BUILDERS;
  row.houses = Object.values(s.rafts).filter(isHouse).length;
  row.houseLevels = houseLevels(s);
  row.rafts = Object.keys(s.rafts).length;
  row.fishMade += (made * seconds) / rules.HOUR;
  row.fishEaten += (eaten * (p?.eats ?? 1) * seconds) / rules.HOUR;
  if (!fed) row.hungry += hours;
  row.fishFull = s.stock.fish >= rules.storeCap(s.buildings.lighthouse, s.techs) - 1;
  return s;
}
