import { CAPTAINS, addXp, combatXp, skillFactor, type CaptainId, type Captains, type Shards } from "./captains.js";
import { pirateCamp, pirateLoot, resolveCombat, strengths } from "./combat.js";
import { EARLY_CAMP_TRIP, earlyCapped } from "./early.js";
import { storeCap } from "./economy.js";
import { HUNT_SHARDS, HUNT_XP, LEVIATHAN_SITE, huntAt, huntPearls, huntShare, leviathanHealth, type LeviathanState } from "./leviathan.js";
import { raftEffect, type Rafts } from "./rafts.js";
import { techLevel, type Techs } from "./research.js";
import type { ServerId } from "./servers.js";
import { HOUR, protoSeconds } from "./time.js";
import { OK, emptyTroops, refuse, totalTroops, type Buildings, type Check, type Rarity, type Stock, type Troops } from "./types.js";

/* ================= The sea map ================= */

export type SiteKind = "grand" | "home" | "city" | "wreck" | "fish" | "isle" | "camp" | "leviathan";
export type AllianceColor = "blue" | "green" | "yellow" | "red";

export type SeaSite = {
  id: string;
  kind: SiteKind;
  name: string;
  /** Map position, in map units. */
  x: number;
  z: number;
  /** Lighthouse level of a city, or starting level of a pirate camp. */
  level?: number;
  /** What a wreck, a shoal or an isle holds at the start, and what it refills to. */
  amount?: number;
  resource?: "oil" | "fish" | "wood";
  color?: AllianceColor;
  /** The captain whose shards a pirate camp gives when you beat it: always the same one, never drawn at random. */
  captain?: CaptainId;
};

/** Your city on the sea map. */
export const HOME = { x: -14, z: 12 };

const wreck = (n: number, x: number, z: number, amount: number): SeaSite => ({ id: `wreck-${n}`, kind: "wreck", name: "Wreck", x, z, amount, resource: "oil" });
const fish = (n: number, x: number, z: number, amount: number): SeaSite => ({ id: `fish-${n}`, kind: "fish", name: "Fish Shoal", x, z, amount, resource: "fish" });
const isle = (n: number, x: number, z: number, amount: number): SeaSite => ({ id: `isle-${n}`, kind: "isle", name: "Wooded Isle", x, z, amount, resource: "wood" });
const city = (name: string, color: AllianceColor, x: number, z: number, level: number): SeaSite => ({ id: `city-${name.toLowerCase()}`, kind: "city", name, x, z, level, color });
const camp = (level: number, x: number, z: number, captain: CaptainId): SeaSite => ({ id: `camp-${level}`, kind: "camp", name: "Mist Pirates", x, z, level, captain });

/**
 * The fixed sea map. Positions are the prototype's (its seeded placement, seed 7); amounts and city levels,
 * drawn at random by the prototype, are the values of one prototype game. No randomness in the rules.
 */
