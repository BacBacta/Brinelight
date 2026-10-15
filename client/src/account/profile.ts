/** The Profile sheet (tap the Power card) and the question asked when the account and this device both have a city. */
import type { Wallet } from "@wallet-standard/base";
import { NO_SIGN_IN, canSignIn, isPhone, phantomLink } from "./wallets.js";

export const PROFILE_TEXT = {
  local: "Playing without an account. Your city is saved on this device.",
  signIn: "Sign in with your wallet",
  noWallet: "No wallet found. Install Phantom, Solflare or Backpack, then reload the page.",
  openInPhantom: "Open in Phantom",
  saved: "Your city is saved on your account.",
  signOut: "Sign out",
  unavailable: "Accounts are not open yet. Your city is saved on this device.",
  ask: "Your account already has a city.",
  keep: "Keep the city saved on your account",
  replace: "Replace it with this city",
  lost: "Your account city will be lost.",
  confirmReplace: "Replace",
  cancel: "Cancel",
} as const;

/** "7Hc3wTfa…3tPq" → "7Hc3…3tPq". */
export const shortAddress = (a: string): string => (a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

export type ProfileView = {
  /** False when the game has no server address (VITE_API_URL). */
  available: boolean;
  wallet: string | null;
  wallets: readonly Wallet[];
  busy: boolean;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The inside of the Profile sheet, from what is known: pure, so it can be tested without a browser. */
export function profileHtml(v: ProfileView, page: { href: string; origin: string; userAgent: string }): string {
  const T = PROFILE_TEXT;
  if (!v.available) return `<p class="p">${T.unavailable}</p>`;
  if (v.wallet) {
    return (
      `<div class="box"><h4>Signed in as ${esc(shortAddress(v.wallet))}</h4><p class="p">${T.saved}</p></div>` +
      `<button class="b red" data-act="sign-out">${T.signOut}</button>`
    );
  }
  let body = `<p class="p">${T.local}</p>`;
  const able = v.wallets.filter(canSignIn);
  if (able.length) {
    // One wallet: one button. Several: a title, then one button per wallet, with its name.
    if (able.length > 1) body += `<h4 class="sub-h">${T.signIn}</h4>`;
    body += able
      .map((w) => `<button class="b gold xl wallet" data-act="sign-in" data-i="${v.wallets.indexOf(w)}" ${v.busy ? "disabled" : ""}><img src="${esc(w.icon)}" alt="">${able.length === 1 ? T.signIn : esc(w.name)}</button>`)
      .join("");
  } else if (v.wallets.length) {
    body += `<p class="why">${NO_SIGN_IN}</p>`;
  } else if (isPhone(page.userAgent)) {
    body += `<a class="b gold xl" href="${esc(phantomLink(page.href, page.origin))}">${T.openInPhantom}</a>`;
  } else {
    body += `<p class="why">${T.noWallet}</p>`;
  }
  return body;
}

export function createProfile(
  root: HTMLElement,
  actions: { view(): ProfileView; signIn(wallet: Wallet): void; signOut(): void },
) {
  const el = document.createElement("section");
  el.className = "sheet card profile";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Profile");
  root.appendChild(el);

  const render = () => {
    el.innerHTML =
      `<div class="sh-h"><h2>Profile</h2><button class="x" data-act="close" aria-label="Close">✕</button></div>` +
      `<div class="sh-b">${profileHtml(actions.view(), { href: location.href, origin: location.origin, userAgent: navigator.userAgent })}</div>`;
  };
  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    if (b.dataset.act === "close") el.hidden = true;
    if (b.dataset.act === "sign-out") actions.signOut();
    if (b.dataset.act === "sign-in") {
      const w = actions.view().wallets[Number(b.dataset.i)];
      if (w) actions.signIn(w);
    }
  });

  return {
    open() {
      render();
      el.hidden = false;
    },
    close() {
      el.hidden = true;
    },
    /** Shows the latest state if the sheet is open. */
    refresh() {
      if (!el.hidden) render();
    },
  };
}

/** Asks which city to keep. "Replace" asks for a confirmation first; closing the question keeps the account city. */
export function askWhichCity(root: HTMLElement): Promise<"keep" | "replace"> {
  const T = PROFILE_TEXT;
  const el = document.createElement("div");
  el.className = "modal";
  el.innerHTML = `<section class="card" role="alertdialog" aria-label="${T.ask}"></section>`;
  const card = el.firstElementChild as HTMLElement;
  const first = () =>
    (card.innerHTML =
      `<h2>${T.ask}</h2>` +
      `<button class="b gold xl" data-act="keep">${T.keep}</button>` +
      `<button class="b" data-act="replace">${T.replace}</button>`);
  const confirm = () =>
    (card.innerHTML =
      `<h2>${T.lost}</h2>` +
      `<button class="b red xl" data-act="confirm">${T.confirmReplace}</button>` +
      `<button class="b" data-act="cancel">${T.cancel}</button>`);
  first();
  root.appendChild(el);
  return new Promise((resolve) => {
    el.addEventListener("click", (e) => {
      const act = (e.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.act;
      if (act === "replace") return confirm();
      if (act === "cancel") return first();
      if (act === "keep" || act === "confirm") {
        el.remove();
        resolve(act === "keep" ? "keep" : "replace");
      }
    });
  });
}
