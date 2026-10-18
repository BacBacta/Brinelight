/**
 * The Captains sheet, as in the prototype (the Captains button of the bottom menu): the Logbook for your lead captain,
 * then the six captains with their portrait, stars, rarity, skill, level, experience and shards, and what you can do:
 * lead, unlock with shards, add a star. Refused buttons stay tappable: the tap shows the rule's reason.
 * No recruitment: the daily recruitment comes in week 15. Pure parts tested without a browser.
 */
import {
  CAPTAINS,
  CAPTAIN_MAX_LEVEL,
  CAPTAIN_MAX_STARS,
  FRAGMENTS_PER_STAR,
  LOGBOOK,
  canAddStar,
  canUnlockCaptain,
  canUseLogbook,
  xpNeeded,
  type CaptainId,
  type Rarity,
} from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { actionButton, box, button, chip, createSheetView, listRow } from "./components.js";
import { captainPortrait } from "./portraits.js";

export const CAPTAIN_IDS = Object.keys(CAPTAINS) as CaptainId[];
export const RARITY_NAMES: Record<Rarity, string> = { officer: "Officer", commander: "Commander", admiral: "Admiral" };

export const CAPTAINS_TEXT = {
  logbook: `Your lead captain gains experience in battle. Each level boosts their skill by 4%. A Logbook gives +${LOGBOOK.xp} XP for ${LOGBOOK.pearls} Pearls, earned by playing.`,
  shards: `Each pirate camp gives the shards of one captain, named on its sheet. ${FRAGMENTS_PER_STAR} shards unlock a captain or add a star.`,
} as const;

/** "Lv 3 · 40/240 XP", or "Lv 20 · Max level". */
export const captainLevelText = (c: { level: number; xp: number }): string =>
  c.level >= CAPTAIN_MAX_LEVEL ? `Lv ${c.level} · Max level` : `Lv ${c.level} · ${c.xp}/${xpNeeded(c.level)} XP`;

/** A captain's portrait for a list: 96 px, drawn in a 46 px square. */
export const portraitImg = (id: CaptainId): string => `<img src="${captainPortrait(id, 96)}" alt="" draggable="false">`;

function captainRow(state: PlayerState, id: CaptainId): string {
  const c = CAPTAINS[id];
  const owned = state.captains[id];
  const shards = state.shards[id] ?? 0;
  const ctx = { captains: state.captains, shards: state.shards };
  const stars = owned ? "★".repeat(owned.stars) : "?";
  const shardText = owned && owned.stars >= CAPTAIN_MAX_STARS ? "Max stars" : `shards ${shards}/${FRAGMENTS_PER_STAR}`;
  const line = owned ? `${captainLevelText(owned)} · ${shardText}` : `Not recruited · ${shardText}`;
  let side = "";
  if (!owned) side = button("Unlock", "sm gold", "unlock", ` data-captain="${id}"`, !canUnlockCaptain(id, ctx).ok);
  else {
    side = state.lead === id ? chip("Leading", "ok") : button("Lead", "sm", "lead", ` data-captain="${id}"`);
    if (owned.stars < CAPTAIN_MAX_STARS) side += button("★", "sm gold", "star", ` data-captain="${id}"`, !canAddStar(id, ctx).ok, ' aria-label="Add a star"');
  }
  return listRow(
    c.name,
    `<small>${RARITY_NAMES[c.rarity]} · ${c.skill}</small><small>${line}</small>`,
    side,
    `captain r-${c.rarity}${owned ? "" : " locked"}`,
    ` data-captain-row="${id}"`,
    `<div class="ph portrait">${portraitImg(id)}<span class="st">${stars}</span></div>`,
  );
}

/** The inside of the Captains sheet. */
export function captainsHtml(state: PlayerState): string {
  const lead = state.lead ? CAPTAINS[state.lead] : null;
  const book = canUseLogbook({ lead: state.lead, captains: state.captains, pearls: state.pearls });
  return (
    box(
      "Logbook",
      `<p class="p" style="font-size:12.5px">${CAPTAINS_TEXT.logbook}</p>` +
        // Still tappable when refused: the tap shows the reason in a toast too.
        actionButton(`Logbook for ${lead?.name ?? "your lead captain"} · ${LOGBOOK.pearls} Pearls`, book, "sm violet", "logbook", ' style="margin-top:8px"'),
    ) +
    `<p class="p" style="font-size:12px">${CAPTAINS_TEXT.shards}</p>` +
    `<div class="list">${CAPTAIN_IDS.map((id) => captainRow(state, id)).join("")}</div>`
  );
}

export function createCaptainsSheet(
  root: HTMLElement,
  actions: { setLead(id: CaptainId): void; logbook(): void; unlock(id: CaptainId): void; addStar(id: CaptainId): void },
) {
  const view = createSheetView(root, "captains", (act, data) => {
    const id = data.captain as CaptainId | undefined;
    if (act === "close") view.hide();
    if (act === "logbook") actions.logbook();
    if (act === "lead" && id) actions.setLead(id);
    if (act === "unlock" && id) actions.unlock(id);
    if (act === "star" && id) actions.addStar(id);
  });

  const render = (state: PlayerState) => {
    const body = captainsHtml(state);
    if (!view.drawn(body)) view.draw("Captains", body);
  };

  return {
    get shown() {
      return view.shown;
    },
    open(state: PlayerState) {
      view.show();
      render(state);
    },
    close: view.hide,
    update(state: PlayerState) {
      if (view.shown) render(state);
    },
  };
}