export const SEA_SITES: readonly SeaSite[] = [
  { id: "grand", kind: "grand", name: "Great Lighthouse", x: 0, z: 0 },
  // The Leviathan rises by the Great Lighthouse, 17 map units from your city, in the sea map's first view (week 7, task 3).
  { id: LEVIATHAN_SITE, kind: "leviathan", name: "Leviathan", x: -6, z: -3 },
  { id: "home", kind: "home", name: "Your city", x: HOME.x, z: HOME.z },
  city("Lierre", "blue", -31.25, -28.03, 5),
  city("Orme", "blue", 30.52, 12.74, 6),
  city("Aldo", "blue", -2.16, -16.64, 3),
  city("Runa", "blue", 3.41, 14.71, 8),
  city("Brann", "blue", -15.5, -22.02, 4),
  city("Ondine", "green", 16.9, 1.18, 8),
  city("Perle", "green", -19.38, -8.45, 7),
  city("Murène", "green", -13.23, 2.22, 4),
  city("Gaspard", "yellow", -13.03, 30.59, 8),
  city("Topaze", "yellow", -16.16, 24.18, 5),
  city("Krake", "red", -22.1, -13.38, 4),
  city("Barbe-Sel", "red", -27.23, 26.43, 4),
  city("Vorace", "red", 3.44, 7.78, 6),
  wreck(1, 11.53, 29.82, 240),
  wreck(2, 26.96, 20.97, 480),
  wreck(3, -4.78, -30.71, 300),
  wreck(4, 17.15, -8.39, 420),
  wreck(5, -2.01, 28.56, 540),
  wreck(6, 12.05, -10.84, 480),
  wreck(7, -23.12, -23.47, 240),
  wreck(8, -29.21, 11.79, 420),
  fish(1, 3.06, 20.9, 420),
  fish(2, -24.51, 1.92, 420),
  fish(3, 6.03, 29.69, 360),
  fish(4, 29.92, 3.11, 600),
  fish(5, 20.39, -31.64, 360),
  fish(6, 1.03, -11, 480),
  isle(1, -4.48, 9.11, 600),
  isle(2, -12.01, -16.84, 540),
  isle(3, 8.36, -31.08, 420),
  isle(4, 9.6, 19.51, 360),
  isle(5, -23.1, 31.63, 360),
  // Each camp gives the shards of one captain (owner's decision, 17 October): the rarer the captain, the stronger
  // the camp at the start. Officers first, Old Tom's for stars, then the commanders and the admirals.
  camp(1, 23.14, 15.1, "sel"),
  camp(2, 18.92, 22.65, "tom"),
  camp(3, -21.07, -31.79, "bran"),
  camp(4, 30.9, -28.15, "isa"),
  camp(5, -8.43, -8.96, "mira"),
  camp(6, -26.88, -15.86, "nera"),
];

export const seaSite = (id: string): SeaSite | undefined => SEA_SITES.find((s) => s.id === id);

/** Distance from your city to a site, in map units. */
export const distance = (site: { x: number; z: number }): number => Math.hypot(site.x - HOME.x, site.z - HOME.z);

/**
 * What changes on the map as you play: the level of each pirate camp, what is left in each wreck, what is left on each
 * isle and shoal a fleet has harvested (`harvest`: one not in it is full), and for each emptied wreck, isle or shoal,
 * the real seconds before it fills again (`refill`: only the ones at 0 are in it).
 */
export type SeaWorld = { camps: Record<string, number>; wrecks: Record<string, number>; harvest: Record<string, number>; refill: Record<string, number> };

/** How long an emptied wreck waits before it fills again, in real seconds (owner's decision, 18 October). */
export const WRECK_REFILL = 2 * HOUR;
/** Past Lighthouse 24, a salvage brings 25 % more oil per Lighthouse level above 24 (owner's decision, 18 October). */
export const RICH_WRECKS_FROM = 24;
export const RICH_WRECK_BONUS = 0.25;

/**
 * The Wooded Isles and Fish Shoals (owner's decision, 23 October; docs/studies/resources.md): the fleets harvest them as
 * the wrecks, with no troops. One holds its map amount, 10 % more a Lighthouse level, and fills again 8 hours after it
 * is emptied. The wrecks stay the source of the oil.
 */
export const HARVEST_GROWTH = 0.1;
export const HARVEST_REFILL = 8 * HOUR;

/** What an isle or a shoal holds when full, at this Lighthouse level. */
export const harvestAmount = (site: SeaSite, lighthouse: number): number => Math.round((site.amount ?? 0) * (1 + HARVEST_GROWTH * (lighthouse - 1)));

/** A site the fleets gather from: a wreck (oil and rope), an isle (wood) or a shoal (fish). */
export const gathers = (site: SeaSite): boolean => site.kind === "wreck" || site.kind === "isle" || site.kind === "fish";

/** What is left to gather on a site now: a wreck's oil, or an isle's or a shoal's, full until a fleet harvests it. */
export function siteLeft(world: SeaWorld, site: SeaSite, lighthouse: number): number {
  if (site.kind === "wreck") return world.wrecks[site.id] ?? 0;
  return world.harvest[site.id] ?? harvestAmount(site, lighthouse);
}

