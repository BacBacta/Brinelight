import type { Buildings, CaptainId, OwnedCaptain, Rafts, Stock, Techs, Troops, UpgradeJob } from "@brinelight/shared";

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
  /** Upgrades in progress, in the order they were started. */
  queue: UpgradeJob[];
};
