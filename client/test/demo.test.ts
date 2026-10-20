import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import { RAFT_BUILDING_MAX_COPIES, RAFT_SLOTS, parseState, survivorCap } from "@brinelight/shared";
import { DEMOS, demoAllowed, demoCity, demoWanted, memoryStore } from "../src/demo.js";
import { previewBuild, previewHost } from "../src/preview.js";

describe("?demo, the demonstration cities for measuring on a phone", () => {
  it("is ignored in production: never allowed outside development and the branch previews", () => {
    // The production build: Cloudflare Pages building main, or a build made elsewhere.
    expect(previewBuild({ CF_PAGES: "1", CF_PAGES_BRANCH: "main" })).toBe(false);
    expect(previewBuild({})).toBe(false);
    expect(previewBuild({ CF_PAGES_BRANCH: "ccr-f52af247-dcswez" })).toBe(false);
    expect(previewBuild({ CF_PAGES: "1", CF_PAGES_BRANCH: "ccr-f52af247-dcswez" })).toBe(true);
    const production = { DEV: false, VITE_BRANCH_PREVIEW: "" };
    for (const host of ["brinelight.pages.dev", "play.brinelight.xyz", "ccr-f52af247-dcswez.brinelight.pages.dev"]) {
      expect(demoAllowed(production, host), host).toBe(false);
      expect(demoWanted("?demo=phare30", demoAllowed(production, host))).toBe(null);
    }
    // A preview's build served at a production address stays without demos.
    for (const host of ["brinelight.pages.dev", "play.brinelight.xyz", "evil.com", "a.b.brinelight.pages.dev"]) expect(demoAllowed({ DEV: false, VITE_BRANCH_PREVIEW: "1" }, host), host).toBe(false);
  });

  it("is not even in the files of the production build (Cloudflare Pages building main)", async () => {
    const out = mkdtempSync(join(tmpdir(), "brinelight-prod-"));
    // As Cloudflare Pages builds it (Vitest's own NODE_ENV, "test", would make a development build).
    const saved = { CF_PAGES: process.env.CF_PAGES, CF_PAGES_BRANCH: process.env.CF_PAGES_BRANCH, NODE_ENV: process.env.NODE_ENV };
    Object.assign(process.env, { CF_PAGES: "1", CF_PAGES_BRANCH: "main", NODE_ENV: "production" });
    try {
      await build({ root: new URL("..", import.meta.url).pathname, mode: "production", logLevel: "silent", build: { outDir: out, emptyOutDir: true, copyPublicDir: false } });
      const code = readdirSync(join(out, "assets")).filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(out, "assets", f), "utf8")).join("");
      expect(code).toContain("Loading your city");
      expect(code).not.toContain("phare30");
      expect(code).not.toContain("Demo city");
    } finally {
      for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k];
      else process.env[k] = v;
      rmSync(out, { recursive: true, force: true });
    }
  }, 120_000);

  it("works in development and on a branch preview's address", () => {
    expect(previewHost("ccr-f52af247-dcswez.brinelight.pages.dev")).toBe(true);
    expect(previewHost("1278a42d.brinelight.pages.dev")).toBe(true);
    expect(demoAllowed({ DEV: false, VITE_BRANCH_PREVIEW: "1" }, "ccr-f52af247-dcswez.brinelight.pages.dev")).toBe(true);
    expect(demoAllowed({ DEV: true }, "localhost")).toBe(true);
    expect(demoWanted("?blender&demo=phare30&fps", true)).toBe("phare30");
    expect(demoWanted("?demo=phare15", true)).toBe("phare15");
    expect(demoWanted("?demo=phare99", true)).toBe(null);
    expect(demoWanted("?demo=toString", true)).toBe(null);
    expect(demoWanted("?blender", true)).toBe(null);
  });

  it("phare30: Lighthouse 30, 39 rafts, a building site, 106 survivors; a city the rules accept", () => {
    const s = demoCity("phare30", 1_800_000_000);
    expect(s.buildings.lighthouse).toBe(30);
    expect(Object.keys(s.rafts)).toHaveLength(39);
    expect(RAFT_SLOTS).toHaveLength(39);
    expect(RAFT_SLOTS.every((x) => s.rafts[x.key])).toBe(true);
    expect(s.queue).toHaveLength(1);
    expect(s.survivors).toBe(106);
    expect(s.survivors).toBeLessThanOrEqual(survivorCap(s.buildings.shelters));
    for (const b of ["greenhouse", "smokehouse", "watchtower"]) expect(Object.values(s.rafts).filter((r) => r.building === b)).toHaveLength(RAFT_BUILDING_MAX_COPIES);
    expect(parseState(JSON.parse(JSON.stringify(s)))).not.toBe(null);
  });

  it("phare15: Lighthouse 15, 15 rafts, a building site; a city the rules accept", () => {
    const s = demoCity("phare15", 1_800_000_000);
    expect(s.buildings.lighthouse).toBe(DEMOS.phare15.lighthouse);
    expect(Object.keys(s.rafts)).toHaveLength(15);
    expect(s.queue).toHaveLength(1);
    expect(s.survivors).toBeLessThanOrEqual(survivorCap(s.buildings.shelters));
    expect(parseState(JSON.parse(JSON.stringify(s)))).not.toBe(null);
  });

  it("keeps everything in memory: nothing reaches the browser's storage", () => {
    const m = memoryStore();
    expect(m.getItem("k")).toBe(null);
    m.setItem("k", "v");
    expect(m.getItem("k")).toBe("v");
    expect(memoryStore().getItem("k")).toBe(null);
  });
});
