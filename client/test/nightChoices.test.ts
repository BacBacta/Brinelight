import { describe, expect, it } from "vitest";
import { night as N } from "@brinelight/shared";
import { CHOICE_TEXT, cardsHtml, postButtonHtml, troopsHtml } from "../src/night/choices.js";
import { hudParts } from "../src/night/hud.js";

describe("choosing a card", () => {
  it("three cards, each with its name and what it does, and its key", () => {
    const html = cardsHtml(["wide", "tar", "tide"]);
    expect(html).toContain(CHOICE_TEXT.choose);
    for (const id of ["wide", "tar", "tide"] as const) {
      expect(html).toContain(N.CARDS[id].name);
      expect(html).toContain(N.CARDS[id].text);
      expect(html).toContain(`data-card="${id}"`);
    }
    expect(html).toContain("<kbd>1</kbd>");
    expect(html).toContain("<kbd>3</kbd>");
  });
});

describe("a post on a raft", () => {
  it("empty: a ＋ that says what it is for; held: its troop", () => {
    expect(postButtonHtml(null)).toContain("＋");
    expect(postButtonHtml(null)).toContain('aria-label="Put a troop on this raft"');
    expect(postButtonHtml("harpooners")).toContain('aria-label="Harpooners on this raft"');
  });

  it("the three troops, each saying whom it beats", () => {
    const html = troopsHtml();
    expect(html).toContain("Crossbowmen");
    expect(html).toContain("Strong against Raiders");
    expect(html).toContain("Strong against Beasts");
    expect(html).toContain("Strong against Wraiths");
    expect(html).toContain('data-troop="boarders"');
  });
});

describe("what to do, in the panel", () => {
  it("a Night with empty rafts says to put troops on them, once the beam is learnt", () => {
    const n = N.newNight(1, 2);
    expect(hudParts(n).hint).toBe(CHOICE_TEXT.postsHint);
    expect(hudParts({ ...n, posts: ["boarders", null] }).hint).toBe("");
    expect(hudParts(N.newNight(1, 1)).hint).not.toBe(CHOICE_TEXT.postsHint);
  });
});

describe("each card's picture", async () => {
  const { CARD_ICONS } = await import("../src/night/choices.js");
  const { ICON_NAMES } = await import("../src/ui/icons.js");
  it("every card has one of the game's icons, drawn on it", () => {
    for (const id of N.CARD_IDS) expect(ICON_NAMES, id).toContain(CARD_ICONS[id]);
    expect(cardsHtml(["wide", "shoal", "star"])).toMatch(/<img class="icon"/);
  });
});
