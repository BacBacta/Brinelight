/**
 * The balance simulation (week 6, task 5): a new city played for days with the rules of shared/ alone (advance and
 * applyAction), by three players who only differ in how often they open the game. No server, no browser, no clock and
 * no randomness: the same run gives the same numbers. It changes no value: it shows what the rules give.
 *
 * What it leaves out: the Mist (always calm, the Lighthouse never stoked), the Leviathan, objectives and daily tasks,
 * other players, the daily recruitment.
 */
import {
  BUILDERS,
  BUILDING_IDS,
  CAPTAINS,
  CAPTAIN_MAX_LEVEL,
  DAY,
  HOUR,
  LIGHTHOUSE_MAX,
  LOGBOOK,
  MIN_ATTACK_TROOPS,
  RAFT_BUILDING_MAX_COPIES,
  RAFT_BUILDING_MAX_LEVEL,
  RAFT_SLOTS,
  SEA_SITES,
  TECHS,
  advance,
  applyAction,
  distance,
  newPlayerState,
  odds,
  pirateCamp,
  power,
  raftEffect,
  slotOpen,
  storeCap,
  techLevel,
  totalTroops,
  upgradeCost,
  type BuildingId,
  type CaptainId,
  type Cost,
  type GameAction,
  type PlayerState,
  type RaftBuildingId,
  type Rarity,
  type Resource,
  type TechId,
  type TroopType,
} from "@brinelight/shared";

export type ProfileId = "casual" | "regular" | "dedicated";
export type Profile = { id: ProfileId; name: string; /** When the player opens the game, in seconds after midnight. */ sessions: readonly number[] };

const at = (hours: number, minutes = 0) => hours * HOUR + minutes * 60;

/** The three players: the same choices, only the number of sessions a day differs. */
export const PROFILES: readonly Profile[] = [
  { id: "casual", name: "Casual (3 sessions)", sessions: [at(8), at(13), at(21)] },
  { id: "regular", name: "Regular (6 sessions)", sessions: [at(7), at(10), at(13), at(16), at(19), at(22)] },
  { id: "dedicated", name: "Dedicated (10 sessions)", sessions: Array.from({ length: 10 }, (_, i) => at(7) + i * at(1, 40)) },
];

/** The city is founded on day 1 at 8:00, in a first session; the profile's sessions follow. */
export const FOUNDED = at(8);

/** The order of play (docs/balance.md, "How the players play"). */
export const BUILD_ORDER: readonly BuildingId[] = ["refinery", "lumberyard", "fishery", "shelters", "barracks", "observatory", "harbor", "infirmary"];
export const RESEARCH_ORDER: readonly TechId[] = ["refining", "saws", "nets", "warehouses", "sails", "holds", "blades", "hulls", "stretchers", "veterans"];
export const TROOP_ORDER: readonly TroopType[] = ["boarders", "harpooners", "crossbowmen"];
export const RAFT_BUILDING_ORDER: readonly RaftBuildingId[] = ["greenhouse", "smokehouse", "watchtower"];
/** Pearls kept: a Logbook only when this many are left after it. */
export const PEARLS_KEPT = 100;

const RARITY_RANK: Record<Rarity, number> = { officer: 1, commander: 2, admiral: 3 };
const CAPTAIN_IDS = Object.keys(CAPTAINS) as CaptainId[];
const RESOURCES: readonly Resource[] = ["oil", "fish", "wood", "rope"];
/** The wrecks, nearest first: the only sites that give resources besides the camps. */
const WRECKS = SEA_SITES.filter((s) => s.kind === "wreck").sort((a, b) => distance(a) - distance(b));
const CAMPS = SEA_SITES.filter((s) => s.kind === "camp");

/** Why a builder stayed free at the end of a session. */
export type Block = { reason: "resources"; resource: Resource } | { reason: "capped" };

