/**
 * The rules of `shared/` as the sea-hunt study plays them (docs/studies/sea-hunt.md). The balance's simulator
 * (`simulate.ts`) imports this module in place of `@brinelight/shared` when, and only when, `sea-hunt-run.ts` runs it
 * (through `sea-hunt-hooks.mjs`). Without a proposal, every rule is the shared one and a run is the balance's own; with
 * one, a fleet can sail on a long expedition (`expedition`), a construction can be sped up with resources (`speedup`),
 * and Amber is needed for, or can pay part of, the high levels (`sea-hunt.ts`). Nothing is changed in `shared/`.
 */
import * as rules from "@brinelight/shared";
import type { ActionResult, BuildingId, GameAction, PlayerState, Resource, Troops } from "@brinelight/shared";
import { amberForHouse, amberForUpgrade, escortOf, expeditionCargo, speedupCost, type Proposal, type Zone } from "./sea-hunt.js";

export * from "@brinelight/shared";

/** A fleet away on an expedition: when it comes home, and what it brings. */
type Away = { zone: Zone; back: number; troops: Troops; lost: number; resource: "oil" | "fish" | "wood"; cargo: number; amber: number };

export type Study = {
  proposal: Proposal | null;
  away: Away[];
  amber: number;
  /** What the run's expeditions did, by zone: sent, base resources and Amber brought, soldiers lost. */
  zones: Record<string, { sent: number; brought: number; amber: number; lost: number }>;
  amberSpent: number;
  /** The session clocks at which an upgrade was refused for want of Amber. */
  amberShort: Set<number>;
  /** Speed-ups: the day (since 1970) and the seconds taken off that day; all seconds and resources spent. */
  speed: { day: number; used: number; seconds: number; spent: number };
  /** What the fleets took from the map's sites, by kind (wreck oil, isle wood, shoal fish), and what another city took. */
  taken: { wreck: number; isle: number; fish: number; lost: number };
};

const fresh = (proposal: Proposal | null): Study => ({ proposal, away: [], amber: 0, zones: {}, amberSpent: 0, amberShort: new Set(), speed: { day: -1, used: 0, seconds: 0, spent: 0 }, taken: { wreck: 0, isle: 0, fish: 0, lost: 0 } });

const GATHERED = rules.SEA_SITES.filter(rules.gathers);

/** Shared through the global object: the hooks' patch and `sea-hunt-run.ts` may see this module under two names. */
const g = globalThis as { brinelightSeaHunt?: Study };
export const study: Study = (g.brinelightSeaHunt ??= fresh(null));

/** A new run, with this proposal (or the rules). */
export function begin(proposal: Proposal | null): void {
  Object.assign(study, fresh(proposal));
  pending = null;
}

/** The fleets the simulator may send: the Harbor's, less those away on an expedition. */
export const fleetsMax = (harbor: number): number => rules.fleetsMax(harbor) - study.away.length;

const refuse = (reason: string): ActionResult => ({ ok: false, reason });

/**
 * What an accepted action does to the study's own measures (Amber, fleets away, the day's speed-up), kept until the
 * city it returned is the one played next: the simulator may still turn an action down (to keep the Lighthouse's
 * reserve), and then nothing of it happened.
 */
let pending: { state: PlayerState; commit: () => void } | null = null;
const settle = (s: PlayerState) => {
  if (pending?.state === s) pending.commit();
  pending = null;
};
const later = (r: ActionResult, commit: () => void): ActionResult => {
  if (r.ok) pending = { state: r.state, commit };
  return r;
};

/** Takes `n` soldiers out of the city, the first troop types first. */
function takeTroops(troops: Troops, n: number): { left: Troops; taken: Troops } {
  const left = { ...troops };
  const taken = Object.fromEntries(Object.keys(troops).map((k) => [k, 0])) as Troops;
  let need = n;
  for (const k of Object.keys(troops) as (keyof Troops)[]) {
    const t = Math.min(left[k], need);
    left[k] -= t;
    taken[k] = t;
    need -= t;
  }
  return { left, taken };
}

function expedition(s: PlayerState, zoneId: string, resource: "oil" | "fish" | "wood"): ActionResult {
  const hunt = study.proposal?.hunt;
  const zone = hunt?.zones.find((z) => z.id === zoneId);
  if (!hunt || !zone) return refuse("No expedition");
  if (s.buildings.lighthouse < hunt.from) return refuse("Upgrade the Lighthouse first");
  const all = rules.fleetsMax(s.buildings.harbor);
  if (all - s.fleets.length - study.away.length < 1) return refuse("All your fleets are at sea");
  if (study.away.length + 1 > (hunt.one ? 1 : Math.floor(all * hunt.share))) return refuse("Enough fleets are away");
  const escort = escortOf(zone, s.buildings.lighthouse);
  if (rules.totalTroops(s.troops) < escort) return refuse("You do not have enough troops");
  const { left, taken } = takeTroops(s.troops, escort);
  const lost = Math.floor(escort * zone.loss);
  const away: Away = { zone, back: s.clock + zone.hours * rules.HOUR, troops: taken, lost, resource, cargo: expeditionCargo(zone, s.buildings.lighthouse), amber: zone.amber };
  return later({ ok: true, state: { ...s, troops: left } }, () => study.away.push(away));
}

const dayOf = (clock: number) => Math.floor(clock / rules.DAY);

