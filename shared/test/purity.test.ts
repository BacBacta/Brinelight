import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../src", import.meta.url));

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []));

/** The code without its comments: a comment may mention the clock, the code may not use it. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** No clock and no randomness in the rules (CLAUDE.md): whole words only, so a longer name is not caught. */
const FORBIDDEN = [/\bDate\b/, /\bMath\.random\b/, /\bcrypto\b/, /\bperformance\b/];

describe("shared stays pure", () => {
  it("reads at least the rules and the state", () => {
    expect(files(SRC).length).toBeGreaterThan(10);
  });

  it("no file of shared/src uses the clock or randomness", () => {
    const found = files(SRC).flatMap((f) => {
      const text = code(readFileSync(f, "utf8"));
      return FORBIDDEN.filter((re) => re.test(text)).map((re) => `${f.slice(SRC.length + 1)}: ${re.source}`);
    });
    expect(found).toEqual([]);
  });

  it("the check catches what it should, and only that", () => {
    const hits = (text: string) => FORBIDDEN.some((re) => re.test(code(text)));
    expect(hits("const t = Date.now();")).toBe(true);
    expect(hits("const r = Math.random();")).toBe(true);
    expect(hits("import { randomUUID } from 'node:crypto';")).toBe(true);
    expect(hits("const t = performance.now();")).toBe(true);
    expect(hits("const updatedAt = 1; const performanceBonus = 2; const Dates = [];")).toBe(false);
    expect(hits("// the server uses Date.now(), the rules never do")).toBe(false);
    expect(hits("/* no Math.random here */ const x = 1;")).toBe(false);
  });
});
