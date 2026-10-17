import {
  BEATS,
  CAPTAINS,
  CAPTAIN_MAX_STARS,
  FRAGMENTS_PER_STAR,
  canSendFleet,
  holdCapacity,
  leadOf,
  odds,
  pirateCamp,
  seaSite,
  totalTroops,
  travelTime,
  type CaptainId,
} from "@brinelight/shared";
import { formatAmount, formatTimeLeft } from "../city/format.js";
import type { PlayerState, Report } from "../state/index.js";
import { attackInput } from "./odds.js";
import { siteLabel } from "./labels.js";
import { ICONS } from "../ui/icons.js";
import { portraitImg } from "../ui/captains.js";
import { actionButton, chip, createSheetView, keyValues, kv, verdict } from "../ui/components.js";
import { ODDS_TEXT, TROOP_NAMES, TROOP_TYPES, counterTip } from "./text.js";

const HOLD_NOTE = { tom: " (Old Tom +30%)" } as Record<string, string>;

export const REPORT_TEXT = {
  /** No Infirmary in your city at the time of the battle (the prototype's words). */
  none: "no Infirmary: all losses died",
  /** An Infirmary, but no free bed. */
  full: "no free bed in the Infirmary: all losses died",
  /** A report from before reports kept the Infirmary: it cannot say why. */
  unknown: "all losses died",
  /** The prototype's note under every report. */
  rules: "Combat is deterministic: Boarders beat Harpooners, Harpooners beat Crossbowmen, Crossbowmen beat Boarders (+20%). One veteran is worth 1.8 soldiers.",
} as const;

/**
 * A combat report, with the veterans sent ("+10 vet.") and lost among the losses. With no wounded saved, it says why:
 * no Infirmary in your city at the time of the battle, or no free bed. Lost veterans never become wounded.
 * Pure: tested without a browser.
 */
export function reportHtml(r: Report): string {
  const name = seaSite(r.site)?.name ?? "";
  const vetSent = (k: (typeof TROOP_TYPES)[number]) => r.veteranSent?.[k] ?? 0;
  const vetLost = (k: (typeof TROOP_TYPES)[number]) => r.veteranLosses?.[k] ?? 0;
  const lost = TROOP_TYPES.reduce((a, k) => a + r.losses[k], 0);
  const hurt = TROOP_TYPES.reduce((a, k) => a + r.wounded[k], 0);
  const why = r.infirmary === undefined ? REPORT_TEXT.unknown : r.infirmary ? REPORT_TEXT.full : REPORT_TEXT.none;
  const rows = TROOP_TYPES.map((k) => {
    const adv = r.sent[k] + vetSent(k) > 0 && r.enemy[BEATS[k]] > 0 ? ' <span class="adv">+20%</span>' : "";
    const vets = vetSent(k) ? ` <span class="adv vet">${ICONS.veteran}+${vetSent(k)} vet.</span>` : "";
    const losses = r.losses[k] + vetLost(k);
    return `<tr><td>${TROOP_NAMES[k]}${adv}</td><td>${r.sent[k]}${vets}</td><td class="l">${losses ? `−${losses}` : "0"}</td><td>${r.enemy[k]}</td></tr>`;
  }).join("");
  return (
    verdict(r.win ? "easy" : "hard", `${r.win ? "Victory" : "Defeat"} · ${name} level ${r.level}`) +
    `<div class="vs"><i style="width:${((r.attack / (r.attack + r.defense)) * 100).toFixed(1)}%;background:#3BC6FF"></i><i style="flex:1;background:#FF7A5A"></i></div>` +
    `<div class="row" style="justify-content:space-between;font-size:12px;font-weight:900"><span style="color:#9FD8FF">Your strength ${Math.round(r.attack)}</span><span style="color:#FF9A86">Pirates ${Math.round(r.defense)}</span></div>` +
    `<table class="rep"><tr><th></th><th>Sent</th><th>Losses</th><th>Pirates</th></tr>${rows}</table>` +
    `<div class="tx">` +
    (lost ? `<div><span>Wounded in the Infirmary</span><span>${hurt ? `${hurt} of ${lost} losses, to heal` : why}</span></div>` : "") +
    (r.captainXp
      ? `<div><span>Captain</span><span>${CAPTAINS[r.captainXp.id].name} · +${r.captainXp.xp} XP${r.captainXp.levels ? ` · +${r.captainXp.levels} level${r.captainXp.levels > 1 ? "s" : ""}` : ""}</span></div>`
      : "") +
    (r.shards ? `<div><span>Shards</span><span>+${r.shards.count} for ${CAPTAINS[r.shards.id].name}</span></div>` : "") +
    (r.loot ? `<div><span>Loot</span><span>+${r.loot.oil} oil, +${r.loot.wood} wood, +${r.loot.pearls} Pearls, +${r.loot.rope} rope</span></div>` : `<div><span>Tip</span><span>${counterTip(r.enemy)}</span></div>`) +
    `</div>` +
    `<p class="p" style="font-size:11.5px">${REPORT_TEXT.rules} Your fleet brings the survivors${r.loot ? " and the loot" : ""} home.</p>`
  );
}

