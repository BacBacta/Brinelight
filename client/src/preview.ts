/**
 * Is this build a branch preview? Cloudflare Pages builds every branch with CF_PAGES_BRANCH set; the production build
 * is the one of `main`. A build made elsewhere (the CI, `npm run build`) is not a preview either.
 */
export const previewBuild = (env: Record<string, string | undefined>): boolean => !!env.CF_PAGES && !!env.CF_PAGES_BRANCH && env.CF_PAGES_BRANCH !== "main";

/** The branch previews' addresses: `<branch or commit>.brinelight.pages.dev`; production is brinelight.pages.dev itself, or play.brinelight.xyz. */
export const previewHost = (hostname: string): boolean => /^[a-z0-9-]+\.brinelight\.pages\.dev$/.test(hostname);
