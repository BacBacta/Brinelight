/**
 * The sheet of a raft slot, as in the prototype: a free slot shows what a new raft costs and takes, and why it
 * cannot be started; the slot the shipyard works on shows the time left; a free raft lists the three buildings it
 * can carry; a raft with a building shows its effect and its next level. Every raft shows its sturdiness.
 */
import {
  GREENHOUSE_FISH_PER_HOUR,
  RAFT_BUILDINGS,
  RAFT_BUILDING_MAX_COPIES,
  RAFT_BUILDING_MAX_LEVEL,
  RAFT_BUILD_TIME,
  RAFT_DAMAGED_BELOW,
  RAFT_INSTALL_TIME,
  RAFT_LEVEL_POWER,
  RAFT_MAX_HP,
  RAFT_SLOTS,
  SMOKEHOUSE_SAVES,
  WATCHTOWER_ATTACK,
  canAddRaft,
  canInstall,
  canUpgradeRaft,
  raftBuildingCopies,
  raftBuildingCost,
  raftCap,
  raftCost,
  raftUpgradeTime,
  type Cost,
  type Raft,
  type RaftBuildingId,
} from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { RAFT_BUILDING_IDS } from "../scene/index.js";
import { resourceIcon } from "../ui/icons.js";
import { RESOURCE_NAMES, costEntries, formatAmount, formatDuration, formatTimeLeft } from "./format.js";
import { progress } from "./suggest.js";

export const RAFT_TEXT = {
  free: "The Lighthouse's light reaches this far. You can moor a raft here and grow your city.",
  working: "Work in progress.",
  raft: `A free raft. Put a building on it. Each type is limited to ${RAFT_BUILDING_MAX_COPIES} rafts.`,
  build: "Build the raft",
  rope: "You find rope in wrecks and on pirates.",
  max: "Max level.",
} as const;

const tenth = (n: number): string => String(Number(n.toFixed(1)));
/** What a raft building does at `level` levels, in the player's units: "+4.5 fish/h", "−10% fish eaten", "+5% fleet attack". */
export function raftEffectText(id: RaftBuildingId, level: number): string {
  if (id === "greenhouse") return `+${tenth(GREENHOUSE_FISH_PER_HOUR * level)} fish/h`;
  if (id === "smokehouse") return `−${tenth(SMOKEHOUSE_SAVES * 100 * level)}% fish eaten`;
  return `+${tenth(WATCHTOWER_ATTACK * 100 * level)}% fleet attack`;
}

/** The raft's sturdiness, as on every raft's sheet. */
const sturdiness = (raft: Raft): string => {
  const bad = raft.hp < RAFT_DAMAGED_BELOW;
  return (
    `<div class="kv"><span>Sturdiness</span><span class="${bad ? "no" : "ok"}">${Math.round((raft.hp / RAFT_MAX_HP) * 100)}%${bad ? " · half efficiency" : ""}</span></div>` +
    `<div class="pb"><i style="width:${((raft.hp / RAFT_MAX_HP) * 100).toFixed(0)}%"></i></div>`
  );
};

/** A cost with its icons; a resource you lack is marked. */
const costHtml = (state: PlayerState, cost: Cost): string =>
  costEntries(cost)
    .map(([r, v]) => `<span class="${state.stock[r] < v ? "no" : ""}" title="${RESOURCE_NAMES[r]}">${resourceIcon(r)}${formatAmount(v)}</span>`)
    .join("");

/** "Shipyard · Kelp Greenhouse": what the shipyard works on, as the queue names it. */
export function yardName(state: PlayerState): string | null {
  const job = state.yard;
  if (!job) return null;
  if (job.kind === "raft") return "Shipyard · raft";
  if (job.kind === "install") return `Shipyard · ${RAFT_BUILDINGS[job.building].name}`;
  const raft = state.rafts[job.slot];
  return raft?.building ? `Shipyard · ${RAFT_BUILDINGS[raft.building].name} Lv ${raft.level + 1}` : "Shipyard · upgrade";
}