export type DayRow = {
  profile: ProfileId;
  day: number;
  lighthouse: number;
  power: number;
  stock: Record<Resource, number>;
  pearls: number;
  storage: number;
  troops: number;
  veterans: number;
  wounded: number;
  captains: number;
  lead: CaptainId | null;
  leadLevel: number;
  stars: number;
  buildings: Record<BuildingId, number>;
  techs: number;
  rafts: number;
  campsBeaten: number;
  /** Builder hours left free that day (2 builders: up to 48). */
  idleBuilderHours: number;
  sessions: number;
  /** Fleets sent to salvage a wreck. */
  salvages: number;
  /** Sessions that ended with a builder free and nothing it could start. */
  blockedSessions: number;
  blockedBy: string;
  /** Sessions where nothing at all could be started. */
  emptySessions: number;
  started: string[];
};

/** A wall of the storage: the Lighthouse's next level costs more of a resource than the storage can hold. */
export type Wall = { level: number; resource: Resource; cost: number; storage: number; hours: number; escaped: boolean };

export type Run = {
  profile: Profile;
  days: DayRow[];
  /** When each Lighthouse level was reached, in hours after the city was founded. */
  lighthouse: Record<number, number>;
  /** Other first times, in hours after the city was founded. */
  firsts: { refinery2: number | null; barracks1: number | null; campBeaten: number | null };
  /** Per resource, how many sessions it blocked a builder; and the blocks by the Lighthouse's cap. */
  blocks: Record<Resource | "capped", number>;
  /** Hours each resource spent full (production lost). */
  fullHours: Record<Resource, number>;
  walls: Wall[];
  /** The last city, to check it. */
  last: PlayerState;
};

/** An action without its id, for each type of action. */
type Intent = GameAction extends infer A ? (A extends GameAction ? Omit<A, "id"> : never) : never;

/** A plain action id, numbered: the rules need one, the simulation has no randomness to make it. */
const actionId = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const short = (c: Cost) => Object.entries(c).map(([k, v]) => `${v} ${k}`).join(" + ");

/** The resource a cost lacks the most, in share of the cost. */
export function missing(stock: Record<Resource, number>, cost: Cost): Resource | null {
  let worst: Resource | null = null;
  let gap = 0;
  for (const k of RESOURCES) {
    const need = cost[k] ?? 0;
    if (need <= 0 || stock[k] >= need) continue;
    const g = (need - stock[k]) / need;
    if (g > gap) {
      gap = g;
      worst = k;
    }
  }
  return worst;
}

/**
 * What every spending but the Lighthouse's leaves untouched: while the Lighthouse waits, the cost of its next level,
 * up to what the storage holds (no one can save more); while it is being built, or at its last level, nothing.
 */
export function reserve(s: PlayerState): Cost {
  if (s.queue.some((j) => j.id === "lighthouse") || s.buildings.lighthouse >= LIGHTHOUSE_MAX) return {};
  const storage = storeCap(s.buildings.lighthouse, s.techs);
  const cost = upgradeCost("lighthouse", s.buildings.lighthouse);
  return Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, k === "rope" ? v : Math.min(v, storage)]));
}
const covers = (stock: Record<Resource, number>, cost: Cost) => RESOURCES.every((k) => stock[k] >= (cost[k] ?? 0));

/** The wall at this Lighthouse level, if its next level costs more than the storage holds. */
export function wallAt(s: PlayerState): { resource: Resource; cost: number; storage: number } | null {
  if (s.buildings.lighthouse >= LIGHTHOUSE_MAX) return null;
  const cost = upgradeCost("lighthouse", s.buildings.lighthouse);
  const storage = storeCap(s.buildings.lighthouse, s.techs);
  for (const k of RESOURCES) if ((cost[k] ?? 0) > storage) return { resource: k, cost: cost[k]!, storage };
  return null;
}

