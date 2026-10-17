import { CAPTAINS, skillFactor, type CaptainId } from "./captains.js";
import { pirateCamp, pirateLoot, resolveCombat } from "./combat.js";
import { raftEffect, type Rafts } from "./rafts.js";
import { techLevel, type Techs } from "./research.js";
import { protoSeconds } from "./time.js";
import { OK, emptyTroops, refuse, totalTroops, type Buildings, type Check, type Rarity, type Stock, type Troops } from "./types.js";

/* ================= The sea map ================= */

export type SiteKind = "grand" | "home" | "city" | "wreck" | "fish" | "isle" | "camp";
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
};

/** Your city on the sea map. */
export const HOME = { x: -14, z: 12 };

const wreck = (n: number, x: number, z: number, amount: number): SeaSite => ({ id: `wreck-${n}`, kind: "wreck", name: "Wreck", x, z, amount, resource: "oil" });
const fish = (n: number, x: number, z: number, amount: number): SeaSite => ({ id: `fish-${n}`, kind: "fish", name: "Fish Shoal", x, z, amount, resource: "fish" });
const isle = (n: number, x: number, z: number, amount: number): SeaSite => ({ id: `isle-${n}`, kind: "isle", name: "Wooded Isle", x, z, amount, resource: "wood" });
const city = (name: string, color: AllianceColor, x: number, z: number, level: number): SeaSite => ({ id: `city-${name.toLowerCase()}`, kind: "city", name, x, z, level, color });
const camp = (level: number, x: number, z: number): SeaSite => ({ id: `camp-${level}`, kind: "camp", name: "Mist Pirates", x, z, level });

/**
 * The fixed sea map. Positions are the prototype's (its seeded placement, seed 7); amounts and city levels,
 * drawn at random by the prototype, are the values of one prototype game. No randomness in the rules.
 */
export const SEA_SITES: readonly SeaSite[] = [
  { id: "grand", kind: "grand", name: "Great Lighthouse", x: 0, z: 0 },
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
  camp(1, 23.14, 15.1),
  camp(2, 18.92, 22.65),
  camp(3, -21.07, -31.79),
  camp(4, 30.9, -28.15),
  camp(5, -8.43, -8.96),
  camp(6, -26.88, -15.86),
];

export const seaSite = (id: string): SeaSite | undefined => SEA_SITES.find((s) => s.id === id);

/** Distance from your city to a site, in map units. */
export const distance = (site: { x: number; z: number }): number => Math.hypot(site.x - HOME.x, site.z - HOME.z);

/** What changes on the map as you play: the level of each pirate camp, what is left in each wreck. */
export type SeaWorld = { camps: Record<string, number>; wrecks: Record<string, number> };

export function startingSeaWorld(): SeaWorld {
  const camps: Record<string, number> = {};
  const wrecks: Record<string, number> = {};
  for (const s of SEA_SITES) {
    if (s.kind === "camp") camps[s.id] = s.level ?? 1;
    if (s.kind === "wreck") wrecks[s.id] = s.amount ?? 0;
  }
  return { camps, wrecks };
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
export const travelTime = (site: { x: number; z: number }, techs: Techs, lead: FleetLead): number =>
  Math.round(protoSeconds(distance(site) / fleetSpeed(techs, lead)));

/** What a fleet can bring back: Harbor and Deep Holds, then Old Tom +30% gathering. */
export function holdCapacity(harbor: number, techs: Techs, lead: FleetLead): number {
  const base = Math.round((300 + harbor * 250) * (1 + 0.15 * techLevel(techs, "holds")));
  const tom = lead?.id === "tom" ? 1 + 0.3 * skillFactor(lead.level) : 1;
  return Math.round(base * tom);
}

export type FleetKind = "attack" | "collect";

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
  fleets: Fleet[];
  world: SeaWorld;
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
};

/** Can you send a fleet there now? A refusal comes with its reason. */
export function canSendFleet(siteId: string, s: Pick<SeaState, "buildings" | "troops" | "veterans" | "fleets">): Check {
  const site = seaSite(siteId);
  if (!site || (site.kind !== "camp" && site.kind !== "wreck")) return refuse("You cannot send a fleet there yet");
  if (s.fleets.length >= fleetsMax(s.buildings.harbor)) {
    return refuse(s.buildings.harbor < 1 ? "Build the Harbor to send more fleets" : "All your fleets are at sea");
  }
  // Veterans are troops too: they sail with the soldiers.
  if (site.kind === "camp" && totalTroops(s.troops) + totalTroops(s.veterans) < MIN_ATTACK_TROOPS) return refuse("You do not have enough troops");
  return OK;
}

