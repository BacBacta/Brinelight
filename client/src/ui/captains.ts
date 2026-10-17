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
  if (!owned) side = `<button class="b sm gold" data-act="unlock" data-captain="${id}" aria-disabled="${!canUnlockCaptain(id, ctx).ok}">Unlock</button>`;
  else {
    side = state.lead === id ? '<span class="chip ok">Leading</span>' : `<button class="b sm" data-act="lead" data-captain="${id}">Lead</button>`;
    if (owned.stars < CAPTAIN_MAX_STARS) side += `<button class="b sm gold" data-act="star" data-captain="${id}" aria-disabled="${!canAddStar(id, ctx).ok}" aria-label="Add a star">★</button>`;
  }
  return (
    `<div class="it captain r-${c.rarity}${owned ? "" : " locked"}" data-captain-row="${id}">` +
    `<div class="ph portrait">${portraitImg(id)}<span class="st">${stars}</span></div>` +
    `<div class="tt"><b>${c.name}</b><small>${RARITY_NAMES[c.rarity]} · ${c.skill}</small><small>${line}</small></div>${side}</div>`
  );
}

/** The inside of the Captains sheet. */
export function captainsHtml(state: PlayerState): string {
  const lead = state.lead ? CAPTAINS[state.lead] : null;
  const book = canUseLogbook({ lead: state.lead, captains: state.captains, pearls: state.pearls });
  return (
    `<div class="box"><h4>Logbook</h4><p class="p" style="font-size:12.5px">${CAPTAINS_TEXT.logbook}</p>` +
    // Still tappable when refused: the tap shows the reason in a toast too.
    `<button class="b sm violet" data-act="logbook" aria-disabled="${!book.ok}" style="margin-top:8px">Logbook for ${lead?.name ?? "your lead captain"} · ${LOGBOOK.pearls} Pearls</button>` +
    (book.ok ? "" : `<p class="why">${book.reason}</p>`) +
    `</div>` +
    `<p class="p" style="font-size:12px">${CAPTAINS_TEXT.shards}</p>` +
    `<div class="list">${CAPTAIN_IDS.map((id) => captainRow(state, id)).join("")}</div>`
  );
}

export function createCaptainsSheet(
  root: HTMLElement,
  actions: { setLead(id: CaptainId): void; logbook(): void; unlock(id: CaptainId): void; addStar(id: CaptainId): void },
) {
  const el = document.createElement("section");
  el.className = "sheet card captains";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Captains");
  root.appendChild(el);
  let key = "";

  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    const id = b.dataset.captain as CaptainId | undefined;
    if (b.dataset.act === "close") sheet.close();
    if (b.dataset.act === "logbook") actions.logbook();
    if (b.dataset.act === "lead" && id) actions.setLead(id);
    if (b.dataset.act === "unlock" && id) actions.unlock(id);
    if (b.dataset.act === "star" && id) actions.addStar(id);
  });

  const render = (state: PlayerState) => {
    const body = captainsHtml(state);
    if (body === key) return;
    key = body;
    el.innerHTML = `<div class="sh-h"><h2>Captains</h2><button class="x" data-act="close" aria-label="Close">✕</button></div><div class="sh-b">${body}</div>`;
  };

  const sheet = {
    get shown() {
      return !el.hidden;
    },
    open(state: PlayerState) {
      key = "";
      el.hidden = false;
      render(state);
    },
    close() {
      el.hidden = true;
    },
    update(state: PlayerState) {
      if (!el.hidden) render(state);
    },
  };
  return sheet;
}
