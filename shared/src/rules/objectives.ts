/**
 * Objectives (week 7, task 4): a fixed list, one at a time, in order. Each one has a condition read from the city and
 * a reward you claim (action `claimObjective`); the rules check the condition, never the client. The list is the
 * prototype's, without what needs other players or a payment, its speedups replaced by resources, and nothing that
 * asks you to be online at a fixed hour (owner's decision, 18 October).
 */
import type { Rafts } from "./rafts.js";
import type { ResearchJob, Techs } from "./research.js";
import type { Buildings } from "./types.js";

/** What a reward gives: resources and Pearls. Never anything for sale. */
export type Reward = Partial<Record<"oil" | "fish" | "wood" | "rope" | "pearls", number>>;

/** What your city has done since it was founded, for the objectives that are not read from its buildings. */
export type Progress = { gathers: number; trained: number; camps: number };

export const startingProgress = (): Progress => ({ gathers: 0, trained: 0, camps: 0 });

/** What an objective's condition reads. */
export type ObjectiveView = {
  buildings: Buildings;
  techs: Techs;
  research: ResearchJob | null;
  rafts: Rafts;
  mist: { held: number };
  progress: Progress;
};

export type Objective = { text: string; reward: Reward; done: (c: ObjectiveView) => boolean };

export const OBJECTIVES: readonly Objective[] = [
  { text: "Upgrade the Refinery to level 2", reward: { wood: 150, fish: 100 }, done: (c) => c.buildings.refinery >= 2 },
  { text: "Build the Barracks", reward: { fish: 200 }, done: (c) => c.buildings.barracks >= 1 },
  { text: "Build the Harbor", reward: { oil: 150 }, done: (c) => c.buildings.harbor >= 1 },
  { text: "Build the Observatory", reward: { oil: 200, wood: 150 }, done: (c) => c.buildings.observatory >= 1 },
  { text: "Start your first research", reward: { wood: 200 }, done: (c) => c.research !== null || Object.values(c.techs).some((l) => (l ?? 0) > 0) },
  { text: "Send a fleet to gather at sea", reward: { pearls: 100 }, done: (c) => c.progress.gathers >= 1 },
  { text: "Upgrade the Lighthouse to level 3", reward: { oil: 300, wood: 300 }, done: (c) => c.buildings.lighthouse >= 3 },
  { text: "Train troops at the Barracks", reward: { fish: 200 }, done: (c) => c.progress.trained >= 1 },
  { text: "Beat a pirate camp", reward: { pearls: 150 }, done: (c) => c.progress.camps >= 1 },
  { text: "Build the Infirmary", reward: { fish: 250 }, done: (c) => c.buildings.infirmary >= 1 },
  { text: "Keep the Lighthouse stoked through a Mist", reward: { oil: 250 }, done: (c) => c.mist.held >= 1 },
  { text: "Upgrade the Lumberyard to level 3", reward: { fish: 300 }, done: (c) => c.buildings.lumberyard >= 3 },
  { text: "Upgrade the Shelters to level 3", reward: { fish: 300 }, done: (c) => c.buildings.shelters >= 3 },
  { text: "Upgrade the Lighthouse to level 4", reward: { oil: 400, wood: 400, fish: 400 }, done: (c) => c.buildings.lighthouse >= 4 },
  { text: "Moor your first raft", reward: { rope: 2, wood: 300 }, done: (c) => Object.keys(c.rafts).length >= 1 },
  { text: "Put a Kelp Greenhouse on a raft", reward: { fish: 400 }, done: (c) => Object.values(c.rafts).some((r) => r.building === "greenhouse") },
  { text: "Upgrade the Harbor to level 3", reward: { pearls: 200 }, done: (c) => c.buildings.harbor >= 3 },
  { text: "Bring the Lighthouse to level 5", reward: { pearls: 300 }, done: (c) => c.buildings.lighthouse >= 5 },
];