/** The oil a fleet brings back from `got` taken from a wreck, at this Lighthouse level. */
export const wreckOil = (got: number, lighthouse: number): number => Math.round(got * (1 + RICH_WRECK_BONUS * Math.max(0, lighthouse - RICH_WRECKS_FROM)));

export function startingSeaWorld(): SeaWorld {
  const camps: Record<string, number> = {};
  const wrecks: Record<string, number> = {};
  for (const s of SEA_SITES) {
    if (s.kind === "camp") camps[s.id] = s.level ?? 1;
    if (s.kind === "wreck") wrecks[s.id] = s.amount ?? 0;
  }
  return { camps, wrecks, harvest: {}, refill: {} };
}

/* ================= Fleets ================= */

/** Fleet speed in map units per prototype second. */
export const FLEET_SPEED = 4.2;
/** Time spent on site, real seconds: a short fight, a longer salvage. */
export const ATTACK_STAY = protoSeconds(1.2);
export const COLLECT_STAY = protoSeconds(8);
/** Fewest troops you can attack with. */
export const MIN_ATTACK_TROOPS = 5;
/** Rope brought back from a wreck (the prototype drew 1 to 3). */
export const WRECK_ROPE = 2;
/** Infirmary beds per level. */
export const HOSPITAL_BEDS = 60;

/** The lead captain, as it sails with a fleet. */
export type FleetLead = { id: CaptainId; rarity: Rarity; level: number } | null;

export function leadOf(id: CaptainId | null, captains: Partial<Record<CaptainId, { level: number }>>): FleetLead {
  if (!id) return null;
  const c = captains[id];
  return c ? { id, rarity: CAPTAINS[id].rarity, level: c.level } : null;
}

/** Fleets at sea at the same time: one more every two Harbor levels. */
export const fleetsMax = (harbor: number): number => 1 + Math.floor((harbor + 1) / 2);

export const hospitalCapacity = (infirmary: number): number => infirmary * HOSPITAL_BEDS;

/** Map units per prototype second: Lateen Sails +10% per level, Sel the Navigator +40%. */
export function fleetSpeed(techs: Techs, lead: FleetLead): number {
  const sel = lead?.id === "sel" ? 1 + 0.4 * skillFactor(lead.level) : 1;
  return FLEET_SPEED * sel * (1 + 0.1 * techLevel(techs, "sails"));
}

/** One-way trip to a site, in real seconds. */
/** A fleet's way out to a pirate camp: at most 10 minutes while the Lighthouse is below level 6 (the early start). */
export const campTrip = (travel: number, lighthouse: number): number => earlyCapped(travel, EARLY_CAMP_TRIP, lighthouse);

export const travelTime = (site: { x: number; z: number }, techs: Techs, lead: FleetLead): number =>
  Math.round(protoSeconds(distance(site) / fleetSpeed(techs, lead)));

/** What a fleet can bring back: Harbor and Deep Holds, then Old Tom +30% gathering. */
export function holdCapacity(harbor: number, techs: Techs, lead: FleetLead): number {
  const base = Math.round((300 + harbor * 250) * (1 + 0.15 * techLevel(techs, "holds")));
  const tom = lead?.id === "tom" ? 1 + 0.3 * skillFactor(lead.level) : 1;
  return Math.round(base * tom);
}

/** To a camp, to a wreck, to the Leviathan. */
export type FleetKind = "attack" | "collect" | "hunt";

/**
 * A fleet at sea. It keeps a copy of your research, lead captain, Watchtowers and hold taken when it left:
 * speed, combat and hold never change during the trip.
 */
