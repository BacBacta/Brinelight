import type { Buildings, CaptainId, CombatReport, Fleet, OwnedCaptain, Rafts, SeaWorld, Stock, Techs, Troops, UpgradeJob } from "@brinelight/shared";

/** Everything the client knows about the player's city. Temporary: the server takes over in week 4. */
export type PlayerState = {
  buildings: Buildings;
  stock: Stock;
  troops: Troops;
  techs: Techs;
  rafts: Rafts;
  captains: Partial<Record<CaptainId, OwnedCaptain>>;
  survivors: number;
  morale: number;
  /** Pearls: kept apart from the stock, never capped by storage. */
  pearls: number;
  /** Upgrades in progress, in the order they were started. */
  queue: UpgradeJob[];
  /** The captain at the head of your fleets. */
  lead: CaptainId | null;
  /** Fleets at sea, in the order they left. */
  fleets: Fleet[];
  /** Pirate camp levels and what is left in each wreck. */
  world: SeaWorld;
  /** Wounded resting in the Infirmary (healing comes later). */
  wounded: Troops;
  /** The last combat reports, newest last. */
  reports: Report[];
};

export type Report = CombatReport & { read: boolean };
