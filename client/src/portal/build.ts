/**
 * The portal's build (`npm run build:portal`, read by client/vite.config.ts): what makes its files fit CrazyGames.
 * Node only: never imported by the game.
 */
import { rmSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

/** Its output folder, beside the game's `dist`. */
export const PORTAL_OUT = "dist-portal";
/** Where a branch preview serves the portal, inside the game's own build: `<branch>.brinelight.pages.dev/portal/`. */
export const PORTAL_PREVIEW = "portal";
/** The game's name on CrazyGames (owner, 24 November 2026). */
export const PORTAL_TITLE = "Brinelight: Hold the Light";
/** The public folders the portal does not ship: the reference prototype (4 MB; the scene loads its kit from models/). */
export const PORTAL_DROPPED: readonly string[] = ["prototype", "proto"];
/** The owner's play-test prototypes (client/public/proto/): on branch previews only, never in production. */
export const PREVIEW_ONLY: readonly string[] = ["proto"];

/** The page's title, for the portal. */
export const portalTitle = (html: string): string => html.replace(/<title>[^<]*<\/title>/, `<title>${PORTAL_TITLE}</title>`);

/** Removes these folders from the output; refuses any name that would reach outside it. */
export function dropFolders(outDir: string, names: readonly string[]): void {
  const root = resolve(outDir);
  for (const name of names) {
    const target = resolve(root, name);
    const inside = relative(root, target);
    if (!name || isAbsolute(name) || !inside || inside.startsWith("..") || isAbsolute(inside)) throw new Error(`Not a folder of the output: ${name}`);
    rmSync(target, { recursive: true, force: true });
  }
}