export type Fleet = {
  site: string;
  kind: FleetKind;
  phase: "out" | "stay" | "back";
  /** Real seconds left in this phase. */
  left: number;
  /** One-way trip, real seconds, fixed at departure. */
  travel: number;
  /** The way out, when shorter than `travel`: a pirate camp's in the early start (`campTrip`). The way back is `travel`. */
  out?: number;
  troops: Troops;
  /** The veterans it took: a veteran counts as VETERAN_WEIGHT soldiers in combat. */
  veterans: Troops;
  techs: Techs;
  lead: FleetLead;
  watchtowers: number;
  hold: number;
  /** Brought home: resources (no storage cap) and Pearls. */
  cargo: Partial<Stock>;
  pearls: number;
};

/** Everything the sea rules read and change. */
export type SeaState = {
  buildings: Buildings;
  troops: Troops;
  veterans: Troops;
  stock: Stock;
  pearls: number;
  /** Wounded resting in the Infirmary. */
  wounded: Troops;
  techs: Techs;
  rafts: Rafts;
  lead: FleetLead;
  /** Your captains and their shards: a combat gives experience to the captain who sailed and shards to the camp's. */
  captains: Captains;
  shards: Shards;
  fleets: Fleet[];
  world: SeaWorld;
  /** The city's clock (seconds since 1970, UTC): the Leviathan's hunts follow it, at its server's hours. */
  clock: number;
  server: ServerId;
  leviathan: LeviathanState;
};

export type CombatReport = {
  site: string;
  level: number;
  win: boolean;
  attack: number;
  defense: number;
  sent: Troops;
  losses: Troops;
  wounded: Troops;
  enemy: Troops;
  loot: { oil: number; wood: number; pearls: number; rope: number } | null;
  /** The veterans sent and lost. Absent from reports made before veterans existed. */
  veteranSent?: Troops;
  veteranLosses?: Troops;
  /** Did your city have an Infirmary at the time of the combat? Absent from reports made before it was kept. */
  infirmary?: boolean;
  /** The experience the captain who sailed gained, and its level-ups. Absent with no captain, and from older reports. */
  captainXp?: { id: CaptainId; xp: number; levels: number };
  /** The shards a victory gave, to the camp's captain. Absent after a defeat, and from older reports. */
  shards?: { id: CaptainId; count: number };
  /** A hunt of the Leviathan: the damage your fleets dealt, its health, your share (0 to 1). Absent for a camp. */
  hunt?: { damage: number; health: number; share: number };
};

/** How far your fleets can sail now (map units from your city), and whether the Lighthouse is stoked. */
export type Sight = { reach: number; lit: boolean };
/** Calm weather: the whole sea. */
export const CLEAR_SIGHT: Sight = { reach: Infinity, lit: false };

/** What a check before sailing reads. */
export type SendCheck = Pick<SeaState, "buildings" | "troops" | "veterans" | "fleets" | "techs" | "lead" | "clock" | "server" | "leviathan" | "world">;

/** Why an emptied site cannot be sailed to yet. */
const EMPTY = {
  wreck: "This wreck is empty. Wait for it to fill again.",
  isle: "This isle is bare. Wait for it to grow back.",
  fish: "This shoal is empty. Wait for the fish to come back.",
} as const;

/**
 * Can you send a fleet there now? In the Mist, only within the Lighthouse's light; the Leviathan only while it is at
 * sea, and only if your fleet gets there before it dives (the Mist never hides it); a wreck only once it has filled
 * again. A refusal comes with its reason.
 */
