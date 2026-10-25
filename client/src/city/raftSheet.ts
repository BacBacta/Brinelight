/**
 * The sheet of a raft slot, as in the prototype: a free slot shows what a new raft costs and takes, and why it
 * cannot be started; the slot the shipyard works on shows the time left; a free raft lists the four buildings it
 * can carry (the House first, as many times as there are plots); a raft with a building shows its effect and its next level. Every raft shows its sturdiness, and, while
 * some are damaged, the repair of all of them. While the shipyard works elsewhere, the sheet says so first, under its
 * title (owner, 25 October: in sight without scrolling), and not again under its buttons.
 */
import {
  GREENHOUSE_FISH_PER_HOUR,
  HOUSE_ROOM,
  RAFT_BUILDINGS,
  RAFT_DAMAGED_BELOW,
  RAFT_LEVEL_POWER,
  RAFT_MAX_HP,
  RAFT_SLOTS,
  SMOKEHOUSE_SAVES,
  WATCHTOWER_ATTACK,
  YARD_BUSY,
  canAddRaft,
  canInstall,
  canRepair,
  canUpgradeRaft,
  damagedRafts,
  installTime,
  raftBuildingCopies,
  raftBuildingCost,
  raftBuildingMaxCopies,
  raftBuildingMaxLevel,
  raftCap,
  raftBuildTime,
  raftCost,
  raftUpgradeTime,
  repairCost,
  repairTime,
  yardSlot,
  type Raft,
  type RaftBuildingId,
} from "@brinelight/shared";
import type { PlayerState } from "../state/index.js";
import { RAFT_BUILDING_IDS } from "../scene/index.js";
import { actionButton, box, button, costLine, costText, createSheetView, keyValues, kv, listRow, progressBar, why } from "../ui/components.js";
import { formatAmount, formatDuration, formatTimeLeft } from "./format.js";
import { progress } from "./suggest.js";
import { landShown, raftWords, type RaftWords } from "./words.js";

/** The rafts' words (words.ts), before the Lighthouse 5 or with the old look. */
const R = raftWords(false);
export const RAFT_TEXT = { free: R.free, working: R.working, raft: R.empty, build: R.build, rope: R.rope, max: R.max } as const;

const tenth = (n: number): string => String(Number(n.toFixed(1)));
/** What a raft building does at `level` levels, in the player's units: "+4.5 fish/h", "−10% fish eaten", "+5% fleet attack", "+4 room for survivors". */
export function raftEffectText(id: RaftBuildingId, level: number): string {
  if (id === "greenhouse") return `+${tenth(GREENHOUSE_FISH_PER_HOUR * level)} fish/h`;
  if (id === "smokehouse") return `−${tenth(SMOKEHOUSE_SAVES * 100 * level)}% fish eaten`;
  if (id === "house") return `+${HOUSE_ROOM * level} room for survivors`;
  return `+${tenth(WATCHTOWER_ATTACK * 100 * level)}% fleet attack`;
}

/** A button the rules may refuse: their reason under it, unless it is the busy shipyard, said at the top of the sheet. */
const act = (label: string, check: { ok: true } | { ok: false; reason: string }, kind: string, name: string): string =>
  !check.ok && check.reason === YARD_BUSY ? button(label, kind, name, "", true) : actionButton(label, check, kind, name);
/** The sheet's first lines: the busy shipyard, first under its title, kept with the line under it; that line alone while it is free. */
const lead = (state: PlayerState, w: RaftWords, text: string): string => (state.yard ? `<div class="lead">${why(w.yardBusy)}<p class="p">${text}</p></div>` : `<p class="p">${text}</p>`);
/** The House first in a free raft's list, then the three other buildings (owner, 25 October). */
const INSTALL_ORDER: readonly RaftBuildingId[] = ["house", ...RAFT_BUILDING_IDS.filter((id) => id !== "house")];

/** The raft's sturdiness (the land's dike), as on every raft's sheet. */
const sturdiness = (raft: Raft, w: RaftWords): string => {
  const bad = raft.hp < RAFT_DAMAGED_BELOW;
  // The line and its bar kept together: the sheet's action stays in sight at 384 × 699 (owner, 25 October).
  return `<div class="dike">${keyValues(kv(w.sturdiness, `${Math.round((raft.hp / RAFT_MAX_HP) * 100)}%${bad ? ` · ${w.weak}` : ""}`, "", bad ? "no" : "ok"))}${progressBar(raft.hp / RAFT_MAX_HP, 0)}</div>`;
};

/** "Shipyard · Kelp Greenhouse": what the shipyard works on, as the queue names it ("Dike works" on land). */
export function yardName(state: PlayerState, land = landShown(state.buildings.lighthouse)): string | null {
  const job = state.yard;
  if (!job) return null;
  const w = raftWords(land);
  if (job.kind === "raft") return `${w.yard} · ${w.yardNew}`;
  if (job.kind === "install") return `${w.yard} · ${RAFT_BUILDINGS[job.building].name}`;
  if (job.kind === "repair") return `${w.yard} · ${w.repairing(job.slots.length).toLowerCase()}`;
  const raft = state.rafts[job.slot];
  return raft?.building ? `${w.yard} · ${RAFT_BUILDINGS[raft.building].name} Lv ${raft.level + 1}` : `${w.yard} · upgrade`;
}

/**
 * Repairing every damaged raft, on the sheet of any raft: how many, what it costs (oil only) and takes, and the
 * button; nothing when every raft is sound.
 */
