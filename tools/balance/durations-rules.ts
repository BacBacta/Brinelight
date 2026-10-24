/**
 * The rules of `shared/` as the durations study plays them (docs/studies/durations.md). The balance's simulator
 * (`simulate.ts`) imports this module in place of `@brinelight/shared` when, and only when, `durations-run.ts` runs it
 * (through `durations-hooks.mjs`): every rule is the shared one, word for word, except an upgrade's duration when a
 * study curve is set, the alliance's help when it is, and the other buildings' costs past level 15 when a cost option
 * is. Nothing is changed in `shared/`. Without any of them, a run is the balance's own (checked by `durations-run.ts`
 * before anything else).
 *
 * It also writes down every upgrade started, and, hour by hour, what the builders did.
 */
import * as rules from "@brinelight/shared";
import type { ActionResult, BuildingId, Cost, GameAction, PlayerState } from "@brinelight/shared";
import { curveTime, type Curve } from "./durations.js";

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
export type Builders = { hours: number; away: number; nothing: number; waitBuild: number };

/**
 * A cost option (studied, never in the game): every building but the Lighthouse, past level `from`, costs `growth`
 * times its level before (the rules: 1.6 a level, all the way to 30). The Lighthouse keeps its costs.
 */
export type Costs = { from: number; growth: number };

export type Study = { curve: Curve | null; help: Help | null; costs: Costs | null; started: Started[]; seen: Set<string>; builders: Record<number, Builders> };

/** Shared with `durations-run.ts` through the global object: the two may load this module under two names. */
const g = globalThis as { brinelightDurationsStudy?: Study };
export const study: Study = (g.brinelightDurationsStudy ??= { curve: null, help: null, costs: null, started: [], seen: new Set(), builders: {} });

/** The time an upgrade to `level` takes in the study: the curve's (or the rules'), less the alliance's help. */
export function studyTime(id: BuildingId, level: number, rulesSeconds: number): number {
  const seconds = study.curve ? curveTime(study.curve, id, level) : rulesSeconds;
  if (!study.help || level < 6) return seconds;
  return Math.round(seconds - Math.min(study.help.count * study.help.minutes * 60, seconds / 2));
}

/** The cost to go from `level` to `level + 1` in the study: the rules', or the cost option's. */
export function upgradeCost(id: BuildingId, level: number): Cost {
  const c = study.costs;
  if (!c || id === "lighthouse" || level <= c.from) return rules.upgradeCost(id, level);
  const at = rules.upgradeCost(id, c.from);
  return rules.roundCost(Object.fromEntries(Object.entries(at).map(([k, v]) => [k, v * c.growth ** (level - c.from)])) as Cost);
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
function affordable(s: PlayerState): boolean {
  const lighthouseFree = !s.queue.some((j) => j.id === "lighthouse") && s.buildings.lighthouse < rules.LIGHTHOUSE_MAX;
  const reserve: Cost = {};
  if (lighthouseFree) {
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
  const free = Math.max(0, rules.BUILDERS - state.queue.length);
  const can = affordable(state);
  if (free > 0) b[can ? "away" : "nothing"] += free * hours;
  else if (can) b.waitBuild += hours;
  return rules.advance(state, seconds);
}
