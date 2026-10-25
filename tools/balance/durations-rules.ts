/**
 * The rules of `shared/` as the durations study plays them (docs/studies/durations.md). The balance's simulator
 * (`simulate.ts`) imports this module in place of `@brinelight/shared` when, and only when, `durations-run.ts` runs it
 * (through `durations-hooks.mjs`): every rule is the shared one, word for word, except an upgrade's duration when the
 * study sets other times, the alliance's help when it is, and the costs when a cost option is. Nothing is changed in `shared/`. Without any of them, a run is the balance's own (checked by `durations-run.ts`
 * before anything else).
 *
 * It also writes down every upgrade started, and, hour by hour, what the builders did.
 */
import * as rules from "@brinelight/shared";
import type { ActionResult, BuildingId, Cost, GameAction, PlayerState } from "@brinelight/shared";

export * from "@brinelight/shared";

/**
 * The alliance's help (studied, never in the game): `count` allies each take `minutes` off an upgrade of level 6 or
 * more, never more than half of it. The study assumes every help comes: an alliance active enough to give them all.
 */
export type Help = { count: number; minutes: number };

/** An upgrade started: when, which building, the level it goes to, and its time once helped. */
export type Started = { clock: number; id: BuildingId; level: number; seconds: number };

/**
 * Hours, by the Lighthouse's level at the time: the hours spent at that level; builder hours left free while
 * something could start (the player away); builder hours left free with nothing to start (short of resources, or
 * every building at the Lighthouse's level); and hours with both builders busy while something else could start
 * (everything waits for a build).
 */
export type Builders = { hours: number; away: number; nothing: number; waitBuild: number; held?: number };

/**
 * A cost option (studied, never in the game): the cost to go from `level` to `level + 1` in its place, or null where the
 * rules' cost stays. `docs/studies/durations.md` and `docs/studies/costs.md` use it past level 15.
 */
export type Costs = (id: BuildingId, level: number) => Cost | null;

/** The other buildings, past level `from`, cost `growth` times their level before (the rules: 1.6 a level to 30). */
export const growthPast = (from: number, growth: number): Costs => (id, level) => {
  if (id === "lighthouse" || level <= from) return null;
  const at = rules.upgradeCost(id, from);
  return rules.roundCost(Object.fromEntries(Object.entries(at).map(([k, v]) => [k, v * growth ** (level - from)])) as Cost);
};

/** Other build times than the rules': the time to reach `level`, in real seconds. */
export type Times = (id: BuildingId, level: number) => number;

/**
 * A production option (studied, never in the game): how many times the rules' production of oil, fish and wood the
 * city's buildings make, from its state (the rules: 1). What the Lighthouse burns and the survivors eat do not change.
 */
export type Production = (s: PlayerState) => number;

export type Study = { time: Times | null; help: Help | null; costs: Costs | null; production?: Production | null; started: Started[]; seen: Set<string>; builders: Record<number, Builders> };

/** Shared with `durations-run.ts` through the global object: the two may load this module under two names. */
const g = globalThis as { brinelightDurationsStudy?: Study };
export const study: Study = (g.brinelightDurationsStudy ??= { time: null, help: null, costs: null, started: [], seen: new Set(), builders: {} });

/** The time an upgrade to `level` takes in the study: the study's times (or the rules'), less the alliance's help. */
export function studyTime(id: BuildingId, level: number, rulesSeconds: number): number {
  const seconds = study.time ? study.time(id, level) : rulesSeconds;
  if (!study.help || level < 6) return seconds;
  return Math.round(seconds - Math.min(study.help.count * study.help.minutes * 60, seconds / 2));
}

/** The cost to go from `level` to `level + 1` in the study: the rules', or the cost option's. */
export function upgradeCost(id: BuildingId, level: number): Cost {
  return study.costs?.(id, level) ?? rules.upgradeCost(id, level);
}