function repairHtml(state: PlayerState, speed: number, w: RaftWords): string {
  const damaged = damagedRafts(state.rafts);
  if (damaged.length === 0 || state.yard?.kind === "repair") return "";
  const check = canRepair({ rafts: state.rafts, stock: state.stock, yard: state.yard });
  return (
    box(
      w.repair(damaged.length),
      costLine(state.stock, repairCost(state.rafts)) +
        `<p class="p" style="font-size:12.5px;margin-top:6px">Time: ${formatDuration(repairTime(state.rafts) / speed)}. ${w.repaired}</p>`,
    ) +
    // Still tappable when refused: the tap shows the reason in a toast too.
    act(w.repairButton, check, "gold", "repair")
  );
}

/** The inside of a raft slot's sheet; null when the slot shows nothing (not lit, or nothing to start). */
export function raftSheetHtml(state: PlayerState, slot: string, speed: number, land = landShown(state.buildings.lighthouse)): { title: string; body: string } | null {
  const s = RAFT_SLOTS.find((x) => x.key === slot);
  if (!s) return null;
  const w = raftWords(land);
  const raft = state.rafts[slot];
  const lighthouse = state.buildings.lighthouse;
  const job = state.yard;
  if (job?.kind === "repair" && job.slots.includes(slot)) {
    return {
      title: raft?.building ? RAFT_BUILDINGS[raft.building].name : w.emptyTitle,
      body: `<p class="p">${w.repairing(job.slots.length)}.</p>${progressBar(progress(job))}<p class="p">Done in ${formatTimeLeft(job.left / speed)}</p>`,
    };
  }
  if (job && yardSlot(job) === slot && job.kind !== "repair") {
    const title = job.kind === "install" ? RAFT_BUILDINGS[job.building].name : job.kind === "upgrade" && raft?.building ? RAFT_BUILDINGS[raft.building].name : w.yard;
    return {
      title,
      body: `<p class="p">${w.working}</p>${progressBar(progress(job))}<p class="p">Done in ${formatTimeLeft(job.left / speed)}</p>`,
    };
  }
  if (raft && raft.building) {
    const b = RAFT_BUILDINGS[raft.building];
    const head = `${lead(state, w, `${b.name} level ${raft.level}: ${raftEffectText(raft.building, raft.level)}.`)}${sturdiness(raft, w)}${repairHtml(state, speed, w)}`;
    if (raft.level >= raftBuildingMaxLevel(raft.building)) return { title: b.name, body: `${head}<p class="p">${w.max}</p>` };
    const check = canUpgradeRaft({ rafts: state.rafts, slot, lighthouse, stock: state.stock, yard: state.yard });
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
        act("Upgrade", check, "gold xl", "upgrade-raft"),
    };
  }
  if (raft) {
    const rows = INSTALL_ORDER.map((id) => {
      const b = RAFT_BUILDINGS[id];
      const check = canInstall(id, { rafts: state.rafts, slot, stock: state.stock, yard: state.yard });
      return listRow(
        b.name,
        `<small>${raftEffectText(id, 1)} per level</small>` +
          `<small>${costText(raftBuildingCost(id, 0))} · ${formatDuration(installTime(state.buildings.lighthouse) / speed)}${id === "house" ? "" : ` · ${raftBuildingCopies(id, state.rafts, state.yard)}/${raftBuildingMaxCopies(id)}`}</small>`,
        // Still tappable when refused: the tap shows the reason in a toast, as for an upgrade.
        button("Install", "sm", "install", ` data-building="${id}"`, !check.ok),
        "",
        ` data-raft-building="${id}"`,
      );
    }).join("");
    return {
      title: w.emptyTitle,
      body: `${lead(state, w, w.empty)}${sturdiness(raft, w)}${repairHtml(state, speed, w)}<div class="list">${rows}</div>`,
    };
  }
  const n = Object.keys(state.rafts).length;
  const check = canAddRaft({ rafts: state.rafts, lighthouse, slot, stock: state.stock, yardBusy: state.yard !== null });
  return {
    title: w.slotTitle,
    body:
      lead(state, w, w.free) +
      keyValues(
        kv(w.count, `${n} / ${raftCap(lighthouse)}`) +
          kv("Ring", s.ring === 3 ? "first" : "second") +
          kv("At next Lighthouse level", w.many(raftCap(lighthouse + 1))) +
          kv("Your rope", formatAmount(state.stock.rope)),
      ) +
      box(w.moor, costLine(state.stock, raftCost(n)) + `<p class="p" style="font-size:12.5px;margin-top:6px">Time: ${formatDuration(raftBuildTime(state.rafts, lighthouse) / speed)}. ${w.rope}</p>`) +
      // Still tappable when refused: the tap shows the reason in a toast too.
      act(w.build, check, "gold xl", "dock"),
  };
}

export function createRaftSheet(
  root: HTMLElement,
  actions: { dock(slot: string): void; install(slot: string, building: RaftBuildingId): void; upgrade(slot: string): void; repair(): void; close(): void },
) {
  let current: string | null = null;
  const sheet = createSheetView(root, "raft-sheet", (act, data) => {
    if (!current) return;
    if (act === "close") actions.close();
    if (act === "dock") actions.dock(current);
    if (act === "install" && data.building) actions.install(current, data.building as RaftBuildingId);
    if (act === "upgrade-raft") actions.upgrade(current);
    if (act === "repair") actions.repair();
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