export type SendFleet = { ok: true; state: SeaState } | { ok: false; reason: string };

/** Sends a fleet: to a camp with all your troops and veterans, who leave the city; to a wreck to salvage it. */
export function sendFleet(siteId: string, s: SeaState): SendFleet {
  const check = canSendFleet(siteId, s);
  if (!check.ok) return check;
  const site = seaSite(siteId)!;
  const kind: FleetKind = site.kind === "camp" ? "attack" : "collect";
  const travel = travelTime(site, s.techs, s.lead);
  const fleet: Fleet = {
    site: siteId,
    kind,
    phase: "out",
    left: travel,
    travel,
    troops: kind === "attack" ? { ...s.troops } : emptyTroops(),
    veterans: kind === "attack" ? { ...s.veterans } : emptyTroops(),
    techs: { ...s.techs },
    lead: s.lead ? { ...s.lead } : null,
    watchtowers: raftEffect(s.rafts, "watchtower"),
    hold: holdCapacity(s.buildings.harbor, s.techs, s.lead),
    cargo: {},
    pearls: 0,
  };
  const attack = kind === "attack";
  return { ok: true, state: { ...s, troops: attack ? emptyTroops() : s.troops, veterans: attack ? emptyTroops() : s.veterans, fleets: [...s.fleets, fleet] } };
}

const add = (a: Troops, b: Troops): Troops => ({ boarders: a.boarders + b.boarders, harpooners: a.harpooners + b.harpooners, crossbowmen: a.crossbowmen + b.crossbowmen });

/** A fleet reaches a pirate camp: deterministic combat with resolveCombat, loot from pirateLoot. */
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
  // Fragments of the loot are not given yet: the prototype gave them to a captain drawn at random.
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
  };
  return { fleet, state: { ...s, wounded: add(s.wounded, r.wounded), world }, report };
}

/** A fleet leaves a wreck with what its hold can carry; an emptied wreck refills at once. */
function salvage(f: Fleet, s: SeaState): { fleet: Fleet; state: SeaState } {
  const site = seaSite(f.site);
  const left = s.world.wrecks[f.site] ?? site?.amount ?? 0;
  const got = Math.min(left, f.hold);
  const rest = left - got;
  const wrecks = { ...s.world.wrecks, [f.site]: rest > 0 ? rest : (site?.amount ?? 0) };
  return { fleet: { ...f, cargo: { oil: got, rope: WRECK_ROPE } }, state: { ...s, world: { ...s.world, wrecks } } };
}

/** A fleet back home: its troops, its veterans and everything it carries come back, with no storage cap. */
function dock(f: Fleet, s: SeaState): SeaState {
  const stock = { ...s.stock };
  for (const [k, v] of Object.entries(f.cargo) as [keyof Stock, number][]) stock[k] += v;
  return { ...s, troops: add(s.troops, f.troops), veterans: add(s.veterans, f.veterans), stock, pearls: s.pearls + f.pearls };
}

/**
 * Advances the fleets by `seconds` real seconds. Each step (arrival and combat, end of the stay, return)
 * happens at its exact time; steps at the same moment happen in the order the fleets left.
 */
export function advanceFleets(state: SeaState, seconds: number): { state: SeaState; reports: CombatReport[] } {
  let s = state;
  const reports: CombatReport[] = [];
  let rest = Math.max(0, seconds);
  for (;;) {
    const next = Math.min(...s.fleets.map((f) => Math.max(0, f.left)));
    if (!(next <= rest)) break;
    rest -= next;
    let fleets = s.fleets.map((f) => ({ ...f, left: f.left - next }));
    s = { ...s, fleets };
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
        f = { ...f, phase: "stay", left: f.kind === "attack" ? ATTACK_STAY : COLLECT_STAY };
      } else if (f.phase === "stay") {
        if (f.kind === "collect") {
          const r = salvage(f, s);
          f = r.fleet;
          s = r.state;
        }
        f = { ...f, phase: "back", left: f.travel };
      } else {
        s = dock(f, s);
        done.push(f);
      }
      fleets = fleets.map((g, j) => (j === i ? f : g));
    }
    s = { ...s, fleets: fleets.filter((f) => !done.includes(f)) };
  }
  s = { ...s, fleets: s.fleets.map((f) => ({ ...f, left: f.left - rest })) };
  return { state: s, reports };
}
