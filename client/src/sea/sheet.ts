import {
  BEATS,
  canSendFleet,
  holdCapacity,
  leadOf,
  odds,
  pirateCamp,
  seaSite,
  totalTroops,
  travelTime,
} from "@brinelight/shared";
import { formatAmount, formatTimeLeft } from "../city/format.js";
import type { PlayerState, Report } from "../state/index.js";
import { attackInput } from "./odds.js";
import { siteLabel } from "./labels.js";
import { ODDS_TEXT, TROOP_NAMES, TROOP_TYPES, counterTip } from "./text.js";

const HOLD_NOTE = { tom: " (Old Tom +30%)" } as Record<string, string>;

export const REPORT_TEXT = {
  /** No Infirmary when the report is read (the prototype's words). */
  none: "no Infirmary: all losses died",
  /** An Infirmary, but no free bed. */
  full: "no free bed in the Infirmary: all losses died",
} as const;

/**
 * A combat report. With no wounded saved, it says why: no Infirmary in your city when you read it, or no free bed.
 * Pure: tested without a browser.
 */
export function reportHtml(r: Report, infirmary: boolean): string {
  const name = seaSite(r.site)?.name ?? "";
  const lost = TROOP_TYPES.reduce((a, k) => a + r.losses[k], 0);
  const hurt = TROOP_TYPES.reduce((a, k) => a + r.wounded[k], 0);
  const rows = TROOP_TYPES.map((k) => {
    const adv = r.sent[k] > 0 && r.enemy[BEATS[k]] > 0 ? ' <span class="adv">+20%</span>' : "";
    return `<tr><td>${TROOP_NAMES[k]}${adv}</td><td>${r.sent[k]}</td><td class="l">${r.losses[k] ? `−${r.losses[k]}` : "0"}</td><td>${r.enemy[k]}</td></tr>`;
  }).join("");
  return (
    `<div class="verd ${r.win ? "easy" : "hard"}">${r.win ? "Victory" : "Defeat"} · ${name} level ${r.level}</div>` +
    `<div class="vs"><i style="width:${((r.attack / (r.attack + r.defense)) * 100).toFixed(1)}%;background:#3BC6FF"></i><i style="flex:1;background:#FF7A5A"></i></div>` +
    `<div class="row" style="justify-content:space-between;font-size:12px;font-weight:900"><span style="color:#9FD8FF">Your strength ${Math.round(r.attack)}</span><span style="color:#FF9A86">Pirates ${Math.round(r.defense)}</span></div>` +
    `<table class="rep"><tr><th></th><th>Sent</th><th>Losses</th><th>Pirates</th></tr>${rows}</table>` +
    `<div class="tx">` +
    (lost ? `<div><span>Wounded in the Infirmary</span><span>${hurt ? `${hurt} of ${lost} losses, to heal` : infirmary ? REPORT_TEXT.full : REPORT_TEXT.none}</span></div>` : "") +
    (r.loot ? `<div><span>Loot</span><span>+${r.loot.oil} oil, +${r.loot.wood} wood, +${r.loot.pearls} Pearls, +${r.loot.rope} rope</span></div>` : `<div><span>Tip</span><span>${counterTip(r.enemy)}</span></div>`) +
    `</div>` +
    `<p class="p" style="font-size:11.5px">Combat is deterministic: Boarders beat Harpooners, Harpooners beat Crossbowmen, Crossbowmen beat Boarders (+20%). Your fleet brings the survivors${r.loot ? " and the loot" : ""} home.</p>`
  );
}

