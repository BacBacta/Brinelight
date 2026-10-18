/**
 * The interface's shared pieces: buttons, the refusal under a button, progress bars, chips, boxes, costs, list rows,
 * key-value tables, verdicts and the frame of a sheet. Each one returns the HTML every sheet wrote by hand before
 * (week 6, task 2): the look does not change (e2e "the look" compares every sheet pixel by pixel).
 * Their styles are in the "Components" part of style.css, with the art direction's colors as variables.
 * Text from the rules is ours and is not escaped; text from outside the game (a wallet's name) goes through esc.
 */
import type { Cost } from "@brinelight/shared";
import { RESOURCE_NAMES, costEntries, formatAmount } from "../city/format.js";
import { resourceIcon } from "./icons.js";

/** Text from outside the game, made safe for HTML. */
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * A button of the game: `kind` the classes after "b" ("sm", "gold xl", "red xl", "sm violet", "green"…), `act` what the
 * sheet does on a tap (data-act), `data` its other data attributes as written (` data-troop="boarders"`), `tail` written
 * as it is before ">" (a style, an aria-label, " disabled"). `refused`: the rules refuse it, so it gets
 * aria-disabled="true" but stays tappable and the tap shows the reason in a toast; left out (a button the rules never
 * refuse, such as Lead), no aria-disabled at all. Never disabled by the rules.
 */
export function button(label: string, kind: string, act: string, data = "", refused?: boolean, tail = ""): string {
  return `<button class="b${kind ? ` ${kind}` : ""}" data-act="${act}"${data}${refused === undefined ? "" : ` aria-disabled="${refused}"`}${tail}>${label}</button>`;
}

/** The reason the rules give, under the button they refuse. */
export const why = (reason: string): string => `<p class="why">${reason}</p>`;

/** A button the rules may refuse, and their reason under it when they do. */
export function actionButton(label: string, check: { ok: true } | { ok: false; reason: string }, kind: string, act: string, tail = ""): string {
  return button(label, kind, act, "", !check.ok, tail) + (check.ok ? "" : why(check.reason));
}

/** A progress bar filled to `share` (0 to 1), its width written with `digits` decimals. */
export const progressBar = (share: number, digits = 1): string => `<div class="pb"><i style="width:${(share * 100).toFixed(digits)}%"></i></div>`;

/** A chip: "ok" (green), "gold", or plain. */
export const chip = (text: string, tone?: "ok" | "gold"): string => `<span class="chip${tone ? ` ${tone}` : ""}">${text}</span>`;

/** A box with its title. `cls` adds classes to the box, `titleCls` to the title. */
export function box(title: string, body: string, cls?: string, titleCls?: string): string {
  return `<div class="box${cls ? ` ${cls}` : ""}"><h4${titleCls ? ` class="${titleCls}"` : ""}>${title}</h4>${body}</div>`;
}

/** A cost with its icons, and the Pearls it asks if any (`pearls`: what it needs, what you have); what you lack is marked. */
export function costLine(stock: Readonly<Record<string, number>>, cost: Cost, pearls?: { need: number; have: number }): string {
  const parts = costEntries(cost)
    .map(([r, v]) => `<span class="${stock[r]! < v ? "no" : ""}" title="${RESOURCE_NAMES[r]}">${resourceIcon(r)}${formatAmount(v)}</span>`)
    .join("");
  const pearl = pearls && pearls.need > 0 ? `<span class="${pearls.have < pearls.need ? "no" : ""}" title="Pearls">${resourceIcon("pearl")}${formatAmount(pearls.need)}</span>` : "";
  return `<div class="cost">${parts}${pearl}</div>`;
}

/** A cost in words: "200 wood · 80 oil". */
export const costText = (cost: Cost): string =>
  costEntries(cost)
    .map(([r, v]) => `${formatAmount(v)} ${RESOURCE_NAMES[r]}`)
    .join(" · ");

/** A key and its value, for a key-value table; `keyCls` and `valueCls` give their span a class. */
export const kv = (key: string, value: string | number, keyCls?: string, valueCls?: string): string =>
  `<span${keyCls ? ` class="${keyCls}"` : ""}>${key}</span><span${valueCls ? ` class="${valueCls}"` : ""}>${value}</span>`;

/** A key-value table, from its rows (kv). */
export const keyValues = (rows: string): string => `<div class="kv">${rows}</div>`;

/**
 * A row of a list: the title, what goes under it (`sub`: <small> lines), what goes on the right (`side`: a button or a
 * chip); `cls` adds classes to the row, `attrs` its attributes (with a leading space), `ph` a picture on the left.
 */
export function listRow(title: string, sub: string, side: string, cls = "", attrs = "", ph = ""): string {
  return `<div class="it${cls ? ` ${cls}` : ""}"${attrs}>${ph}<div class="tt"><b>${title}</b>${sub}</div>${side}</div>`;
}

/** A verdict: easy, close or hard (the odds), or easy and hard (a victory, a defeat). */
export const verdict = (tone: "easy" | "close" | "hard", text: string): string => `<div class="verd ${tone}">${text}</div>`;

/**
 * A sheet: a hidden dialog card at the bottom of the screen. A tap on one of its buttons calls `onAct` with the
 * button's data-act and its data attributes. `drawn(key)` says whether the sheet already shows `key` (what it shows, in
 * short), so that it is not written again on every update; `show` makes the next one write it again.
 */
export function createSheetView(root: HTMLElement, cls: string, onAct: (act: string, data: DOMStringMap) => void) {
  const el = document.createElement("section");
  let last = "";
  el.className = `sheet card${cls ? ` ${cls}` : ""}`;
  el.hidden = true;
  el.setAttribute("role", "dialog");
  root.appendChild(el);
  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (b?.dataset.act) onAct(b.dataset.act, b.dataset);
  });
  return {
    el,
    get shown() {
      return !el.hidden;
    },
    show() {
      last = "";
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
    },
    drawn(key: string): boolean {
      if (key === last) return true;
      last = key;
      return false;
    },
    /** Writes the sheet: its title (also its name for screen readers), the close button and its body. */
    draw(title: string, body: string) {
      el.setAttribute("aria-label", title);
      el.innerHTML = `<div class="sh-h"><h2>${title}</h2><button class="x" data-act="close" aria-label="Close">✕</button></div><div class="sh-b">${body}</div>`;
    },
  };
}