export function applyAction(state: PlayerState, action: GameAction): ActionResult {
  let r: ActionResult;
  if (action.type === "upgrade" && study.costs) {
    // The rules check and pay their own cost: given it on top, then the study's cost is what the city pays.
    const cost = upgradeCost(action.building, state.buildings[action.building]);
    if (!rules.canPay(state.stock, cost)) return { ok: false, reason: "Not enough resources" };
    const theirs = rules.upgradeCost(action.building, state.buildings[action.building]);
    const lent = { ...state.stock };
    for (const [k, v] of Object.entries(theirs) as [keyof Cost, number][]) lent[k] += v;
    r = rules.applyAction({ ...state, stock: lent }, action);
    if (r.ok) r = { ...r, state: { ...r.state, stock: rules.payCost(state.stock, cost) } };
  } else r = rules.applyAction(state, action);
  if (r.ok && action.type === "upgrade") {
    const job = r.state.queue.at(-1)!;
    const level = state.buildings[action.building] + 1;
    const seconds = studyTime(action.building, level, job.duration);
    if (seconds !== job.duration) r = { ...r, state: { ...r.state, queue: [...r.state.queue.slice(0, -1), { ...job, left: seconds, duration: seconds }] } };
  }
  return r;
}

/**
 * Could the balance's player start an upgrade now, builders aside: the Lighthouse's next level paid in full, or another
 * building under its cap whose cost leaves the Lighthouse's reserve on what it spends (as `simulate.ts` plays it).
 */
function affordable(s: PlayerState, keepReserve = true): boolean {
  const lighthouseFree = !s.queue.some((j) => j.id === "lighthouse") && s.buildings.lighthouse < rules.LIGHTHOUSE_MAX;
  const reserve: Cost = {};
  if (lighthouseFree && keepReserve) {
    const storage = rules.storeCap(s.buildings.lighthouse, s.techs);
    for (const [k, v] of Object.entries(upgradeCost("lighthouse", s.buildings.lighthouse)) as [keyof Cost, number][]) reserve[k] = Math.min(v, storage);
  }
  return rules.BUILDING_IDS.some((id) => {
    if (s.queue.some((j) => j.id === id) || s.buildings[id] >= rules.maxLevel(id, s.buildings)) return false;
    const cost = upgradeCost(id, s.buildings[id]);
    if (!rules.canPay(s.stock, cost) || s.pearls < rules.upgradePearls(id, s.buildings[id])) return false;
    return id === "lighthouse" || (Object.entries(cost) as [keyof Cost, number][]).every(([k, v]) => s.stock[k] - v >= (reserve[k] ?? 0));
  });
}

/** The upgrades under way the simulator kept (it tries some actions and drops them), each written down once. */
function observe(state: PlayerState): void {
  for (const job of state.queue) {
    const level = state.buildings[job.id] + 1;
    const key = `${job.id} ${level}`;
    if (study.seen.has(key)) continue;
    study.seen.add(key);
    study.started.push({ clock: state.clock - (job.duration - job.left), id: job.id, level, seconds: job.duration });
  }
}

export function advance(state: PlayerState, seconds: number): PlayerState {
  observe(state);
  const hours = seconds / rules.HOUR;
  const b = (study.builders[state.buildings.lighthouse] ??= { hours: 0, away: 0, nothing: 0, waitBuild: 0 });
  b.hours += hours;
  const free = Math.max(0, rules.builders(state.survivors) - state.queue.length);
  const can = affordable(state);
  if (free > 0) b[can ? "away" : "nothing"] += free * hours;
  else if (can) b.waitBuild += hours;
  // Nothing to start, but something the city could pay for if it did not keep the Lighthouse's reserve.
  if (free > 0 && !can && affordable(state, false)) b.held = (b.held ?? 0) + free * hours;
  let s = rules.advance(state, seconds);
  const times = study.production?.(state) ?? 1;
  if (times !== 1) {
    // What the city's buildings made in this step (before what the Lighthouse burns and the survivors eat), made
    // `times` times, within the storage. Out of the Mist: a little more than the rules in the Mist.
    const cap = rules.storeCap(s.buildings.lighthouse, s.techs);
    const made = rules.netRates({ ...state, buildings: { ...state.buildings, lighthouse: 0 }, survivors: 0 }, { mist: false, stoked: false });
    const stock = { ...s.stock };
    for (const k of ["oil", "fish", "wood"] as const) {
      const extra = (Math.max(0, made[k]) * (times - 1) * seconds) / rules.HOUR;
      if (stock[k] < cap) stock[k] = Math.min(cap, stock[k] + extra);
    }
    s = { ...s, stock };
  }
  return s;
}
