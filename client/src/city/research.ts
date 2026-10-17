/**
 * The research part of the Observatory sheet, as in the prototype: one research at a time, by branch,
 * with its level, effect, cost and time, or the Observatory level it needs. Pure: tested without a browser.
 */
import { TECHS, canResearch, observatoryRequired, techCost, techLevel, techTime, type TechId } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { box, button, chip, costText, listRow } from "../ui/components.js";
import { formatDuration, formatTimeLeft } from "./format.js";

export const RESEARCH_TEXT = {
  intro: "One research at a time. The Observatory's level caps each research level.",
} as const;

const BRANCHES = ["Economy", "Sea", "War"] as const;

export function researchHtml(state: PlayerState, speed: number): string {
  const job = state.research;
  let html = box(
    "Research",
    `<p class="p" style="font-size:12px">${RESEARCH_TEXT.intro}</p>` +
      (job ? `<p class="p in-progress">In progress: ${TECHS[job.id].name} · ${formatTimeLeft(job.left / speed)}</p>` : ""),
  );
  for (const branch of BRANCHES) {
    const ids = (Object.keys(TECHS) as TechId[]).filter((id) => TECHS[id].branch === branch);
    html += `<h4 class="brh">${branch}</h4><div class="list">${ids.map((id) => techRow(state, id, speed)).join("")}</div>`;
  }
  return html;
}

function techRow(state: PlayerState, id: TechId, speed: number): string {
  const t = TECHS[id];
  const level = techLevel(state.techs, id);
  const max = level >= t.max;
  const need = observatoryRequired(id, level);
  const check = canResearch(id, { techs: state.techs, observatory: state.buildings.observatory, busy: state.research !== null, stock: state.stock });
  const cost = costText(techCost(id, level));
  const detail = max ? "" : state.buildings.observatory < need ? `<small>Requires Observatory Lv ${need}</small>` : `<small>${cost} · ${formatDuration(techTime(id, level) / speed)}</small>`;
  const side = max
    ? chip("Max", "ok")
    : state.research?.id === id
      ? chip("In progress")
      : // Still tappable when refused: the tap shows the reason in a toast, as for an upgrade.
        button("Research", "sm", "research", ` data-tech="${id}"`, !check.ok);
  return listRow(`${t.name} <span class="dots">${"●".repeat(level)}${"○".repeat(t.max - level)}</span>`, `<small>${t.effect}</small>${detail}`, side, "tech", ` data-tech-row="${id}"`);
}