/** The inside of a raft slot's sheet; null when the slot shows nothing (not lit, or nothing to start). */
export function raftSheetHtml(state: PlayerState, slot: string, speed: number): { title: string; body: string } | null {
  const s = RAFT_SLOTS.find((x) => x.key === slot);
  if (!s) return null;
  const raft = state.rafts[slot];
  const lighthouse = state.buildings.lighthouse;
  if (state.yard?.slot === slot) {
    const job = state.yard;
    const title = job.kind === "install" ? RAFT_BUILDINGS[job.building].name : job.kind === "upgrade" && raft?.building ? RAFT_BUILDINGS[raft.building].name : "Shipyard";
    return {
      title,
      body: `<p class="p">${RAFT_TEXT.working}</p><div class="pb"><i style="width:${(progress(job) * 100).toFixed(1)}%"></i></div><p class="p">Done in ${formatTimeLeft(job.left / speed)}</p>`,
    };
  }
  if (raft && raft.building) {
    const b = RAFT_BUILDINGS[raft.building];
    const head = `<p class="p">${b.name} level ${raft.level}: ${raftEffectText(raft.building, raft.level)}.</p>${sturdiness(raft)}`;
    if (raft.level >= RAFT_BUILDING_MAX_LEVEL) return { title: b.name, body: `${head}<p class="p">${RAFT_TEXT.max}</p>` };
    const check = canUpgradeRaft({ rafts: state.rafts, slot, stock: state.stock, yard: state.yard });
    return {
      title: b.name,
      body:
        head +
        `<div class="box"><h4>Upgrade to level ${raft.level + 1}</h4><div class="cost">${costHtml(state, raftBuildingCost(raft.building, raft.level))}</div>` +
        `<p class="p" style="font-size:12.5px;margin-top:6px">Time: ${formatDuration(raftUpgradeTime(raft.level) / speed)} · Power +${RAFT_LEVEL_POWER}</p></div>` +
        // Still tappable when refused: the tap shows the reason in a toast too.
        `<button class="b gold xl" data-act="upgrade-raft" aria-disabled="${!check.ok}">Upgrade</button>` +
        (check.ok ? "" : `<p class="why">${check.reason}</p>`),
    };
  }
  if (raft) {
    const rows = RAFT_BUILDING_IDS.map((id) => {
      const b = RAFT_BUILDINGS[id];
      const check = canInstall(id, { rafts: state.rafts, slot, stock: state.stock, yard: state.yard });
      const cost = costEntries(raftBuildingCost(id, 0))
        .map(([r, v]) => `${formatAmount(v)} ${RESOURCE_NAMES[r]}`)
        .join(" · ");
      return (
        `<div class="it" data-raft-building="${id}"><div class="tt"><b>${b.name}</b><small>${raftEffectText(id, 1)} per level</small>` +
        `<small>${cost} · ${formatDuration(RAFT_INSTALL_TIME / speed)} · ${raftBuildingCopies(id, state.rafts, state.yard)}/${RAFT_BUILDING_MAX_COPIES}</small></div>` +
        // Still tappable when refused: the tap shows the reason in a toast, as for an upgrade.
        `<button class="b sm" data-act="install" data-building="${id}" aria-disabled="${!check.ok}">Install</button></div>`
      );
    }).join("");
    return {
      title: "Raft",
      body: `<p class="p">${RAFT_TEXT.raft}</p>${sturdiness(raft)}<div class="list">${rows}</div>` + (state.yard ? `<p class="why">The shipyard is busy</p>` : ""),
    };
  }
  const n = Object.keys(state.rafts).length;
  const check = canAddRaft({ rafts: state.rafts, lighthouse, slot, stock: state.stock, yardBusy: state.yard !== null });
  const cost = costHtml(state, raftCost(n));
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

export function createRaftSheet(
  root: HTMLElement,
  actions: { dock(slot: string): void; install(slot: string, building: RaftBuildingId): void; upgrade(slot: string): void; close(): void },
) {
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
    if (t.dataset.act === "install" && t.dataset.building) actions.install(current, t.dataset.building as RaftBuildingId);
    if (t.dataset.act === "upgrade-raft") actions.upgrade(current);
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
