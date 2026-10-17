/**
 * Celebrations (week 6, task 3): what ended, said on screen. Floating gold text for a work, the full screen for the
 * Lighthouse, a card with the 512 px portrait for a captain who rises a level, and one card for what ended while you
 * were away. One at a time, in a queue; a tap closes the one shown. What the player sees never decides anything: the
 * celebrations follow the city the rules made.
 */
import { BUILDINGS, CAPTAINS, RAFT_BUILDINGS, TECHS, trainingName, type GameEvent } from "@brinelight/shared";
import { esc } from "./components.js";
import { captainPortrait } from "./portraits.js";

export type CelebrationKind = "float" | "lighthouse" | "captain" | "away";
export type Celebration = { kind: CelebrationKind; title: string; lines: string[]; portrait?: string };

/** How long each kind stays on screen, in ms, unless tapped. */
export const CELEBRATION_MS: Record<CelebrationKind, number> = { float: 1200, lighthouse: 2500, captain: 2500, away: 6000 };
/** The lines of the "away" card; what is beyond is counted. */
export const AWAY_LINES = 5;

/** What an event says, in a few words. */
export function eventText(e: GameEvent): string {
  switch (e.kind) {
    case "building":
      return `${BUILDINGS[e.building].name} level ${e.level}`;
    case "research":
      return `${TECHS[e.tech].name} level ${e.level}`;
    case "raft":
      return "A new raft is moored";
    case "raftBuilding":
      return e.level === 1 ? `${RAFT_BUILDINGS[e.building].name} built` : `${RAFT_BUILDINGS[e.building].name} level ${e.level}`;
    case "troops":
      return `${trainingName({ kind: "train", troop: e.troop, count: e.count })} ready`;
    case "veterans":
      return `${trainingName({ kind: "promote", troop: e.troop, count: e.count })} ready`;
    case "healed":
      return `${e.count} wounded healed`;
    case "captain":
      return `${CAPTAINS[e.captain].name} reached level ${e.level}`;
  }
}

/** The celebration of one event. */
export function celebrationOf(e: GameEvent): Celebration {
  if (e.kind === "building" && e.building === "lighthouse") return { kind: "lighthouse", title: eventText(e), lines: ["Your light reaches farther."] };
  if (e.kind === "captain") return { kind: "captain", title: eventText(e), lines: [], portrait: captainPortrait(e.captain, 512) };
  return { kind: "float", title: eventText(e), lines: [] };
}

/**
 * The celebrations of some events. While you were away, several are told on one card; a single one is celebrated as
 * usual.
 */
export function celebrationsFor(events: readonly GameEvent[], away = false): Celebration[] {
  if (!away || events.length < 2) return events.map(celebrationOf);
  const lines = events.slice(0, AWAY_LINES).map(eventText);
  if (events.length > AWAY_LINES) lines.push(`And ${events.length - AWAY_LINES} more`);
  return [{ kind: "away", title: "While you were away", lines }];
}

/** A queue that plays one item at a time: `play` calls `done` once the item is over (only the first call counts). */
export function createPlayQueue<T>(play: (item: T, done: () => void) => void) {
  const waiting: T[] = [];
  let playing = false;
  const next = () => {
    const item = waiting.shift();
    playing = item !== undefined;
    if (item === undefined) return;
    let over = false;
    play(item, () => {
      if (over) return;
      over = true;
      next();
    });
  };
  return {
    add(items: readonly T[]) {
      waiting.push(...items);
      if (!playing) next();
    },
    get playing(): boolean {
      return playing;
    },
    get waiting(): number {
      return waiting.length;
    },
  };
}

/** The HTML of a celebration. */
export function celebrationHtml(c: Celebration): string {
  const lines = c.lines.map((l) => `<p>${l}</p>`).join("");
  if (c.kind === "float") return `<div class="cel-float">${c.title}</div>`;
  if (c.kind === "lighthouse") return `<div class="cel-full"><i class="beam"></i><h2>${c.title}</h2>${lines}</div>`;
  if (c.kind === "captain") return `<div class="cel-card card captain"><img src="${esc(c.portrait!)}" alt="" draggable="false"><h2>${c.title}</h2></div>`;
  return `<div class="cel-card card away"><h2>${c.title}</h2>${lines}</div>`;
}

/** The celebrations on screen. `onShow` hears each one as it shows (for its sound). */
export function createCelebrations(root: HTMLElement, onShow?: (c: Celebration) => void) {
  const queue = createPlayQueue<Celebration>((c, done) => {
    const el = document.createElement("div");
    el.className = `celebration ${c.kind}`;
    el.setAttribute("role", "status");
    el.innerHTML = celebrationHtml(c);
    root.appendChild(el);
    onShow?.(c);
    const end = () => {
      clearTimeout(timer);
      el.remove();
      done();
    };
    const timer = setTimeout(end, CELEBRATION_MS[c.kind]);
    el.addEventListener("click", end);
  });
  return {
    /** Celebrates these events; `away`: they ended while you were away (one card for several). */
    add(events: readonly GameEvent[], away = false) {
      queue.add(celebrationsFor(events, away));
    },
    get playing(): boolean {
      return queue.playing;
    },
  };
}
