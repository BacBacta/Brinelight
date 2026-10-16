/**
 * The sheet of a raft slot, as in the prototype: a free slot shows what a new raft costs and takes, and why it
 * cannot be started; the slot the shipyard works on shows the time left; a moored raft shows its sturdiness.
 */
import { RAFT_BUILD_TIME, RAFT_DAMAGED_BELOW, RAFT_MAX_HP, RAFT_SLOTS, canAddRaft, raftCap, raftCost } from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { resourceIcon } from "../ui/icons.js";
import { RESOURCE_NAMES, costEntries, formatAmount, formatDuration, formatTimeLeft } from "./format.js";
import { progress } from "./suggest.js";

export const RAFT_TEXT = {
  free: "The Lighthouse's light reaches this far. You can moor a raft here and grow your city.",
  working: "Work in progress.",
  raft: "A free raft. Buildings on rafts are coming soon.",
  build: "Build the raft",
  rope: "You find rope in wrecks and on pirates.",
} as const;

/** The inside of a raft slot's sheet; null when the slot shows nothing (not lit, or nothing to start). */
export function raftSheetHtml(state: PlayerState, slot: string, speed: number): { title: string; body: string } | null {
  const s = RAFT_SLOTS.find((x) => x.key === slot);
  if (!s) return null;
  const raft = state.rafts[slot];
  const lighthouse = state.buildings.lighthouse;
  if (state.yard?.slot === slot) {
    const job = state.yard;
    return {
      title: "Shipyard",
      body: `<p class="p">${RAFT_TEXT.working}</p><div class="pb"><i style="width:${(progress(job) * 100).toFixed(1)}%"></i></div><p class="p">Done in ${formatTimeLeft(job.left / speed)}</p>`,
    };
  }
  if (raft) {
    const bad = raft.hp < RAFT_DAMAGED_BELOW;
    return {
      title: "Raft",
      body:
        `<div class="kv"><span>Sturdiness</span><span class="${bad ? "no" : "ok"}">${Math.round((raft.hp / RAFT_MAX_HP) * 100)}%${bad ? " · half efficiency" : ""}</span></div>` +
        `<div class="pb"><i style="width:${((raft.hp / RAFT_MAX_HP) * 100).toFixed(0)}%"></i></div><p class="p">${RAFT_TEXT.raft}</p>`,
    };
  }
  const n = Object.keys(state.rafts).length;
  const check = canAddRaft({ rafts: state.rafts, lighthouse, slot, stock: state.stock, yardBusy: state.yard !== null });
  const cost = costEntries(raftCost(n))
    .map(([r, v]) => `<span class="${state.stock[r] < v ? "no" : ""}" title="${RESOURCE_NAMES[r]}">${resourceIcon(r)}${formatAmount(v)}</span>`)
    .join("");
  return {
    title: "Raft slot",
    body:
      `<p class="p">${RAFT_TEXT.free}</p>` +
      `<div class="kv"><span>Rafts</span><span>${n} / ${raftCap(lighthouse)}</span><span>Ring</span><span>${s.ring === 3 ? "first" : "second"}</span>` +
      `<span>At next Lighthouse level</span><span>${raftCap(lighthouse + 1)} rafts</span><span>Your rope</span><span>${formatAmount(state.stock.rope)}</span></div>` +
      `<div class="box"><h4>Moor a raft</h4><div class="cost">${cost}</div><p class="p" style="font-size:12.5px;margin-top:6px">Time: ${formatDuration(RAFT_BUILD_TIME / speed)}. ${RAFT_TEXT.rope}</p></div>` +
      // Still tappable when refused: the tap shows the reason in a toast too.
      `<button class="b gold xl" data-act="dock" aria-disabled="${!check.ok}">${RAFT_TEXT.build}</button>` +
      (check.ok ? "" : `<p class="why">${check.reason}</p>`),
  };
}

export function createRaftSheet(root: HTMLElement, actions: { dock(slot: string): void; close(): void }) {
  const el = document.createElement("section");
  el.className = "sheet card raft-sheet";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  root.appendChild(el);
  let current: string | null = null;
  let key = "";

  el.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest("button");
    if (!t || !current) return;
    if (t.dataset.act === "close") actions.close();
    if (t.dataset.act === "dock") actions.dock(current);
  });

  const render = (state: PlayerState, speed: number) => {
    if (!current) return;
    const html = raftSheetHtml(state, current, speed);
    if (!html) return actions.close();
    const k = html.title + html.body;
    if (k === key) return;
    key = k;
    el.setAttribute("aria-label", html.title);
    el.dataset.slot = current;
    el.innerHTML = `<div class="sh-h"><h2>${html.title}</h2><button class="x" data-act="close" aria-label="Close">✕</button></div><div class="sh-b">${html.body}</div>`;
  };

  return {
    get current() {
      return current;
    },
    open(slot: string, state: PlayerState, speed: number) {
      current = slot;
      key = "";
      el.hidden = false;
      render(state, speed);
    },
    close() {
      current = null;
      el.hidden = true;
    },
    update(state: PlayerState, speed: number) {
      render(state, speed);
    },
  };
}
