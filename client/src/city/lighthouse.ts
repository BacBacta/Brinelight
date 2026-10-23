import { SEA_SITES, STOKE_MULTIPLIER, distance, gathers, lightReach, mistAt } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { box, button, keyValues, kv, listRow } from "../ui/components.js";
import { landShown, raftWords } from "./words.js";

/** The camps, wrecks, isles and shoals your fleets can reach in the Mist, with the light `reach`. */
const PLACES = SEA_SITES.filter((s) => s.kind === "camp" || gathers(s));
const inLight = (reach: number) => PLACES.filter((s) => distance(s) <= reach).length;

/**
 * The Lighthouse in the Mist, on its sheet: the order to stoke it (on until you turn it off, offline too) and how many
 * camps, wrecks, isles and shoals its light reaches in the Mist. The rules decide; the button only sends the order.
 */
export function stokeHtml(state: PlayerState, land = landShown(state.buildings.lighthouse)): string {
  const on = state.mist.stoke;
  const level = state.buildings.lighthouse;
  const note = on ? `In the Mist it burns ${STOKE_MULTIPLIER} times the oil. Your city keeps working.` : raftWords(land).mist;
  const now = mistAt(state.clock, state.server).on ? `<p class="p" style="font-size:12.5px">${state.mist.dark ? "The Mist is here and your Lighthouse is dark until it lifts." : on ? "The Mist is here. Your Lighthouse is stoked." : ""}</p>` : "";
  return box(
    "In the Mist",
    `<div class="list">${listRow("Stoke the Lighthouse", `<small>${note}</small>`, button(on ? "On" : "Off", "sm", "stoke", ` data-on="${on}"`, undefined, ` aria-pressed="${on}"`), "", ' data-stoke=""')}</div>` +
      now +
      keyValues(kv("Places in your light", `${inLight(lightReach(level, true))} of ${PLACES.length} stoked, ${inLight(lightReach(level, false))} dark`)),
  );
}
