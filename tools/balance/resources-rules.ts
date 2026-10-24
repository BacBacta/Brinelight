/**
 * The rules of `shared/` as the resources study plays them (docs/studies/resources.md). The balance's simulator
 * (`simulate.ts`) imports this module in place of `@brinelight/shared` when, and only when, `resources-run.ts` runs
 * it (through `resources-hooks.mjs`): every rule is the shared one, except what a study variant changes through the
 * knobs the hooks add, and nothing is changed in `shared/`. Without a variant, a run is the balance's own.
 *
 * It also writes down what the study measures: why the builders wait (the resources or the player away), what the
 * storage cuts off, where each resource comes from, and what the player can start when they wake up.
 */
import * as rules from "@brinelight/shared";
import type { ActionResult, Buildings, EconomyState, Fleet, GameAction, PlayerState, Resource, ServerId, Techs, Weather } from "@brinelight/shared";

export * from "@brinelight/shared";

type Res = "oil" | "fish" | "wood";
const RES: readonly Res[] = ["oil", "fish", "wood"];
/** The producer of each resource. */
export const PRODUCER = { oil: "refinery", fish: "fishery", wood: "lumberyard" } as const;

/** A study variant: what it changes in the rules, for the study's runs only. */
export type Variant = {
  id: string;
  name: string;
  /** A: a producer of this level makes what the rules' producer of `production(producer, level)` makes. */
  production?: (producer: (typeof PRODUCER)[Res], level: number) => number;
  /** B: the storage holds at least this many hours of the island's production at full producers. */
  storageHours?: number;
  /**
   * C: the Wooded Isles and Fish Shoals open to the fleets, as the wrecks: what one holds at this Lighthouse level (the
   * map's amount at level 1), and the real seconds an emptied one waits before it fills again.
   */
  harvest?: { amount: (base: number, lighthouse: number) => number; refill: number };
  /** D: the builders at this Lighthouse level (the rules: 2). */
  builders?: (lighthouse: number) => number;
};

/** Where a resource came from. */
export type Source = "buildings" | "wrecks" | "isles" | "shoals" | "camps" | "rewards";
export const SOURCES: readonly Source[] = ["buildings", "wrecks", "isles", "shoals", "camps", "rewards"];

/** A morning: the first session after a night (6 hours or more without one), before noon. */
export type Morning = { day: number; lighthouse: number; builderFree: boolean; affordable: boolean };

export type Measures = {
  /** Builder hours left free, by day (the founding day is 0): short of resources, capped, or the player away. */
  idle: Record<number, { short: number; capped: number; away: number }>;
  /** What the storage cut off, by day: the island's production. */
  lost: Record<number, Record<Res, number>>;
  /** What fleets brought back and could not unload, the storage full, by day. */
  leftAtSea: Record<number, Record<Res, number>>;
  /** What came in, by Lighthouse level and source (production before what is cut off). */
  income: Record<number, Record<Source, Record<Res, number>>>;
  mornings: Morning[];
};

const emptyMeasures = (): Measures => ({ idle: {}, lost: {}, leftAtSea: {}, income: {}, mornings: [] });

type Knobs = {
  netRates?: (s: EconomyState, w: Weather | undefined, rulesNetRates: (s: EconomyState, w?: Weather) => Record<Res, number>) => Record<Res, number>;
  storeCap?: (lighthouse: number, techs: Techs, rulesStoreCap: (lighthouse: number, techs?: Techs) => number) => number;
  stockStep?: (stock: Record<Resource, number>, rates: Record<Res, number>, seconds: number, cap: number) => void;
  builders?: (buildings: Buildings) => number;
  harvest?: boolean;
  amount?: (siteId: string, lighthouse: number) => number | undefined;
  refill?: (siteId: string) => number | undefined;
  cargo?: (siteId: string, got: number, lighthouse: number) => Partial<Record<Resource, number>> | undefined;
  landed?: (f: Fleet, k: Resource, brought: number, added: number) => void;
};