/** Plays a new city for `days` days with a profile's sessions. */
export function simulate(profile: Profile, days: number): Run {
  let s = newPlayerState();
  let t = FOUNDED; // seconds since day 1, 0:00
  let ids = 0;
  let turn = 0;
  const lighthouse: Record<number, number> = { [s.buildings.lighthouse]: 0 };
  const firsts: Run["firsts"] = { refinery2: null, barracks1: null, campBeaten: null };
  const blocks: Run["blocks"] = { oil: 0, fish: 0, wood: 0, rope: 0, capped: 0 };
  const fullHours: Run["fullHours"] = { oil: 0, fish: 0, wood: 0, rope: 0 };
  const walls: Wall[] = [];
  const rows: DayRow[] = [];
  const since = (time: number) => (time - FOUNDED) / HOUR;
  let today = newDay();

  function newDay() {
    return { idle: 0, sessions: 0, salvages: 0, blocked: 0, empty: 0, by: new Map<string, number>(), started: [] as string[] };
  }

  /** Applies an action; `keep`: only if what is left still covers the Lighthouse's next level. */
  const act = (action: Intent, label: string, keep = false): boolean => {
    const r = applyAction(s, { ...action, id: actionId(ids + 1) } as GameAction);
    if (!r.ok || (keep && !covers(r.state.stock, reserve(s)))) return false;
    ids++;
    s = r.state;
    // Salvages repeat at every session: counted, not listed.
    if (action.type === "sail" && label.startsWith("salvage")) today.salvages++;
    else today.started.push(label);
    return true;
  };

  const builders = (): Block | null => {
    for (;;) {
      if (s.queue.length >= BUILDERS) return null;
      const queued = s.queue.map((j) => j.id);
      const candidates: BuildingId[] = queued.includes("lighthouse") || s.buildings.lighthouse >= LIGHTHOUSE_MAX ? [] : ["lighthouse"];
      const others = BUILD_ORDER.filter((id) => !queued.includes(id) && s.buildings[id] < s.buildings.lighthouse);
      candidates.push(...[...others].sort((a, b) => s.buildings[a] - s.buildings[b]));
      const id = candidates.find((b) => {
        const level = s.buildings[b];
        const cost = upgradeCost(b, level);
        if (!act({ type: "upgrade", building: b }, `${b} ${level + 1} (${short(cost)})`, b !== "lighthouse")) return false;
        const done = t + (s.queue.at(-1)?.left ?? 0);
        if (b === "lighthouse") lighthouse[level + 1] = since(done);
        if (b === "refinery" && level + 1 === 2) firsts.refinery2 ??= since(done);
        if (b === "barracks" && level + 1 === 1) firsts.barracks1 ??= since(done);
        return true;
      });
      if (id) continue;
      const first = candidates[0];
      if (!first) return { reason: "capped" };
      const lack = missing(s.stock, upgradeCost(first, s.buildings[first]));
      return lack ? { reason: "resources", resource: lack } : { reason: "capped" };
    }
  };

  const observatory = () => {
    if (s.research || s.buildings.observatory < 1) return false;
    return RESEARCH_ORDER.some((tech) => techLevel(s.techs, tech) < TECHS[tech].max && act({ type: "research", tech }, `research ${tech} ${techLevel(s.techs, tech) + 1}`, true));
  };

  const barracks = () => {
    if (s.training || s.buildings.barracks < 1) return false;
    for (let i = 0; i < TROOP_ORDER.length; i++) {
      const troop = TROOP_ORDER[(turn + i) % TROOP_ORDER.length]!;
      if (act({ type: "promote", troop }, `promote ${troop}`, true) || act({ type: "train", troop }, `train ${troop}`, true)) {
        turn = (turn + i + 1) % TROOP_ORDER.length;
        return true;
      }
    }
    return false;
  };

  const infirmary = () => !s.healing && totalTroops(s.wounded) > 0 && act({ type: "heal" }, "heal");

  const sea = () => {
    let any = false;
    const lead = s.lead ? s.captains[s.lead] : undefined;
    const army = totalTroops(s.troops) + totalTroops(s.veterans);
    if (army >= MIN_ATTACK_TROOPS) {
      // The lowest camp, if the odds are "easy"; all the troops sail.
      const camp = [...CAMPS].sort((a, b) => (s.world.camps[a.id] ?? 1) - (s.world.camps[b.id] ?? 1))[0]!;
      const level = s.world.camps[camp.id] ?? 1;
      const chance = odds({
        troops: s.troops,
        veterans: s.veterans,
        enemy: pirateCamp(level),
        captain: s.lead && lead ? { cls: CAPTAINS[s.lead].cls, rarity: CAPTAINS[s.lead].rarity, level: lead.level } : null,
        techs: { blades: techLevel(s.techs, "blades"), hulls: techLevel(s.techs, "hulls"), stretchers: techLevel(s.techs, "stretchers") },
        watchtowers: raftEffect(s.rafts, "watchtower"),
      });
      if (chance === "easy") any = act({ type: "sail", site: camp.id }, `attack ${camp.id} (level ${level})`) || any;
    }
    // Every other fleet salvages the nearest wreck (oil and rope).
    while (act({ type: "sail", site: WRECKS[0]!.id }, `salvage ${WRECKS[0]!.id}`)) any = true;
    return any;
  };

  const captains = () => {
    let any = false;
    for (const captain of CAPTAIN_IDS) {
      if (!s.captains[captain]) any = act({ type: "unlockCaptain", captain }, `unlock ${captain}`) || any;
      while (act({ type: "addStar", captain }, `star ${captain}`)) any = true;
    }
    // The strongest leads: the rarest, then the highest level, then the first in the list.
    const owned = CAPTAIN_IDS.filter((c) => s.captains[c]);
    const best = [...owned].sort((a, b) => RARITY_RANK[CAPTAINS[b].rarity] - RARITY_RANK[CAPTAINS[a].rarity] || s.captains[b]!.level - s.captains[a]!.level)[0];
    if (best && best !== s.lead) any = act({ type: "setLead", captain: best }, `lead ${best}`) || any;
    while (s.pearls - LOGBOOK.pearls >= PEARLS_KEPT && s.lead && s.captains[s.lead]!.level < CAPTAIN_MAX_LEVEL && act({ type: "logbook" }, "logbook")) any = true;
    return any;
  };

  const shipyard = () => {
    if (s.yard) return false;
    const slots = RAFT_SLOTS.map((x) => x.key);
    const empty = slots.find((k) => s.rafts[k] && !s.rafts[k]!.building);
    if (empty) {
      const copies = (b: RaftBuildingId) => Object.values(s.rafts).filter((r) => r.building === b).length;
      const building = RAFT_BUILDING_ORDER.find((b) => copies(b) < RAFT_BUILDING_MAX_COPIES);
      return !!building && act({ type: "installOnRaft", slot: empty, building }, `${building} on raft ${empty}`, true);
    }
    const low = slots.filter((k) => s.rafts[k]?.building && s.rafts[k]!.level < RAFT_BUILDING_MAX_LEVEL).sort((a, b) => s.rafts[a]!.level - s.rafts[b]!.level)[0];
    if (low && act({ type: "upgradeRaft", slot: low }, `raft ${low} level ${s.rafts[low]!.level + 1}`, true)) return true;
    const free = RAFT_SLOTS.find((x) => !s.rafts[x.key] && slotOpen(x.ring, s.buildings.lighthouse));
    return !!free && act({ type: "dockRaft", slot: free.key }, `raft at ${free.key}`, true);
  };

  /** A session: the player does everything the rules allow, in the order of play, then leaves. */
  const session = () => {
    const before = ids;
    let block: Block | null = null;
    for (let round = 0; round < 20; round++) {
      const mark = ids;
      block = builders();
      observatory();
      barracks();
      infirmary();
      sea();
      captains();
      shipyard();
      if (ids === mark) break;
    }
    today.sessions++;
    if (ids === before) today.empty++;
    if (block) {
      today.blocked++;
      const key = block.reason === "capped" ? "capped" : block.resource;
      blocks[key]++;
      today.by.set(key, (today.by.get(key) ?? 0) + 1);
    }
  };

  /** Moves time on to `to`, hour by hour: builders left free, full resources, walls, the first camp beaten. */
  const wait = (to: number) => {
    while (t < to) {
      const step = Math.min(to - t, HOUR - (t % HOUR));
      const busy = s.queue.reduce((sum, j) => sum + Math.min(Math.max(0, j.left), step), 0);
      today.idle += (BUILDERS * step - busy) / HOUR;
      const wall = s.queue.some((j) => j.id === "lighthouse") ? null : wallAt(s);
      if (wall) {
        const open = walls.find((w) => w.level === s.buildings.lighthouse);
        if (open) open.hours += step / HOUR;
        else walls.push({ level: s.buildings.lighthouse, ...wall, hours: step / HOUR, escaped: false });
      }
      const reports = s.reportSeq;
      s = advance(s, step);
      t += step;
      if (s.reportSeq > reports && firsts.campBeaten === null && s.reports.some((r) => r.win)) firsts.campBeaten = since(t);
      const cap = storeCap(s.buildings.lighthouse, s.techs);
      for (const k of ["oil", "fish", "wood"] as const) if (s.stock[k] >= cap) fullHours[k] += step / HOUR;
      for (const w of walls) if (s.buildings.lighthouse > w.level || s.queue.some((j) => j.id === "lighthouse" && s.buildings.lighthouse === w.level)) w.escaped = true;
      if (t % DAY === 0) endOfDay(t / DAY);
    }
  };

  const endOfDay = (day: number) => {
    const lead = s.lead ? s.captains[s.lead] : undefined;
    const owned = CAPTAIN_IDS.filter((c) => s.captains[c]);
    const blockedBy = [...today.by.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => `${k} ${n}`).join("; ");
    rows.push({
      profile: profile.id,
      day,
      lighthouse: s.buildings.lighthouse,
      power: power({
        buildings: s.buildings,
        troops: s.troops,
        veterans: s.veterans,
        captains: owned.map((c) => ({ rarity: CAPTAINS[c].rarity, stars: s.captains[c]!.stars, level: s.captains[c]!.level })),
        techs: s.techs,
        rafts: s.rafts,
      }),
      stock: { oil: Math.floor(s.stock.oil), fish: Math.floor(s.stock.fish), wood: Math.floor(s.stock.wood), rope: s.stock.rope },
      pearls: s.pearls,
      storage: storeCap(s.buildings.lighthouse, s.techs),
      troops: totalTroops(s.troops) + s.fleets.reduce((n, f) => n + totalTroops(f.troops), 0),
      veterans: totalTroops(s.veterans) + s.fleets.reduce((n, f) => n + totalTroops(f.veterans), 0),
      wounded: totalTroops(s.wounded) + (s.healing ? totalTroops(s.healing.wounded) : 0),
      captains: owned.length,
      lead: s.lead,
      leadLevel: lead?.level ?? 0,
      stars: owned.reduce((n, c) => n + s.captains[c]!.stars, 0),
      buildings: { ...s.buildings },
      techs: Object.values(s.techs).reduce((n, l) => n + (l ?? 0), 0),
      rafts: Object.keys(s.rafts).length,
      campsBeaten: CAMPS.reduce((n, c) => n + ((s.world.camps[c.id] ?? 1) - (c.level ?? 1)), 0),
      idleBuilderHours: Math.round(today.idle * 10) / 10,
      sessions: today.sessions,
      salvages: today.salvages,
      blockedSessions: today.blocked,
      blockedBy,
      emptySessions: today.empty,
      started: today.started,
    });
    today = newDay();
  };

  // Day 1: the city is founded at 8:00, in a first session; then the profile's sessions, day after day.
  session();
  for (let day = 0; day < days; day++) {
    for (const time of profile.sessions) {
      const when = day * DAY + time;
      if (when <= FOUNDED) continue;
      wait(when);
      session();
    }
    wait((day + 1) * DAY);
  }
  return { profile, days: rows, lighthouse, firsts, blocks, fullHours, walls, last: s };
}

/** The three profiles, for `days` days. */
export const simulateAll = (days: number): Run[] => PROFILES.map((p) => simulate(p, days));

/** The buildings, in a fixed order, for the CSV. */
export const CSV_BUILDINGS: readonly BuildingId[] = BUILDING_IDS;