export function canSendFleet(siteId: string, s: SendCheck, sight: Sight = CLEAR_SIGHT): Check {
  const site = seaSite(siteId);
  if (!site || (site.kind !== "camp" && !gathers(site) && site.kind !== "leviathan")) return refuse("You cannot send a fleet there yet");
  if (site.kind === "leviathan") {
    const w = huntAt(s.clock, s.server);
    if (!w.on) return refuse("The Leviathan is not at sea. Wait for it to rise.");
    if (s.leviathan.hunt === w.start && s.leviathan.over) return refuse("The Leviathan has dived. Wait for it to rise again.");
    if (s.clock + travelTime(site, s.techs, s.lead) >= w.end) return refuse("Your fleet would get there after the Leviathan dives");
  } else if (distance(site) > sight.reach) {
    return refuse(sight.lit ? "The Mist hides this place. Wait for it to lift." : "The Mist hides this place. Stoke the Lighthouse or wait for it to lift.");
  } else if (gathers(site) && siteLeft(s.world, site, s.buildings.lighthouse) <= 0) {
    return refuse(EMPTY[site.kind as "wreck" | "isle" | "fish"]);
  }
  if (s.fleets.length >= fleetsMax(s.buildings.harbor)) {
    return refuse(s.buildings.harbor < 1 ? "Build the Harbor to send more fleets" : "All your fleets are at sea");
  }
  // Veterans are troops too: they sail with the soldiers.
  if (!gathers(site) && totalTroops(s.troops) + totalTroops(s.veterans) < MIN_ATTACK_TROOPS) return refuse("You do not have enough troops");
  return OK;
}

export type SendFleet = { ok: true; state: SeaState } | { ok: false; reason: string };

/**
 * Sends a fleet: to a camp or the Leviathan with all your troops and veterans, who leave the city; to a wreck to
 * salvage it, to an isle or a shoal to harvest it.
 */
export function sendFleet(siteId: string, s: SeaState, sight: Sight = CLEAR_SIGHT): SendFleet {
  const check = canSendFleet(siteId, s, sight);
  if (!check.ok) return check;
  const site = seaSite(siteId)!;
  const kind: FleetKind = site.kind === "camp" ? "attack" : site.kind === "leviathan" ? "hunt" : "collect";
  const travel = travelTime(site, s.techs, s.lead);
  const out = kind === "attack" ? campTrip(travel, s.buildings.lighthouse) : travel;
  const fleet: Fleet = {
    site: siteId,
    kind,
    phase: "out",
    left: out,
    travel,
    ...(out < travel ? { out } : {}),
    troops: kind === "collect" ? emptyTroops() : { ...s.troops },
    veterans: kind === "collect" ? emptyTroops() : { ...s.veterans },
    techs: { ...s.techs },
    lead: s.lead ? { ...s.lead } : null,
    watchtowers: raftEffect(s.rafts, "watchtower"),
    hold: holdCapacity(s.buildings.harbor, s.techs, s.lead),
    cargo: {},
    pearls: 0,
  };
  const army = kind !== "collect";
  return { ok: true, state: { ...s, troops: army ? emptyTroops() : s.troops, veterans: army ? emptyTroops() : s.veterans, fleets: [...s.fleets, fleet] } };
}

const add = (a: Troops, b: Troops): Troops => ({ boarders: a.boarders + b.boarders, harpooners: a.harpooners + b.harpooners, crossbowmen: a.crossbowmen + b.crossbowmen });

/**
 * A fleet reaches a pirate camp: deterministic combat with resolveCombat, loot from pirateLoot. The captain who sailed
 * gains its experience (combatXp), even if another one leads your fleets now; a victory gives the camp's level in
 * shards to the camp's captain, owned or not.
 */
