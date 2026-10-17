import type { CaptainId, Shards } from "../rules/captains.js";
import type { Rafts, YardJob } from "../rules/rafts.js";
import type { ResearchJob, Techs } from "../rules/research.js";
import type { HealingJob } from "../rules/healing.js";
import type { TrainingJob } from "../rules/training.js";
import type { CombatReport, Fleet, SeaWorld } from "../rules/sea.js";
import type { OwnedCaptain } from "../rules/start.js";
import type { UpgradeJob } from "../rules/buildings.js";
import type { Buildings, Stock, Troops } from "../rules/types.js";

/** Everything known about a player's city. The client and the server hold the same document. */
export type PlayerState = {
  buildings: Buildings;
  stock: Stock;
  troops: Troops;
  /** Veterans in the city: promoted at the Barracks, each worth VETERAN_WEIGHT soldiers in combat. */
  veterans: Troops;
  techs: Techs;
  rafts: Rafts;
  captains: Partial<Record<CaptainId, OwnedCaptain>>;
  /** Shards by captain, owned or not: FRAGMENTS_PER_STAR unlock a captain or add a star. Won at the pirate camps. */
  shards: Shards;
  survivors: number;
  morale: number;
  /** Pearls: kept apart from the stock, never capped by storage. */
  pearls: number;
  /** Upgrades in progress, in the order they were started. */
  queue: UpgradeJob[];
  /** The research in progress at the Observatory: one at a time, null when none. */
  research: ResearchJob | null;
  /** The work at the shipyard (a new raft): one at a time, null when none. */
  yard: YardJob | null;
  /** The work at the Barracks (a batch of new soldiers): one at a time, null when none. */
  training: TrainingJob | null;
  /** The healing at the Infirmary: the wounded being healed, out of the beds; one at a time, null when none. */
  healing: HealingJob | null;
  /** The captain at the head of your fleets. */
  lead: CaptainId | null;
  /** Fleets at sea, in the order they left. */
  fleets: Fleet[];
  /** Pirate camp levels and what is left in each wreck. */
  world: SeaWorld;
  /** Wounded resting in the Infirmary's beds, not being healed yet. */
  wounded: Troops;
  /** The last combat reports, newest last. */
  reports: Report[];
  /** How many reports this city has ever had: the next one is numbered reportSeq + 1. */
  reportSeq: number;
};

/** A combat report, with a stable id ("r1", "r2"…) given in the order reports arrive, never reused. */
export type Report = CombatReport & { id: string; read: boolean };
