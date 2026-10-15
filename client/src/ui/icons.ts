/** Small icons, copied from the prototype. */
export const ICONS = {
  oil: '<svg viewBox="0 0 24 24"><path d="M12 2C9 7 6 10 6 14a6 6 0 0 0 12 0c0-4-3-7-6-12z" fill="#FFD866"/></svg>',
  fish: '<svg viewBox="0 0 24 24"><path d="M3 12c4-6 11-6 14 0-3 6-10 6-14 0zM17 12l5-4v8z" fill="#E8F6FF"/></svg>',
  wood: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="4" fill="#F2C08A"/><circle cx="18" cy="12" r="3" fill="#C98A4E"/></svg>',
  rope: '<svg viewBox="0 0 24 24"><path d="M5 7c3-3 6 3 9 0s4-2 5 0M5 12c3-3 6 3 9 0s4-2 5 0M5 17c3-3 6 3 9 0s4-2 5 0" stroke="#FFE7B3" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
  pearl: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#fff"/><circle cx="10" cy="10" r="2" fill="#C9B8FF"/></svg>',
  survivor: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="#fff"/><path d="M5 21c1-6 13-6 14 0z" fill="#fff"/></svg>',
  lighthouse: '<svg viewBox="0 0 24 24"><path d="M9 22h6l-1-12h-4zM8 10h8l-1-3H9z" fill="#B53A1E"/><rect x="10" y="3" width="4" height="4" rx="1" fill="#FFF6C8"/><path d="M12 1l1 2h-2z" fill="#B53A1E"/></svg>',
  city: '<svg viewBox="0 0 24 24"><path d="M3 20h18M5 20v-7l4-3 4 3v7M13 20v-9l3-6 3 6v9" fill="#FFF6C8" stroke="#0C1F3A" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  sea: '<svg viewBox="0 0 24 24"><path d="M2 16c3 0 3-2 5-2s2 2 5 2 3-2 5-2 2 2 5 2M6 12l6-9 1 9z" fill="#9FE6FF" stroke="#0C1F3A" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  captains: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4" fill="#FFD866" stroke="#0C1F3A" stroke-width="1.5"/><path d="M4 21c1-5 15-5 16 0z" fill="#3BC6FF" stroke="#0C1F3A" stroke-width="1.5"/><path d="M7 7h10l-2-4H9z" fill="#B53A1E" stroke="#0C1F3A" stroke-width="1.2"/></svg>',
  alliance: '<svg viewBox="0 0 24 24"><path d="M5 3v18M5 4h12l-3 4 3 4H5" fill="#6BE07A" stroke="#0C1F3A" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  hammer: '<svg viewBox="0 0 24 24"><path d="M4 8l6-5 3 3-2 2 8 8-3 3-8-8-2 2z" fill="#FFD866" stroke="#0C1F3A" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  shop: '<svg viewBox="0 0 24 24"><path d="M4 9h16l-1 11H5zM8 9a4 4 0 0 1 8 0" fill="#FFD866" stroke="#0C1F3A" stroke-width="1.6"/></svg>',
} as const;

/** A round resource icon, as in the prototype's pills and costs. */
export const resourceIcon = (k: "oil" | "fish" | "wood" | "rope" | "pearl"): string => `<span class="ic ${k === "rope" ? "cord" : k}">${ICONS[k]}</span>`;