/** What a camp's sheet says of its captain: "Shards for Sel the Navigator · 3/10", or "Sel the Navigator has max stars." */
export function shardsForText(state: Pick<PlayerState, "captains" | "shards">, id: CaptainId): string {
  const owned = state.captains[id];
  if (owned && owned.stars >= CAPTAIN_MAX_STARS) return `${CAPTAINS[id].name} has max stars.`;
  return `Shards for ${CAPTAINS[id].name} · ${state.shards[id] ?? 0}/${FRAGMENTS_PER_STAR}`;
}

/** The sheet of a camp or a wreck, and the combat reports. */
export function createSeaSheet(root: HTMLElement, actions: { sail(site: string): void; closeReport(reportId: string): void }) {
  let site: string | null = null;
  let report: Report | null = null;
  const sheet = createSheetView(root, "", (act) => {
    if (act === "close") close();
    if (act === "sail" && site) actions.sail(site);
  });

  const close = () => {
    const shown = report;
    site = null;
    report = null;
    sheet.hide();
    // The report you saw is the one marked read, even if a newer one arrived meanwhile.
    if (shown) actions.closeReport(shown.id);
  };

  const siteHtml = (id: string, state: PlayerState, speed: number): string => {
    const s = seaSite(id)!;
    const lead = leadOf(state.lead, state.captains);
    const trip = formatTimeLeft(travelTime(s, state.techs, lead) / speed);
    const check = canSendFleet(id, state);
    const mine = state.fleets.filter((f) => f.site === id);
    const busy = mine.length ? `<div class="row">${chip(`Your fleet is ${mine[0]!.phase === "out" ? "on the way" : mine[0]!.phase === "stay" ? "there" : "coming back"}`, "ok")}</div>` : "";
    if (s.kind === "camp") {
      const level = state.world.camps[id] ?? s.level ?? 1;
      const enemy = pirateCamp(level);
      const o = odds(attackInput(state, enemy));
      const top = [...TROOP_TYPES].sort((a, b) => enemy[b] - enemy[a])[0]!;
      const counter = TROOP_TYPES.find((k) => BEATS[k] === top)!;
      // The captain whose shards this camp gives: always the same one.
      const cid = s.captain!;
      return (
        `<p class="p">Pirates out of the Mist. Beat them for loot.</p>` +
        busy +
        keyValues(
          kv("Level", level) +
            TROOP_TYPES.map((k) => kv(TROOP_NAMES[k], enemy[k])).join("") +
            kv("Your troops", totalTroops(state.troops)) +
            (totalTroops(state.veterans) ? kv("Your veterans", totalTroops(state.veterans)) : "") +
            kv("Trip", `${trip} one way`),
        ) +
        `<div class="shards-for" data-shards-for="${cid}"><div class="ph portrait">${portraitImg(cid)}</div><span>${shardsForText(state, cid)}</span></div>` +
        verdict(o, ODDS_TEXT[o]) +
        `<p class="p" style="font-size:12.5px">Tip: their ${TROOP_NAMES[top].toLowerCase()} are beaten by ${TROOP_NAMES[counter].toLowerCase()}. Train them at the Barracks.</p>` +
        actionButton("Attack with all your troops", check, "red xl", "sail")
      );
    }
    const hold = holdCapacity(state.buildings.harbor, state.techs, lead);
    return (
      `<p class="p">A wreck to loot. Other fleets may come to fight over it.</p>` +
      busy +
      keyValues(kv("Oil", formatAmount(state.world.wrecks[id] ?? s.amount ?? 0)) + kv("Your hold", `${formatAmount(hold)}${lead ? (HOLD_NOTE[lead.id] ?? "") : ""}`) + kv("Trip", `${trip} one way`)) +
      actionButton("Send a fleet", check, "gold xl", "sail")
    );
  };

  const render = (state: PlayerState, speed: number) => {
    if (report) {
      if (!sheet.drawn(`r|${JSON.stringify(report)}`)) sheet.draw("Combat report", reportHtml(report));
      return;
    }
    if (!site) return;
    const body = siteHtml(site, state, speed);
    if (!sheet.drawn(`s|${body}`)) sheet.draw(siteLabel(site, state), body);
  };

  return {
    get open() {
      return sheet.shown;
    },
    get showsReport() {
      return report !== null;
    },
    openSite(id: string, state: PlayerState, speed: number) {
      site = id;
      report = null;
      sheet.show();
      render(state, speed);
    },
    openReport(r: Report, state: PlayerState, speed: number) {
      site = null;
      report = r;
      sheet.show();
      render(state, speed);
    },
    update(state: PlayerState, speed: number) {
      if (sheet.shown) render(state, speed);
    },
    close,
  };
}
