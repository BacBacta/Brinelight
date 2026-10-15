import { CAPTAINS, leadOf, raftEffect, techLevel, type CombatInput, type Troops } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";

/** What the combat rules would read if you attacked now with all your troops: used for the odds shown before you sail. */
export function attackInput(state: PlayerState, enemy: Troops): CombatInput {
  const lead = leadOf(state.lead, state.captains);
  return {
    troops: state.troops,
    enemy,
    captain: lead ? { cls: CAPTAINS[lead.id].cls, rarity: lead.rarity, level: lead.level } : null,
    techs: { blades: techLevel(state.techs, "blades"), hulls: techLevel(state.techs, "hulls"), stretchers: techLevel(state.techs, "stretchers") },
    watchtowers: raftEffect(state.rafts, "watchtower"),
  };
}
