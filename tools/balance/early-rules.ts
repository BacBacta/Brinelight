/**
 * The rules of `shared/` as the early-game study plays them (docs/studies/early-game.md). The balance's simulator
 * (`simulate.ts`) imports this module in place of `@brinelight/shared` when, and only when, `early.ts` runs it (through
 * `early-hooks.mjs`): every rule is the shared one, word for word, except what a study variant changes, and nothing is
 * changed in `shared/`. Without a variant, a run is the balance's own (checked by `early.ts` before anything else).
 *
 * It also writes down every try to start the Lighthouse, to say what held each level back: the player away, or the
 * resources.
 */
import * as rules from "@brinelight/shared";
import type { ActionResult, BuildingId, GameAction, PlayerState, Resource, ServerId } from "@brinelight/shared";

export * from "@brinelight/shared";

/** A study variant: what it changes in the rules, for the study's runs only. */
export type Variant = {
  id: string;
  name: string;
  /** The duration, in real seconds, of an upgrade of `id` to `level` (the level it reaches), from the rules' duration. */
  duration?: (id: BuildingId, level: number, seconds: number) => number;
  /** How many builders the city has, from its state (the rules: 2). */
  builders?: (s: PlayerState) => number;
  /** How many times the rules' production of oil, fish and wood the city makes, from its state (the rules: 1). */
  production?: (s: PlayerState) => number;
  /** The stock a new city starts with, in place of the rules' (only the resources given). */
  start?: Partial<Record<Resource, number>>;
};

/** A try to start the Lighthouse's next level, at a session. */
export type LighthouseTry = { clock: number; level: number; ok: boolean; reason: string | null; stock: Record<Resource, number> };

/** A level finished: when, which building, the level it reached. */
export type Finished = { clock: number; id: BuildingId; level: number };

/**
 * A work that A does not cap (research, training, healing, the shipyard, a fleet at sea), from when it began to the
 * step it ended in (null while it runs); a fleet also arrives at its site, half-way.
 */
export type OtherJob = { kind: "research" | "training" | "healing" | "shipyard" | "sea"; what: string; start: number; end: number | null; arrive?: number };

/** An objective claimed: when, and its index in OBJECTIVES. */
export type Claim = { clock: number; objective: number };

/** An upgrade started: when, which building, the level it goes to, and its time. */
export type Started = { clock: number; id: BuildingId; level: number; seconds: number };

export type Study = { variant: Variant | null; tries: LighthouseTry[]; finished: Finished[]; jobs: OtherJob[]; claims: Claim[]; started: Started[]; seen: Set<string> };

/** Shared with `early.ts` through the global object: the two may load this module under two names. */
const g = globalThis as { brinelightEarlyStudy?: Study };
export const study: Study = (g.brinelightEarlyStudy ??= { variant: null, tries: [], finished: [], jobs: [], claims: [], started: [], seen: new Set() });

/**
 * The works under way in a city the simulator kept (it tries some actions and drops them): an upgrade or an uncapped
 * work not seen before began `duration - left` seconds before this clock.
 */
function observe(state: PlayerState): void {
  const begun = (job: { left: number; duration: number }) => state.clock - (job.duration - job.left);
  const open = (kind: OtherJob["kind"], what?: string) => study.jobs.some((j) => j.kind === kind && j.end === null && (what === undefined || j.what === what));
  if (state.research && !open("research")) study.jobs.push({ kind: "research", what: `research ${state.research.id}`, start: begun(state.research), end: null });
  if (state.training && !open("training")) study.jobs.push({ kind: "training", what: `${state.training.kind} ${state.training.count} ${state.training.troop}`, start: begun(state.training), end: null });
  if (state.healing && !open("healing")) study.jobs.push({ kind: "healing", what: "heal the wounded", start: begun(state.healing), end: null });
  if (state.yard && !open("shipyard")) study.jobs.push({ kind: "shipyard", what: `shipyard: ${state.yard.kind}`, start: begun(state.yard), end: null });
  for (const f of state.fleets) {
    const what = `fleet to ${f.site}`;
    if (!open("sea", what)) {
      // The way out: shorter than the trip to a camp in the early start (`out`).
      const out = f.out ?? f.travel;
      const start = state.clock - (f.phase === "out" ? out - f.left : out);
      study.jobs.push({ kind: "sea", what, start, end: null, arrive: start + out });
    }
  }
  for (const job of state.queue) {
    const level = state.buildings[job.id] + 1;
    const key = `${job.id} ${level}`;
    if (!study.seen.has(key)) {
      study.seen.add(key);
      study.started.push({ clock: begun(job), id: job.id, level, seconds: job.duration });
    }
  }
}

