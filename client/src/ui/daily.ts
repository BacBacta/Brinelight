import { CHESTS, DAILY_TASKS, OBJECTIVES, chestReward, dailyOn, dailyPoints, type Chest, type Reward } from "@brinelight/shared";
import { formatAmount } from "../city/format.js";
import type { PlayerState } from "../state/index.js";
import { createSheetView } from "./components.js";
import { resourceIcon } from "./icons.js";

/**
 * A reward, as the costs are shown: an icon and an amount per resource, Pearls last; then what your lead captain
 * gets, in words.
 */
export function rewardHtml(reward: Reward): string {
  const parts = (["oil", "fish", "wood", "rope", "pearls"] as const)
    .filter((k) => reward[k])
    .map((k) => `<span>${resourceIcon(k === "pearls" ? "pearl" : k)}${formatAmount(reward[k]!)}</span>`);
  if (reward.xp) parts.push(`<span>+${reward.xp} XP for your lead captain</span>`);
  if (reward.shards) parts.push(`<span>+${reward.shards} ${reward.shards === 1 ? "shard" : "shards"} of your lead captain</span>`);
  return `<div class="cost">${parts.join("")}</div>`;
}

/**
 * The current objective, above the bottom menu: its number, what to do, its reward, and "Claim" once the rules say it
 * is done. Empty once every objective is claimed. Pure: tested without a browser.
 */
export function questHtml(state: PlayerState): string {
  const o = OBJECTIVES[state.objective];
  if (!o) return "";
  const done = o.done(state);
  return (
    `<span class="qn">${state.objective + 1}/${OBJECTIVES.length}</span>` +
    `<div class="qt"><b>${o.text}</b>${rewardHtml(o.reward)}</div>` +
    (done ? `<button class="b sm gold" data-act="claimObjective">Claim</button>` : "")
  );
}

/** Today's points, and whether a chest can be opened now: for the Tasks button. */
export function dailyStatus(state: PlayerState): { points: number; chest: boolean } {
  const today = dailyOn(state.daily, state.clock, state.server);
  const points = dailyPoints(today);
  return { points, chest: CHESTS.some((c) => points >= c && !today.chests.includes(c)) };
}

/** The Daily Tasks sheet: today's points, the five chests, and the tasks. Pure: tested without a browser. */
export function dailyHtml(state: PlayerState): string {
  const today = dailyOn(state.daily, state.clock, state.server);
  const points = dailyPoints(today);
  const chests = CHESTS.map((c) => {
    const got = today.chests.includes(c);
    const can = !got && points >= c;
    // Never disabled: a chest you cannot open yet says why when tapped (the rules' refusal), and looks grey.
    const label = got ? `Chest ${c}, opened today` : can ? `Open chest ${c}` : `Chest ${c}, needs ${c} points: tap to see why it is closed`;
    return `<button class="ch${got ? " got" : can ? " can" : ""}" data-act="chest" data-chest="${c}" aria-label="${label}"><span>${got ? "✓" : "▣"}</span><small>${c}</small></button>`;
  }).join("");
  const tasks = DAILY_TASKS.map((t) => {
    const n = Math.min(t.goal, today.counts[t.id]);
    const done = n >= t.goal;
    return `<div class="it" data-task="${t.id}"><div class="ph tk${done ? " ok" : ""}">${done ? "✓" : t.points}</div><div class="tt"><b>${t.text}</b><small>${n} / ${t.goal} · ${t.points} points</small></div><span class="chip${done ? " ok" : ""}">${done ? "Done" : "In progress"}</span></div>`;
  }).join("");
  const next = CHESTS.find((c) => !today.chests.includes(c));
  return (
    `<p class="p" style="font-size:12.5px">Points come by themselves as you play. They reset every day at 00:00 UTC. Open a chest when you have its points.</p>` +
    `<div class="box"><div class="row" style="justify-content:space-between"><h4 style="margin:0">Today's points</h4><span class="chip gold">${points} / 100</span></div>` +
    `<div class="chest">${chests}</div>` +
    `<div class="pb" style="margin-top:6px"><i style="width:${Math.min(100, points)}%"></i></div>` +
    (next ? `<div class="row" style="margin-top:6px;gap:6px;font-size:12px;font-weight:800"><span>Chest ${next}:</span>${rewardHtml(chestReward(next))}</div>` : "") +
    `</div>` +
    `<div class="list">${tasks}</div>`
  );
}

/** The current objective's card, above the bottom menu. */
export function createQuest(root: HTMLElement, onClaim: () => void) {
  const el = document.createElement("div");
  el.className = "quest card";
  el.hidden = true;
  root.appendChild(el);
  el.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-act=claimObjective]")) onClaim();
  });
  let last = "";
  return {
    update(state: PlayerState) {
      const html = questHtml(state);
      if (html === last) return;
      last = html;
      el.innerHTML = html;
      el.hidden = !html;
      el.classList.toggle("done", html.includes("claimObjective"));
    },
  };
}

/** The Tasks button, on the right under the top bar: today's points, a dot when a chest can be opened. */
export function createTasksButton(root: HTMLElement, onOpen: () => void) {
  const rail = document.createElement("div");
  rail.className = "rail";
  rail.innerHTML = `<button class="card" data-v="tasks" aria-label="Daily tasks"><b>Tasks</b><small data-k="points">0</small><span class="dot" hidden></span></button>`;
  root.appendChild(rail);
  rail.querySelector("button")!.addEventListener("click", onOpen);
  const points = rail.querySelector<HTMLElement>('[data-k="points"]')!;
  const dot = rail.querySelector<HTMLElement>(".dot")!;
  return {
    update(state: PlayerState) {
      const s = dailyStatus(state);
      const text = `${s.points}/100`;
      if (points.textContent !== text) points.textContent = text;
      dot.hidden = !s.chest;
    },
  };
}

/** The Daily Tasks sheet. */
export function createDailySheet(root: HTMLElement, actions: { openChest(chest: Chest): void }) {
  const view = createSheetView(root, "daily", (act, data) => {
    if (act === "close") view.hide();
    if (act === "chest" && data.chest) actions.openChest(Number(data.chest) as Chest);
  });
  const render = (state: PlayerState) => {
    const body = dailyHtml(state);
    if (!view.drawn(body)) view.draw("Daily Tasks", body);
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
