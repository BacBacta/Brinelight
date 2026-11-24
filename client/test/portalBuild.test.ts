import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PORTAL_DROPPED, PORTAL_OUT, PORTAL_TITLE, dropFolders, portalTitle } from "../src/portal/build.js";
import config from "../vite.config.js";

const resolved = (mode: string) => (config as (env: { mode: string; command: "build" }) => { base?: string; build: { outDir: string } })({ mode, command: "build" });

describe("the portal's build (vite build --mode portal)", () => {
  it("relative addresses, its own output folder; the game's own build unchanged", () => {
    expect(resolved("portal").base).toBe("./");
    expect(resolved("portal").build.outDir).toBe(PORTAL_OUT);
    expect(PORTAL_OUT).toBe("dist-portal");
    expect(resolved("production").base).toBe(undefined);
    expect(resolved("production").build.outDir).toBe("dist");
  });

  it("the page's title is the game's name on CrazyGames", () => {
    expect(PORTAL_TITLE).toBe("Brinelight: Hold the Light");
    expect(portalTitle("<head>\n  <title>Brinelight</title>\n</head>")).toBe("<head>\n  <title>Brinelight: Hold the Light</title>\n</head>");
  });

  it("drops the prototype's folder from the output, and nothing else", () => {
    const out = mkdtempSync(join(tmpdir(), "portal-"));
    for (const d of ["prototype/assets", "models", "city"]) mkdirSync(join(out, d), { recursive: true });
    writeFileSync(join(out, "prototype/assets/phare.glb"), "x");
    writeFileSync(join(out, "models/phare.glb"), "x");
    expect(PORTAL_DROPPED).toEqual(["prototype", "proto"]);
    dropFolders(out, PORTAL_DROPPED);
    expect(existsSync(join(out, "prototype"))).toBe(false);
    expect(existsSync(join(out, "models/phare.glb"))).toBe(true);
    expect(existsSync(join(out, "city"))).toBe(true);
  });

  it("never removes a folder outside the output", () => {
    const out = mkdtempSync(join(tmpdir(), "portal-"));
    expect(() => dropFolders(out, ["../elsewhere"])).toThrow();
    expect(() => dropFolders(out, ["/etc"])).toThrow();
    expect(() => dropFolders(out, [""])).toThrow();
  });
});