function fight(f: Fleet, s: SeaState): { fleet: Fleet; state: SeaState; report: CombatReport } {
  const level = s.world.camps[f.site] ?? seaSite(f.site)?.level ?? 1;
  const enemy = pirateCamp(level);
  const r = resolveCombat({
    troops: f.troops,
    veterans: f.veterans,
    enemy,
    captain: f.lead ? { cls: CAPTAINS[f.lead.id].cls, rarity: f.lead.rarity, level: f.lead.level } : null,
    techs: { blades: techLevel(f.techs, "blades"), hulls: techLevel(f.techs, "hulls"), stretchers: techLevel(f.techs, "stretchers") },
    watchtowers: f.watchtowers,
    hospital: s.buildings.infirmary > 0 ? { capacity: hospitalCapacity(s.buildings.infirmary), occupied: totalTroops(s.wounded) } : null,
  });
  const l = r.win ? pirateLoot(level) : null;
  const loot = l ? { oil: l.oil, wood: l.wood, pearls: l.pearls, rope: l.rope } : null;
  const fleet: Fleet = {
    ...f,
    troops: r.survivors,
    veterans: r.veteranSurvivors,
    cargo: loot ? { oil: loot.oil, wood: loot.wood, rope: loot.rope } : {},
    pearls: loot ? loot.pearls : 0,
  };
  const world = r.win ? { ...s.world, camps: { ...s.world.camps, [f.site]: level + 1 } } : s.world;
  // The captain who sailed, as you own it now (a Logbook may have raised it meanwhile).
  const sailed = f.lead ? s.captains[f.lead.id] : undefined;
  const gained = f.lead && sailed ? { id: f.lead.id, ...addXp(sailed, combatXp(r.win, level)) } : null;
  const captains = gained ? { ...s.captains, [gained.id]: { ...sailed!, level: gained.level, xp: gained.xp } } : s.captains;
  const shardsFor = seaSite(f.site)?.captain;
  const shards = l && shardsFor ? { ...s.shards, [shardsFor]: (s.shards[shardsFor] ?? 0) + l.fragments } : s.shards;
  const report: CombatReport = {
    site: f.site,
    level,
    win: r.win,
    attack: r.attack,
    defense: r.defense,
    sent: { ...f.troops },
    losses: r.losses,
    wounded: r.wounded,
    enemy,
    loot,
    veteranSent: { ...f.veterans },
    veteranLosses: r.veteranLosses,
    infirmary: s.buildings.infirmary > 0,
    ...(gained ? { captainXp: { id: gained.id, xp: combatXp(r.win, level), levels: gained.levelsGained } } : {}),
    ...(l && shardsFor ? { shards: { id: shardsFor, count: l.fragments } } : {}),
  };
  return { fleet, state: { ...s, wounded: add(s.wounded, r.wounded), world, captains, shards }, report };
}

/**
 * A fleet leaves a wreck with what its hold can carry, and more past Lighthouse 24 (wreckOil); an isle with its wood, a
 * shoal with its fish. The site it empties waits before it fills again: a wreck WRECK_REFILL, an isle or a shoal
 * HARVEST_REFILL. A site another fleet emptied first gives nothing.
 */
function salvage(f: Fleet, s: SeaState): { fleet: Fleet; state: SeaState } {
  const site = seaSite(f.site)!;
  const left = siteLeft(s.world, site, s.buildings.lighthouse);
  if (left <= 0) return { fleet: { ...f, cargo: {} }, state: s };
  const got = Math.min(left, f.hold);
  const rest = left - got;
  if (site.kind === "wreck") {
    const wrecks = { ...s.world.wrecks, [f.site]: rest };
    const refill = rest > 0 ? s.world.refill : { ...s.world.refill, [f.site]: WRECK_REFILL };
    return { fleet: { ...f, cargo: { oil: wreckOil(got, s.buildings.lighthouse), rope: WRECK_ROPE } }, state: { ...s, world: { ...s.world, wrecks, refill } } };
  }
  const harvest = { ...s.world.harvest, [f.site]: rest };
  const refill = rest > 0 ? s.world.refill : { ...s.world.refill, [f.site]: HARVEST_REFILL };
  return { fleet: { ...f, cargo: site.kind === "isle" ? { wood: got } : { fish: got } }, state: { ...s, world: { ...s.world, harvest, refill } } };
}

/**
 * The emptied sites after `dt` more seconds: each one whose wait is over fills again, a wreck with what it held at the
 * start, an isle or a shoal in full (what it holds at the Lighthouse's level of its next harvest).
 */
function refillWrecks(world: SeaWorld, dt: number): SeaWorld {
  const ids = Object.keys(world.refill);
  if (ids.length === 0 || dt <= 0) return world;
  const refill: Record<string, number> = {};
  const wrecks = { ...world.wrecks };
  const harvest = { ...world.harvest };
  for (const id of ids) {
    const left = world.refill[id]! - dt;
    if (left > 0) refill[id] = left;
    else if (seaSite(id)?.kind === "wreck") wrecks[id] = seaSite(id)?.amount ?? 0;
    else delete harvest[id];
  }
  return { ...world, wrecks, harvest, refill };
}

