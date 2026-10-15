/** At most 2 toasts at a time, as in the prototype; the oldest goes first. */
export const MAX_TOASTS = 2;
export const TOAST_MS = 3200;

export type ToastKind = "" | "gold" | "bad" | "vio";

/** The toasts kept on screen once a new one arrives. */
export const keepToasts = <T>(shown: readonly T[], next: T, max = MAX_TOASTS): T[] => [...shown, next].slice(-max);

export function createToasts(root: HTMLElement) {
  const box = document.createElement("div");
  box.className = "toasts";
  box.setAttribute("role", "status");
  box.setAttribute("aria-live", "polite");
  root.appendChild(box);
  let shown: HTMLElement[] = [];
  return {
    show(text: string, kind: ToastKind = "", icon = "i") {
      const t = document.createElement("div");
      t.className = `toast card ${kind}`;
      const ic = document.createElement("span");
      ic.className = "ic";
      ic.textContent = icon;
      const tx = document.createElement("span");
      tx.textContent = text;
      t.append(ic, tx);
      box.appendChild(t);
      const kept = keepToasts(shown, t);
      shown.filter((e) => !kept.includes(e)).forEach((e) => e.remove());
      shown = kept;
      setTimeout(() => {
        t.remove();
        shown = shown.filter((e) => e !== t);
      }, TOAST_MS);
    },
  };
}
