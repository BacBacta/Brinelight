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
  type Raft,
  type RaftBuildingId,
} from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { RAFT_BUILDING_IDS } from "../scene/index.js";
import { actionButton, box, button, costLine, costText, createSheetView, keyValues, kv, listRow, progressBar, why } from "../ui/components.js";
import { formatAmount, formatDuration, formatTimeLeft } from "./format.js";
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
    keyValues(kv("Sturdiness", `${Math.round((raft.hp / RAFT_MAX_HP) * 100)}%${bad ? " · half efficiency" : ""}`, "", bad ? "no" : "ok")) +
    progressBar(raft.hp / RAFT_MAX_HP, 0)
  );
};

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
      body: `<p class="p">${RAFT_TEXT.working}</p>${progressBar(progress(job))}<p class="p">Done in ${formatTimeLeft(job.left / speed)}</p>`,
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
        box(
          `Upgrade to level ${raft.level + 1}`,
          costLine(state.stock, raftBuildingCost(raft.building, raft.level)) +
            `<p class="p" style="font-size:12.5px;margin-top:6px">Time: ${formatDuration(raftUpgradeTime(raft.level) / speed)} · Power +${RAFT_LEVEL_POWER}</p>`,
        ) +
        // Still tappable when refused: the tap shows the reason in a toast too.
        actionButton("Upgrade", check, "gold xl", "upgrade-raft"),
    };
  }
  if (raft) {
    const rows = RAFT_BUILDING_IDS.map((id) => {
      const b = RAFT_BUILDINGS[id];
      const check = canInstall(id, { rafts: state.rafts, slot, stock: state.stock, yard: state.yard });
      return listRow(
        b.name,
        `<small>${raftEffectText(id, 1)} per level</small>` +
          `<small>${costText(raftBuildingCost(id, 0))} · ${formatDuration(RAFT_INSTALL_TIME / speed)} · ${raftBuildingCopies(id, state.rafts, state.yard)}/${RAFT_BUILDING_MAX_COPIES}</small>`,
        // Still tappable when refused: the tap shows the reason in a toast, as for an upgrade.
        button("Install", "sm", "install", ` data-building="${id}"`, !check.ok),
        "",
        ` data-raft-building="${id}"`,
      );
    }).join("");
    return {
      title: "Raft",
      body: `<p class="p">${RAFT_TEXT.raft}</p>${sturdiness(raft)}<div class="list">${rows}</div>` + (state.yard ? why("The shipyard is busy") : ""),
    };
  }
  const n = Object.keys(state.rafts).length;
  const check = canAddRaft({ rafts: state.rafts, lighthouse, slot, stock: state.stock, yardBusy: state.yard !== null });
  return {
    title: "Raft slot",
    body:
      `<p class="p">${RAFT_TEXT.free}</p>` +
      keyValues(
        kv("Rafts", `${n} / ${raftCap(lighthouse)}`) +
          kv("Ring", s.ring === 3 ? "first" : "second") +
          kv("At next Lighthouse level", `${raftCap(lighthouse + 1)} rafts`) +
          kv("Your rope", formatAmount(state.stock.rope)),
      ) +
      box("Moor a raft", costLine(state.stock, raftCost(n)) + `<p class="p" style="font-size:12.5px;margin-top:6px">Time: ${formatDuration(RAFT_BUILD_TIME / speed)}. ${RAFT_TEXT.rope}</p>`) +
      // Still tappable when refused: the tap shows the reason in a toast too.
      actionButton(RAFT_TEXT.build, check, "gold xl", "dock"),
  };
}

export function createRaftSheet(
  root: HTMLElement,
  actions: { dock(slot: string): void; install(slot: string, building: RaftBuildingId): void; upgrade(slot: string): void; close(): void },
) {
  let current: string | null = null;
  const sheet = createSheetView(root, "raft-sheet", (act, data) => {
    if (!current) return;
    if (act === "close") actions.close();
    if (act === "dock") actions.dock(current);
    if (act === "install" && data.building) actions.install(current, data.building as RaftBuildingId);
    if (act === "upgrade-raft") actions.upgrade(current);
  });

  const render = (state: PlayerState, speed: number) => {
    if (!current) return;
    const html = raftSheetHtml(state, current, speed);
    if (!html) return actions.close();
    if (sheet.drawn(html.title + html.body)) return;
    sheet.el.dataset.slot = current;
    sheet.draw(html.title, html.body);
  };

  return {
    get current() {
      return current;
    },
    open(slot: string, state: PlayerState, speed: number) {
      current = slot;
      sheet.show();
      render(state, speed);
    },
    close() {
      current = null;
      sheet.hide();
    },
    update(state: PlayerState, speed: number) {
      render(state, speed);
    },
  };
}
