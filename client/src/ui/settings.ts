/** The sounds' switch, under every Profile, and the portal edition's Settings sheet, which holds only it. */
import { button, createSheetView, listRow } from "./components.js";

export const SOUNDS_TEXT = {
  sounds: "Sounds",
  soundsNote: "Wood and rope, quiet. Kept on this device.",
} as const;

export const soundsHtml = (on: boolean): string =>
  `<div class="list">${listRow(SOUNDS_TEXT.sounds, `<small>${SOUNDS_TEXT.soundsNote}</small>`, button(on ? "On" : "Off", "sm", "sound", "", undefined, ` aria-pressed="${on}"`), "", ' data-sounds=""')}</div>`;

/** The Settings sheet's inside: the sounds, nothing of accounts (the portal has none). */
export const settingsHtml = (soundOn: boolean): string => soundsHtml(soundOn);

/** The portal's Settings sheet (tap the Power card), in place of the Profile. */
export function createSettings(root: HTMLElement, actions: { sound(): boolean; toggleSound(): void }) {
  const sheet = createSheetView(root, "profile", (act) => {
    if (act === "close") sheet.hide();
    if (act === "sound") {
      actions.toggleSound();
      render();
    }
  });
  const render = () => sheet.draw("Settings", settingsHtml(actions.sound()));
  return {
    open() {
      render();
      sheet.show();
    },
    close: sheet.hide,
    refresh() {
      if (sheet.shown) render();
    },
  };
}
