import type { Buildings, CaptainId, OwnedCaptain, Rafts, Stock, Techs, Troops } from "@brinelight/shared";

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
};