/** The sheet of a camp or a wreck, and the combat reports. */
export function createSeaSheet(root: HTMLElement, actions: { sail(site: string): void; closeReport(reportId: string): void }) {
  const el = document.createElement("section");
  el.className = "sheet card";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  root.appendChild(el);
  let site: string | null = null;
  let report: Report | null = null;
  let key = "";

  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    if (b.dataset.act === "close") close();
    if (b.dataset.act === "sail" && site) actions.sail(site);
  });

  const close = () => {
    const shown = report;
    site = null;
    report = null;
    el.hidden = true;
    // The report you saw is the one marked read, even if a newer one arrived meanwhile.
    if (shown) actions.closeReport(shown.id);
  };

  const frame = (title: string, body: string) =>
    `<div class="sh-h"><h2>${title}</h2><button class="x" data-act="close" aria-label="Close">✕</button></div><div class="sh-b">${body}</div>`;

  const siteHtml = (id: string, state: PlayerState, speed: number): string => {
    const s = seaSite(id)!;
    const lead = leadOf(state.lead, state.captains);
    const trip = formatTimeLeft(travelTime(s, state.techs, lead) / speed);
    const check = canSendFleet(id, state);
    const mine = state.fleets.filter((f) => f.site === id);
    const busy = mine.length ? `<div class="row"><span class="chip ok">Your fleet is ${mine[0]!.phase === "out" ? "on the way" : mine[0]!.phase === "stay" ? "there" : "coming back"}</span></div>` : "";
    const why = check.ok ? "" : `<p class="why">${check.reason}</p>`;
    if (s.kind === "camp") {
      const level = state.world.camps[id] ?? s.level ?? 1;
      const enemy = pirateCamp(level);
      const o = odds(attackInput(state, enemy));
      const top = [...TROOP_TYPES].sort((a, b) => enemy[b] - enemy[a])[0]!;
      const counter = TROOP_TYPES.find((k) => BEATS[k] === top)!;
      return (
        `<p class="p">Pirates out of the Mist. Beat them for loot.</p>` +
        busy +
        `<div class="kv"><span>Level</span><span>${level}</span>${TROOP_TYPES.map((k) => `<span>${TROOP_NAMES[k]}</span><span>${enemy[k]}</span>`).join("")}` +
        `<span>Your troops</span><span>${totalTroops(state.troops)}</span><span>Trip</span><span>${trip} one way</span></div>` +
        `<div class="verd ${o}">${ODDS_TEXT[o]}</div>` +
        `<p class="p" style="font-size:12.5px">Tip: their ${TROOP_NAMES[top].toLowerCase()} are beaten by ${TROOP_NAMES[counter].toLowerCase()}. Train them at the Barracks.</p>` +
        `<button class="b red xl" data-act="sail" aria-disabled="${!check.ok}">Attack with all your troops</button>` +
        why
      );
    }
    const hold = holdCapacity(state.buildings.harbor, state.techs, lead);
    return (
      `<p class="p">A wreck to loot. Other fleets may come to fight over it.</p>` +
      busy +
      `<div class="kv"><span>Oil</span><span>${formatAmount(state.world.wrecks[id] ?? s.amount ?? 0)}</span>` +
      `<span>Your hold</span><span>${formatAmount(hold)}${lead ? (HOLD_NOTE[lead.id] ?? "") : ""}</span><span>Trip</span><span>${trip} one way</span></div>` +
      `<button class="b gold xl" data-act="sail" aria-disabled="${!check.ok}">Send a fleet</button>` +
      why
    );
  };

  const render = (state: PlayerState, speed: number) => {
    if (report) {
      const infirmary = state.buildings.infirmary > 0;
      const k = `r|${infirmary}|${JSON.stringify(report)}`;
      if (k === key) return;
      key = k;
      el.setAttribute("aria-label", "Combat report");
      el.innerHTML = frame("Combat report", reportHtml(report, infirmary));
      return;
    }
    if (!site) return;
    const body = siteHtml(site, state, speed);
    const k = `s|${body}`;
    if (k === key) return;
    key = k;
    el.setAttribute("aria-label", siteLabel(site, state));
    el.innerHTML = frame(siteLabel(site, state), body);
  };

  return {
    get open() {
      return !el.hidden;
    },
    get showsReport() {
      return report !== null;
    },
    openSite(id: string, state: PlayerState, speed: number) {
      site = id;
      report = null;
      key = "";
      el.hidden = false;
      render(state, speed);
    },
    openReport(r: Report, state: PlayerState, speed: number) {
      site = null;
      report = r;
      key = "";
      el.hidden = false;
      render(state, speed);
    },
    update(state: PlayerState, speed: number) {
      if (!el.hidden) render(state, speed);
    },
    close,
  };
}
