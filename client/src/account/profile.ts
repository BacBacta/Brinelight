/** The Profile sheet (tap the Power card). */
import type { Wallet } from "@wallet-standard/base";
import { NO_SIGN_IN, canSignIn, isPhone, phantomLink } from "./wallets.js";
import { box, button, createSheetView, esc, listRow, why } from "../ui/components.js";

export const PROFILE_TEXT = {
  local: "Playing without an account. Your city is saved on this device.",
  signIn: "Sign in with your wallet",
  noWallet: "No wallet found. Install Phantom, Solflare or Backpack, then reload the page.",
  openInPhantom: "Open in Phantom",
  saved: "Your city is saved on your account.",
  signOut: "Sign out",
  unavailable: "Accounts are not open yet. Your city is saved on this device.",
  sounds: "Sounds",
  soundsNote: "Wood and rope, quiet. Kept on this device.",
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

/** The inside of the Profile sheet, from what is known: pure, so it can be tested without a browser. */
export function profileHtml(v: ProfileView, page: { href: string; origin: string; userAgent: string }): string {
  const T = PROFILE_TEXT;
  if (!v.available) return `<p class="p">${T.unavailable}</p>`;
  if (v.wallet) {
    return (
      box(`Signed in as ${esc(shortAddress(v.wallet))}`, `<p class="p">${T.saved}</p>`) + button(T.signOut, "red", "sign-out")
    );
  }
  let body = `<p class="p">${T.local}</p>`;
  const able = v.wallets.filter(canSignIn);
  if (able.length) {
    // One wallet: one button. Several: a title, then one button per wallet, with its name.
    if (able.length > 1) body += `<h4 class="sub-h">${T.signIn}</h4>`;
    body += able
      .map((w) =>
        // Disabled only while a sign-in is under way: not a rule's refusal.
        button(`<img src="${esc(w.icon)}" alt="">${able.length === 1 ? T.signIn : esc(w.name)}`, "gold xl wallet", "sign-in", ` data-i="${v.wallets.indexOf(w)}"`, undefined, ` ${v.busy ? "disabled" : ""}`),
      )
      .join("");
  } else if (v.wallets.length) {
    body += why(NO_SIGN_IN);
  } else if (isPhone(page.userAgent)) {
    body += `<a class="b gold xl" href="${esc(phantomLink(page.href, page.origin))}">${T.openInPhantom}</a>`;
  } else {
    body += why(T.noWallet);
  }
  return body;
}

/** The sounds' switch, under every Profile: you can turn them off with or without an account. */
export const soundsHtml = (on: boolean): string =>
  `<div class="list">${listRow(PROFILE_TEXT.sounds, `<small>${PROFILE_TEXT.soundsNote}</small>`, button(on ? "On" : "Off", "sm", "sound", "", undefined, ` aria-pressed="${on}"`), "", ' data-sounds=""')}</div>`;

export function createProfile(
  root: HTMLElement,
  actions: { view(): ProfileView; signIn(wallet: Wallet): void; signOut(): void; sound(): boolean; toggleSound(): void },
) {
  const sheet = createSheetView(root, "profile", (act, data) => {
    if (act === "close") sheet.hide();
    if (act === "sign-out") actions.signOut();
    if (act === "sound") {
      actions.toggleSound();
      render();
    }
    if (act === "sign-in") {
      const w = actions.view().wallets[Number(data.i)];
      if (w) actions.signIn(w);
    }
  });

  const render = () => {
    sheet.draw("Profile", profileHtml(actions.view(), { href: location.href, origin: location.origin, userAgent: navigator.userAgent }) + soundsHtml(actions.sound()));
  };

  return {
    open() {
      render();
      sheet.show();
    },
    close: sheet.hide,
    /** Shows the latest state if the sheet is open. */
    refresh() {
      if (sheet.shown) render();
    },
  };
}
