import "@fontsource/lilita-one/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "@fontsource/nunito/900.css";
import type { PlayerState } from "../state/index.js";
import { createHud } from "./hud.js";
import type { SeaMood } from "../scene/look.js";
import { createNav, type NavSheet, type NavView } from "./nav.js";
import { createToasts, type ToastKind } from "./toast.js";
import "./style.css";

export type Ui = {
  update(state: PlayerState): void;
  /** The next change of the top bar's amounts rolls (after an action). */
  roll(): void;
  toast(text: string, kind?: ToastKind, icon?: string): void;
  /** Switches to a view as if its menu button was tapped. */
  showView(view: NavView): void;
  /** Marks the Power card while signed in. */
  signedIn(on: boolean): void;
};

/** The game interface over the 3D view: top bar, Mist banner, bottom menu and toasts. */
export function createUi(
  root: HTMLElement,
  onView: (view: NavView) => void,
  onProfile?: () => void,
  onSheet?: (sheet: NavSheet) => void,
  mood: SeaMood = "calm",
): Ui {
  const hud = createHud(root, onProfile, mood);
  const toasts = createToasts(root);
  const nav = createNav(root, () => toasts.show("Coming soon", "", "~"), onView, onSheet);
  return {
    showView: (view) => nav.select(view),
    update: (state) => hud.update(state),
    roll: () => hud.roll(),
    toast: (text, kind, icon) => toasts.show(text, kind, icon),
    signedIn: (on) => hud.signedIn(on),
  };
}