/**
 * A fleet back home: its troops, its veterans and everything it carries come back. A camp's loot has no storage cap; a
 * wreck's oil fills the storage and no more (its rope always comes in).
 */
function dock(f: Fleet, s: SeaState): SeaState {
  const stock = { ...s.stock };
  const cap = storeCap(s.buildings.lighthouse, s.techs);
  for (const [k, v] of Object.entries(f.cargo) as [keyof Stock, number][]) {
    stock[k] += f.kind === "collect" && k !== "rope" ? Math.min(v, Math.max(0, cap - stock[k])) : v;
  }
  return { ...s, troops: add(s.troops, f.troops), veterans: add(s.veterans, f.veterans), stock, pearls: s.pearls + f.pearls };
}

/**
 * The damage a fleet deals to the Leviathan per real hour on site: its attack, as against a camp (troops, veterans,
 * lead captain, Blades, Watchtowers), with no troop of the triangle to counter.
 */
export function huntAttack(f: Pick<Fleet, "troops" | "veterans" | "lead" | "techs" | "watchtowers">): number {
  return strengths({
    troops: f.troops,
    veterans: f.veterans,
    enemy: emptyTroops(),
    captain: f.lead ? { cls: CAPTAINS[f.lead.id].cls, rarity: f.lead.rarity, level: f.lead.level } : null,
    techs: { blades: techLevel(f.techs, "blades") },
    watchtowers: f.watchtowers,
  }).attack;
}

const hunting = (f: Fleet) => f.kind === "hunt" && f.phase === "stay";

/** Damage per real second of the fleets at the Leviathan now: none once the hunt is over for you. */
const huntRate = (s: SeaState): number => (s.leviathan.over ? 0 : s.fleets.filter(hunting).reduce((d, f) => d + huntAttack(f) / HOUR, 0));

/**
 * The hunt ends for you: killed (its health all taken) or dived at the hunt's end. Pearls by your share, and for the
 * captain who led your first fleet there, experience and, when killed, shards; one report. The fleets on site sail home
 * with their troops: no troop is lost.
 */
function endHunt(s: SeaState, killed: boolean): { state: SeaState; report: CombatReport } {
  const l = s.leviathan;
  const health = leviathanHealth(l.level);
  const damage = killed ? health : l.damage;
  const share = huntShare(damage, l.level);
  const pearls = huntPearls(share);
  const hunters = s.fleets.filter(hunting);
  const lead = hunters.find((f) => f.lead)?.lead ?? null;
  const sailed = lead ? s.captains[lead.id] : undefined;
  const gained = lead && sailed ? { id: lead.id, ...addXp(sailed, HUNT_XP) } : null;
  const captains = gained ? { ...s.captains, [gained.id]: { ...sailed!, level: gained.level, xp: gained.xp } } : s.captains;
  const shards = killed && lead ? { ...s.shards, [lead.id]: (s.shards[lead.id] ?? 0) + HUNT_SHARDS } : s.shards;
  const report: CombatReport = {
    site: LEVIATHAN_SITE,
    level: l.level,
    win: killed,
    attack: hunters.reduce((a, f) => a + huntAttack(f), 0),
    defense: health,
    sent: hunters.reduce((t, f) => add(t, f.troops), emptyTroops()),
    losses: emptyTroops(),
    wounded: emptyTroops(),
    enemy: emptyTroops(),
    loot: { oil: 0, wood: 0, pearls, rope: 0 },
    veteranSent: hunters.reduce((t, f) => add(t, f.veterans), emptyTroops()),
    veteranLosses: emptyTroops(),
    infirmary: s.buildings.infirmary > 0,
    ...(gained ? { captainXp: { id: gained.id, xp: HUNT_XP, levels: gained.levelsGained } } : {}),
    ...(killed && lead ? { shards: { id: lead.id, count: HUNT_SHARDS } } : {}),
    // Rounded for the report, so that the same hunt advanced in long or short steps gives the same report.
    hunt: { damage: Math.round(damage), health, share: Math.round(share * 10_000) / 10_000 },
  };
  const fleets = s.fleets.map((f) => (hunting(f) ? { ...f, phase: "back" as const, left: f.travel } : f));
  const leviathan = { level: killed ? l.level + 1 : l.level, hunt: l.hunt, damage, over: true };
  return { state: { ...s, pearls: s.pearls + pearls, captains, shards, fleets, leviathan }, report };
}

