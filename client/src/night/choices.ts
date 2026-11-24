/** What you choose during a Night (Hold the Light): a card between waves, a troop for each raft. Pure where it can be. */
import { night as N } from "@brinelight/shared";
import { esc } from "../ui/components.js";
import { ICONS, type IconName } from "../ui/icons.js";

type Troop = "boarders" | "harpooners" | "crossbowmen";

export const CHOICE_TEXT = {
  choose: "Choose a card",
  postsHint: "Tap ＋ on a raft to put troops there. They fire on their own.",
} as const;

const TROOP: Readonly<Record<Troop, { name: string; beats: string }>> = {
  crossbowmen: { name: "Crossbowmen", beats: "Strong against Raiders" },
  harpooners: { name: "Harpooners", beats: "Strong against Beasts" },
  boarders: { name: "Boarders", beats: "Strong against Wraiths" },
};
const TROOPS: readonly Troop[] = ["crossbowmen", "harpooners", "boarders"];

/** Each card's picture: one of the game's own icons, by what it acts on. */
export const CARD_ICONS: Readonly<Record<N.CardId, IconName>> = {
  wide: "lighthouse", bright: "lighthouse", focus: "lighthouse", hunter: "lighthouse", ghostlight: "lighthouse", ember: "lighthouse",
  sharp: "crossbowmen", drill: "crossbowmen", reach: "sail", arc: "sail", raft: "sail", foe: "boarders", nets: "harpooners",
  barrel: "oil", tar: "oil", tanks: "oil", patch: "hammer", seawall: "hammer", salvage: "wood",
  tide: "sea", headwind: "sea", fog: "mist", shoal: "fish", star: "pearl", quick: "captains", long: "captains",
};

/** The three cards of a pause, each a button with its picture and its key. */
export function cardsHtml(offer: readonly N.CardId[]): string {
  return (
    `<h2>${CHOICE_TEXT.choose}</h2><div class="cards">` +
    offer.map((id, i) => `<button class="night-card" data-card="${id}"><kbd>${i + 1}</kbd>${ICONS[CARD_ICONS[id]]}<b>${esc(N.CARDS[id].name)}</b><span>${esc(N.CARDS[id].text)}</span></button>`).join("") +
    `</div>`
  );
}

/** A raft's post: ＋ when empty, else its troop's icon. */
export const postButtonHtml = (troop: Troop | null): string =>
  troop ? `<span aria-label="${TROOP[troop].name} on this raft">${ICONS[troop]}</span>` : `<span aria-label="Put a troop on this raft">＋</span>`;

/** The troops to choose from for a post. */
export function troopsHtml(): string {
  return TROOPS.map((t) => `<button class="troop" data-troop="${t}">${ICONS[t]}<b>${TROOP[t].name}</b><small>${TROOP[t].beats}</small></button>`).join("");
}
