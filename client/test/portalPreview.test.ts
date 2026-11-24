import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import { PORTAL_PREVIEW } from "../src/portal/build.js";

/** Builds the game as Cloudflare Pages does for this branch, into a folder of its own. */
async function cloudflareBuild(branch: string): Promise<string> {
  const out = mkdtempSync(join(tmpdir(), "brinelight-cf-"));
  // Vitest's own NODE_ENV, "test", would make a development build.
  const saved = { CF_PAGES: process.env.CF_PAGES, CF_PAGES_BRANCH: process.env.CF_PAGES_BRANCH, NODE_ENV: process.env.NODE_ENV };
  Object.assign(process.env, { CF_PAGES: "1", CF_PAGES_BRANCH: branch, NODE_ENV: "production" });
  try {
    await build({ root: new URL("..", import.meta.url).pathname, mode: "production", logLevel: "silent", build: { outDir: out, emptyOutDir: true } });
  } finally {
    for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return out;
}

describe("the portal on a branch preview, for its testers", () => {
  it("a branch's preview serves the portal at /portal/, relative and without the prototype; the game keeps its own", async () => {
    expect(PORTAL_PREVIEW).toBe("portal");
    const out = await cloudflareBuild("ccr-test-branch");
    try {
      const page = readFileSync(join(out, "portal/index.html"), "utf8");
      expect(page).toContain("<title>Brinelight: Hold the Light</title>");
      expect(page).toMatch(/src="\.\/assets\//);
      expect(existsSync(join(out, "portal/models/phare.glb"))).toBe(true);
      expect(existsSync(join(out, "portal/prototype"))).toBe(false);
      expect(existsSync(join(out, "prototype/index.html"))).toBe(true);
      expect(readFileSync(join(out, "index.html"), "utf8")).toContain("<title>Brinelight</title>");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 180_000);

  it("main's build (production) has no portal", async () => {
    const out = await cloudflareBuild("main");
    try {
      expect(existsSync(join(out, "index.html"))).toBe(true);
      expect(existsSync(join(out, "portal"))).toBe(false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 180_000);
});