/** Moves the clock, the fleets and the emptied wrecks, isles and shoals on by `dt` seconds, the fleets at the Leviathan dealing their damage. */
function elapse(s: SeaState, dt: number): SeaState {
  const rate = huntRate(s);
  return {
    ...s,
    clock: s.clock + dt,
    world: refillWrecks(s.world, dt),
    fleets: s.fleets.map((f) => ({ ...f, left: f.left - dt })),
    leviathan: rate > 0 ? { ...s.leviathan, damage: s.leviathan.damage + rate * dt } : s.leviathan,
  };
}

/**
 * Advances the fleets by `seconds` real seconds. Each step (arrival and combat, end of the stay, return, the
 * Leviathan killed) happens at its exact time; steps at the same moment happen in the order the fleets left.
 */
export function advanceFleets(state: SeaState, seconds: number): { state: SeaState; reports: CombatReport[] } {
  let s = state;
  const reports: CombatReport[] = [];
  let rest = Math.max(0, seconds);
  for (;;) {
    const rate = huntRate(s);
    const toKill = rate > 0 ? Math.max(0, (leviathanHealth(s.leviathan.level) - s.leviathan.damage) / rate) : Infinity;
    const next = Math.min(...s.fleets.map((f) => Math.max(0, f.left)), toKill);
    if (!(next <= rest)) break;
    rest -= next;
    s = elapse(s, next);
    if (next === toKill) {
      const r = endHunt(s, true);
      s = r.state;
      reports.push(r.report);
    }
    let fleets = s.fleets;
    const done: Fleet[] = [];
    for (let i = 0; i < fleets.length; i++) {
      let f = fleets[i]!;
      if (f.left > 0) continue;
      if (f.phase === "out") {
        if (f.kind === "attack") {
          const r = fight(f, s);
          f = r.fleet;
          s = r.state;
          reports.push(r.report);
        }
        if (f.kind === "hunt") {
          // It stays until the hunt ends; it turns back if the Leviathan has already dived or been killed.
          const w = huntAt(s.clock, s.server);
          const l = s.leviathan;
          const over = !w.on || (l.hunt === w.start && l.over);
          if (!over && l.hunt !== w.start) s = { ...s, leviathan: { level: l.level, hunt: w.start, damage: 0, over: false } };
          f = over ? { ...f, phase: "back", left: f.travel } : { ...f, phase: "stay", left: w.end - s.clock };
        } else {
          f = { ...f, phase: "stay", left: f.kind === "attack" ? ATTACK_STAY : COLLECT_STAY };
        }
      } else if (f.phase === "stay") {
        if (f.kind === "collect") {
          const r = salvage(f, s);
          f = r.fleet;
          s = r.state;
        }
        if (f.kind === "hunt" && !s.leviathan.over) {
          // The hunt ends: the Leviathan dives. Every fleet still on site sails home with this one.
          const r = endHunt({ ...s, fleets }, false);
          s = r.state;
          reports.push(r.report);
          fleets = s.fleets;
          f = fleets[i]!;
        } else {
          f = { ...f, phase: "back", left: f.travel };
        }
      } else {
        s = dock(f, s);
        done.push(f);
      }
      fleets = fleets.map((g, j) => (j === i ? f : g));
    }
    s = { ...s, fleets: fleets.filter((f) => !done.includes(f)) };
  }
  s = elapse(s, rest);
  return { state: s, reports };
}