function speedup(s: PlayerState, id: BuildingId, seconds: number): ActionResult {
  const sp = study.proposal?.speedup;
  const job = s.queue.find((j) => j.id === id);
  if (!sp || !job) return refuse("No speed-up");
  const used = study.speed.day === dayOf(s.clock) ? study.speed.used : 0;
  const take = Math.min(seconds, job.left - 1, sp.dayHours * rules.HOUR - used);
  if (take <= 0) return refuse("You reached today's cap");
  const cost = speedupCost(rules.upgradeCost(id, s.buildings[id]), job.duration, take, sp.price);
  if (!rules.canPay(s.stock, cost)) return refuse("Not enough resources");
  if (sp.policy === "surplus") {
    const cap = rules.storeCap(s.buildings.lighthouse, s.techs);
    if (Object.entries(cost).some(([k, v]) => s.stock[k as Resource] - (v ?? 0) < 0.8 * cap)) return refuse("Not from a full storage");
  }
  const spent = Object.values(cost).reduce((n, v) => n + (v ?? 0), 0);
  return later({ ok: true, state: { ...s, stock: rules.payCost(s.stock, cost), queue: s.queue.map((j) => (j === job ? { ...j, left: j.left - take } : j)) } }, () =>
    Object.assign(study.speed, { day: dayOf(s.clock), used: used + take, seconds: study.speed.seconds + take, spent: study.speed.spent + spent }),
  );
}

/** An island upgrade with Amber: needed (the gate), or paying part of a cost the city is short of (the swap). */
function upgrade(s: PlayerState, action: GameAction & { type: "upgrade" }): ActionResult {
  const use = study.proposal?.hunt?.amber;
  const level = s.buildings[action.building];
  if (use?.kind === "gate") {
    const need = amberForUpgrade(use, action.building, level);
    if (need > study.amber) {
      const r = rules.applyAction(s, action);
      // Refused for want of Amber only when nothing else refuses it first.
      if (r.ok) study.amberShort.add(s.clock);
      return r.ok ? refuse("Not enough Amber") : r;
    }
    return later(rules.applyAction(s, action), () => ((study.amber -= need), (study.amberSpent += need)));
  }
  const r = rules.applyAction(s, action);
  if (r.ok || use?.kind !== "swap" || level + 1 < 16 || r.reason !== "Not enough resources") return r;
  const cost = rules.upgradeCost(action.building, level);
  const short = Math.max(...Object.entries(cost).map(([k, v]) => (v ? Math.max(0, v - s.stock[k as Resource]) / v : 0)));
  const n = Math.ceil(short * 100 - 1e-9);
  if (n > use.max || n > study.amber) return r;
  // The Amber pays n % of every resource of the cost: lent to the stock, then the rules pay the whole cost.
  const lent = Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, Math.ceil(((v ?? 0) * n) / 100)]));
  const stock = { ...s.stock };
  for (const [k, v] of Object.entries(lent)) stock[k as Resource] += v;
  return later(rules.applyAction({ ...s, stock }, action), () => ((study.amber -= n), (study.amberSpent += n)));
}

function upgradeRaft(s: PlayerState, action: GameAction & { type: "upgradeRaft" }): ActionResult {
  const use = study.proposal?.hunt?.amber;
  const raft = s.rafts[action.slot];
  const need = use && raft?.building === "house" ? amberForHouse(use, raft.level) : 0;
  if (need > study.amber) {
    const r = rules.applyAction(s, action);
    if (r.ok) study.amberShort.add(s.clock);
    return r.ok ? refuse("Not enough Amber") : r;
  }
  return later(rules.applyAction(s, action), () => ((study.amber -= need), (study.amberSpent += need)));
}

export function applyAction(state: PlayerState, action: GameAction): ActionResult {
  settle(state);
  const a = action as GameAction | { type: "expedition"; zone: string; resource: "oil" | "fish" | "wood" } | { type: "speedup"; building: BuildingId; seconds: number };
  if (a.type === "expedition") return expedition(state, a.zone, a.resource);
  if (a.type === "speedup") return speedup(state, a.building, a.seconds);
  if (a.type === "upgrade") return upgrade(state, a);
  if (a.type === "upgradeRaft") return upgradeRaft(state, a);
  return rules.applyAction(state, action);
}

/** The rules' time, then the expeditions that come home within it: their cargo (no storage cap), Amber and escort. */
export function advance(state: PlayerState, seconds: number): PlayerState {
  settle(state);
  let s = rules.advance(state, seconds);
  // What the fleets took from each site in that time; a contested isle or shoal gives a share of it to another city.
  for (const site of GATHERED) {
    const took = rules.siteLeft(state.world, site, state.buildings.lighthouse) - rules.siteLeft(s.world, site, state.buildings.lighthouse);
    if (took <= 0) continue;
    const kind = site.kind as "wreck" | "isle" | "fish";
    study.taken[kind] += took;
    const share = kind === "wreck" ? 0 : (study.proposal?.contest ?? 0);
    if (share) {
      const res = kind === "isle" ? "wood" : "fish";
      const lost = Math.min(s.stock[res], Math.round(took * share));
      study.taken.lost += lost;
      s = { ...s, stock: { ...s.stock, [res]: s.stock[res] - lost } };
    }
  }
  const home = study.away.filter((a) => a.back <= s.clock);
  if (!home.length) return s;
  study.away = study.away.filter((a) => a.back > s.clock);
  const stock = { ...s.stock };
  const troops = { ...s.troops };
  for (const a of home) {
    stock[a.resource] += a.cargo;
    study.amber += a.amber;
    const z = (study.zones[a.zone.id] ??= { sent: 0, brought: 0, amber: 0, lost: 0 });
    z.sent++;
    z.brought += a.cargo;
    z.amber += a.amber;
    z.lost += a.lost;
    // The soldiers lost come off the first troop types the escort took.
    const { left } = takeTroops(a.troops, a.lost);
    for (const k of Object.keys(left) as (keyof Troops)[]) troops[k] += left[k];
  }
  return { ...s, stock, troops };
}