type Study = { variant: Variant | null; m: Measures; day: number; lighthouse: number };
/** Shared through the global object: the hooks' knobs and `resources-run.ts` may see this module under two names. */
const g = globalThis as { brinelightResourcesStudy?: Study; brinelightResources?: Knobs };
export const study: Study = (g.brinelightResourcesStudy ??= { variant: null, m: emptyMeasures(), day: 0, lighthouse: 1 });

const add = (to: Record<Res, number>, k: Res, v: number) => (to[k] += v);
const zero = (): Record<Res, number> => ({ oil: 0, fish: 0, wood: 0 });
const lostOn = (day: number) => (study.m.lost[day] ??= zero());
const incomeOf = (lighthouse: number, source: Source) => ((study.m.income[lighthouse] ??= Object.fromEntries(SOURCES.map((s) => [s, zero()])) as Record<Source, Record<Res, number>>)[source]);

/** The island's production per hour at full producers (each at the Lighthouse's level), its best resource. */
export function peakProduction(lighthouse: number, techs: Techs = {}): number {
  const b = { ...rules.STARTING_BUILDINGS, lighthouse: 0, refinery: lighthouse, fishery: lighthouse, lumberyard: lighthouse };
  const r = rules.netRates({ buildings: b, techs, rafts: {}, survivors: 0, morale: 0 });
  return Math.max(r.oil, r.fish, r.wood);
}

/** Sets the variant for the runs that follow (null: the rules), with fresh measures. */
export function useVariant(v: Variant | null): void {
  study.variant = v;
  study.m = emptyMeasures();
  const P = v?.production;
  g.brinelightResources = {
    netRates: P
      ? (s, w, own) => own({ ...s, buildings: { ...s.buildings, refinery: P("refinery", s.buildings.refinery), fishery: P("fishery", s.buildings.fishery), lumberyard: P("lumberyard", s.buildings.lumberyard) } }, w)
      : undefined,
    storeCap: v?.storageHours ? (lighthouse, techs, own) => Math.max(own(lighthouse, techs), Math.round(v.storageHours! * peakProduction(lighthouse, techs))) : undefined,
    stockStep: (stock, rates, seconds, cap) => {
      for (const k of RES) {
        const over = stock[k] + (rates[k] * seconds) / rules.HOUR - Math.max(cap, stock[k]);
        if (over > 0) add(lostOn(study.day), k, over);
      }
    },
    builders: v?.builders ? (b) => v.builders!(b.lighthouse) : undefined,
    harvest: !!v?.harvest,
    amount: v?.harvest
      ? (id, lighthouse) => {
          const site = rules.seaSite(id);
          return site && (site.kind === "isle" || site.kind === "fish") ? Math.round(v.harvest!.amount(site.amount ?? 0, lighthouse)) : undefined;
        }
      : undefined,
    refill: v?.harvest ? (id) => (rules.seaSite(id)?.kind === "wreck" ? undefined : v.harvest!.refill) : undefined,
    cargo: v?.harvest
      ? (id, got) => {
          const kind = rules.seaSite(id)?.kind;
          return kind === "isle" ? { wood: got } : kind === "fish" ? { fish: got } : undefined;
        }
      : undefined,
    landed: (f, k, brought, added) => {
      if (k === "rope") return;
      const kind = rules.seaSite(f.site)?.kind;
      const source: Source = f.kind === "attack" ? "camps" : kind === "isle" ? "isles" : kind === "fish" ? "shoals" : "wrecks";
      add(incomeOf(study.lighthouse, source), k, added);
      if (brought > added) add((study.m.leftAtSea[study.day] ??= zero()), k, brought - added);
    },
  };
}

/** The builders, as the simulator reads them: a live binding, set from the city at each step. */
export let BUILDERS = rules.BUILDERS;
const buildersOf = (s: PlayerState) => study.variant?.builders?.(s.buildings.lighthouse) ?? rules.BUILDERS;

/** Why the free builders of a session's end stay free: the resources (or Pearls), or nothing left below the Lighthouse. */
let sessionEnd: { short: number; capped: number } | null = null;
let acted = false;
let lastAction = -Infinity;

