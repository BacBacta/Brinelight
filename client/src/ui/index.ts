import "@fontsource/lilita-one/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "@fontsource/nunito/900.css";
import type { PlayerState } from "../state/index.js";
import { createHud } from "./hud.js";
import { createNav, type NavView } from "./nav.js";
import { createToasts, type ToastKind } from "./toast.js";
import "./style.css";

export type Ui = {
  update(state: PlayerState): void;
  toast(text: string, kind?: ToastKind, icon?: string): void;
  /** Switches to a view as if its menu button was tapped. */
  showView(view: NavView): void;
};

/** The game interface over the 3D view: top bar, Mist banner, bottom menu and toasts. */
export function createUi(root: HTMLElement, onView: (view: NavView) => void): Ui {
  const hud = createHud(root);
  const toasts = createToasts(root);
  const nav = createNav(root, () => toasts.show("Coming soon", "", "~"), onView);
  return {
    showView: (view) => nav.select(view),
    update: (state) => hud.update(state),
    toast: (text, kind, icon) => toasts.show(text, kind, icon),
  };
}
