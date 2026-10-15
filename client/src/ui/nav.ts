import { ICONS } from "./icons.js";

/** The bottom menu. Only the city exists for now; the other screens come later. */
export const NAV_ITEMS = [
  { id: "city", label: "City", ready: true },
  { id: "sea", label: "Sea", ready: false },
  { id: "captains", label: "Captains", ready: false },
  { id: "alliance", label: "Alliance", ready: false },
  { id: "shop", label: "Shop", ready: false },
] as const;

export function createNav(root: HTMLElement, onSoon: () => void) {
  const nav = document.createElement("nav");
  nav.className = "nav";
  nav.innerHTML = NAV_ITEMS.map((n) => `<button data-v="${n.id}" aria-pressed="${n.id === "city"}">${ICONS[n.id]}${n.label}</button>`).join("");
  nav.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-v]");
    if (!b) return;
    const item = NAV_ITEMS.find((n) => n.id === b.dataset.v);
    if (item && !item.ready) onSoon();
  });
  root.appendChild(nav);
}
