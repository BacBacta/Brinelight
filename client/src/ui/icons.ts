/**
 * The game's icons: the art direction's sheet, cut by assets/icons/make-icons.py into client/public/icons
 * (<name>-48.webp and <name>-96.webp, the second for sharp screens). Each entry is an image tag, empty alt text:
 * the icons decorate a word or a number that says the same.
 */
export const ICON_NAMES = [
  "fish", "wood", "oil", "rope", "pearl", "survivor",
  "boarders", "harpooners", "crossbowmen", "veteran", "wounded", "power",
  "lighthouse", "city", "sea", "captains", "alliance", "shop",
  "hammer", "research", "sail", "time", "mist", "morale",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

/** The address of an icon at 48 or 96 px. */
export const iconUrl = (name: IconName, size: 48 | 96): string => `${import.meta.env.BASE_URL}icons/${name}-${size}.webp`;

const img = (name: IconName): string =>
  `<img class="icon" src="${iconUrl(name, 48)}" srcset="${iconUrl(name, 48)} 1x, ${iconUrl(name, 96)} 2x" alt="" draggable="false">`;

export const ICONS = Object.fromEntries(ICON_NAMES.map((n) => [n, img(n)])) as Record<IconName, string>;

/** A resource icon, as in the prototype's pills and costs. */
export const resourceIcon = (k: "oil" | "fish" | "wood" | "rope" | "pearl"): string => `<span class="ic ${k === "rope" ? "cord" : k}">${ICONS[k]}</span>`;