/** The works of `study.jobs` that ended in a step from `before` to `after`. */
function endJobs(before: PlayerState, after: PlayerState, seconds: number): void {
  const at = (left: number | undefined) => before.clock + Math.min(seconds, Math.max(0, left ?? seconds));
  const ended = (kind: OtherJob["kind"], when: number, what?: (j: OtherJob) => boolean) => {
    const job = study.jobs.find((j) => j.kind === kind && j.end === null && (!what || what(j)));
    if (job) job.end = when;
  };
  if (before.research && !after.research) ended("research", at(before.research.left));
  if (before.training && !after.training) ended("training", at(before.training.left));
  if (before.healing && !after.healing) ended("healing", at(before.healing.left));
  if (before.yard && !after.yard) ended("shipyard", at(before.yard.left));
  const home = new Set(after.fleets.map((f) => f.site));
  for (const f of before.fleets) if (!home.has(f.site)) ended("sea", before.clock + seconds, (j) => j.what === `fleet to ${f.site}`);
}

/** The builders, as the simulator reads them: a live binding, set from the city at each step. */
export let BUILDERS = rules.BUILDERS;
const setBuilders = (s: PlayerState) => {
  BUILDERS = study.variant?.builders?.(s) ?? rules.builders(s.survivors);
};
/** The builders, as the simulator reads them (`builders`): the live count above, whatever the survivors given. */
export const builders = (_survivors: number): number => BUILDERS;

export function newPlayerState(clock?: number, server?: ServerId): PlayerState {
  const made = rules.newPlayerState(clock, server);
  const s = { ...made, stock: { ...made.stock, ...study.variant?.start } };
  setBuilders(s);
  return s;
}

/** An upgrade with every builder busy, started anyway when the variant gives one more: the rules see one job less. */
function withMoreBuilders(state: PlayerState, action: GameAction & { type: "upgrade" }): ActionResult {
  const more = study.variant?.builders?.(state) ?? rules.builders(state.survivors);
  if (state.queue.length >= more || state.queue.length < rules.builders(state.survivors)) return rules.applyAction(state, action);
  const hidden = state.queue.findIndex((j) => j.id !== action.building);
  const job = state.queue[hidden]!;
  const r = rules.applyAction({ ...state, queue: state.queue.filter((_, i) => i !== hidden) }, action);
  if (!r.ok) return r;
  return { ...r, state: { ...r.state, queue: [job, ...r.state.queue] } };
}

export function applyAction(state: PlayerState, action: GameAction): ActionResult {
  const v = study.variant;
  let r = action.type === "upgrade" && v?.builders ? withMoreBuilders(state, action) : rules.applyAction(state, action);
  if (r.ok && action.type === "upgrade" && v?.duration) {
    const job = r.state.queue.at(-1)!;
    const seconds = Math.max(1, Math.round(v.duration(action.building, state.buildings[action.building] + 1, job.duration)));
    r = { ...r, state: { ...r.state, queue: [...r.state.queue.slice(0, -1), { ...job, left: seconds, duration: seconds }] } };
  }
  // A claim is never dropped by the simulator: written down here, at its session.
  if (r.ok && action.type === "claimObjective") study.claims.push({ clock: state.clock, objective: state.objective });
  if (action.type === "upgrade" && action.building === "lighthouse") {
    study.tries.push({ clock: state.clock, level: state.buildings.lighthouse + 1, ok: r.ok, reason: r.ok ? null : r.reason, stock: { ...state.stock } });
  }
  if (r.ok) setBuilders(r.state);
  return r;
}

export function advance(state: PlayerState, seconds: number): PlayerState {
  observe(state);
  let s = rules.advance(state, seconds);
  endJobs(state, s, seconds);
  for (const id of rules.BUILDING_IDS) {
    // A level finished in this step at the end of its job: the time it had left when the step began.
    if (s.buildings[id] > state.buildings[id]) {
      const job = state.queue.find((j) => j.id === id);
      study.finished.push({ clock: state.clock + Math.min(seconds, job?.left ?? seconds), id, level: s.buildings[id] });
    }
  }
  const times = study.variant?.production?.(state) ?? 1;
  if (times !== 1) {
    // What the city's buildings made in this step (before what the Lighthouse burns and the survivors eat; not the
    // loot), made `times` times, in the storage. Out of the Mist: a little more than the rules in the Mist.
    const cap = rules.storeCap(s.buildings.lighthouse, s.techs);
    const made = rules.netRates({ ...state, buildings: { ...state.buildings, lighthouse: 0 }, survivors: 0 }, { mist: false, stoked: false });
    const stock = { ...s.stock };
    for (const k of ["oil", "fish", "wood"] as const) {
      const extra = (Math.max(0, made[k]) * (times - 1) * seconds) / rules.HOUR;
      if (stock[k] < cap) stock[k] = Math.min(cap, stock[k] + extra);
    }
    s = { ...s, stock };
  }
  setBuilders(s);
  return s;
}