const hasWork = (s: PlayerState) => {
  const queued = new Set(s.queue.map((j) => j.id));
  return rules.BUILDING_IDS.some((id) => !queued.has(id) && (id === "lighthouse" ? s.buildings.lighthouse < rules.LIGHTHOUSE_MAX : s.buildings[id] < s.buildings.lighthouse));
};

/** At a morning: can the Lighthouse, or a producer below it, be paid for now? And is a builder free? */
function morning(s: PlayerState): Morning {
  const queued = new Set(s.queue.map((j) => j.id));
  const pays = (id: rules.BuildingId) => !queued.has(id) && rules.canPay(s.stock, rules.upgradeCost(id, s.buildings[id])) && s.pearls >= rules.upgradePearls(id, s.buildings[id]);
  const lighthouse = s.buildings.lighthouse < rules.LIGHTHOUSE_MAX && pays("lighthouse");
  const producer = RES.some((k) => s.buildings[PRODUCER[k]] < s.buildings.lighthouse && pays(PRODUCER[k]));
  return { day: Math.floor(s.clock / rules.DAY), lighthouse: s.buildings.lighthouse, builderFree: s.queue.length < buildersOf(s), affordable: lighthouse || producer };
}

export function newPlayerState(clock?: number, server?: ServerId): PlayerState {
  const s = rules.newPlayerState(clock, server);
  BUILDERS = buildersOf(s);
  sessionEnd = null;
  acted = false;
  lastAction = s.clock;
  return s;
}

export function applyAction(state: PlayerState, action: GameAction): ActionResult {
  if (!acted && state.clock - lastAction >= 6 * rules.HOUR && state.clock % rules.DAY < 12 * rules.HOUR) study.m.mornings.push(morning(state));
  acted = true;
  lastAction = state.clock;
  const r = rules.applyAction(state, action);
  if (r.ok && (action.type === "claimObjective" || action.type === "claimChest")) {
    for (const k of RES) if (r.state.stock[k] > state.stock[k]) add(incomeOf(state.buildings.lighthouse, "rewards"), k, r.state.stock[k] - state.stock[k]);
  }
  if (r.ok) BUILDERS = buildersOf(r.state);
  return r;
}

export function advance(state: PlayerState, seconds: number): PlayerState {
  const day = Math.floor(state.clock / rules.DAY);
  const builders = buildersOf(state);
  if (acted) {
    // The session just ended: its free builders stay free until the next one.
    const free = Math.max(0, builders - state.queue.length);
    sessionEnd = hasWork(state) ? { short: free, capped: 0 } : { short: 0, capped: free };
    acted = false;
  }
  const busy = state.queue.reduce((n, j) => n + Math.min(Math.max(0, j.left), seconds), 0);
  const idle = (builders * seconds - busy) / rules.HOUR;
  const short = Math.min(idle, ((sessionEnd?.short ?? 0) * seconds) / rules.HOUR);
  const capped = Math.min(idle - short, ((sessionEnd?.capped ?? 0) * seconds) / rules.HOUR);
  const today = (study.m.idle[day] ??= { short: 0, capped: 0, away: 0 });
  today.short += short;
  today.capped += capped;
  today.away += idle - short - capped;
  // What the buildings make in this step, before what is eaten and burned, and before the storage cuts it off.
  const w = { mist: rules.mistAt(state.clock, state.server).on, stoked: rules.isLit(state.clock, state.server, state.mist) };
  const made = rules.netRates({ ...state, buildings: { ...state.buildings, lighthouse: 0 }, survivors: 0 }, w);
  for (const k of RES) add(incomeOf(state.buildings.lighthouse, "buildings"), k, (Math.max(0, made[k]) * seconds) / rules.HOUR);
  study.day = day;
  study.lighthouse = state.buildings.lighthouse;
  const s = rules.advance(state, seconds);
  BUILDERS = buildersOf(s);
  return s;
}
