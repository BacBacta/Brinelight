import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NIGHT_MODELS, nightModelUrl } from "../src/night/models.js";

const PUBLIC = fileURLToPath(new URL("../public", import.meta.url));

describe("the Night's enemies, made in Blender (assets/blender/night_enemies.py)", () => {
  it("one model a family and a boss, served in client/public/night/", () => {
    expect(Object.keys(NIGHT_MODELS).sort()).toEqual(["beast", "galleon", "kraken", "leviathan", "raider", "wraith"]);
    expect(nightModelUrl("raider")).toBe(`${import.meta.env.BASE_URL}night/night-raider.glb`);
  });

  it("each small: under 60 KB and 1,000 triangles, a WebP texture and quantized geometry", () => {
    let total = 0;
    for (const family of Object.keys(NIGHT_MODELS)) {
      const file = `${PUBLIC}${nightModelUrl(family as keyof typeof NIGHT_MODELS)}`;
      const size = statSync(file).size;
      total += size;
      expect(size, family).toBeLessThan(60 * 1024);
      const bytes = readFileSync(file);
      const doc = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12))) as { extensionsRequired: string[]; accessors: { count: number }[]; meshes: { primitives: { indices: number }[] }[] };
      expect(doc.extensionsRequired.sort(), family).toEqual(["EXT_texture_webp", "KHR_mesh_quantization"]);
      expect(doc.accessors[doc.meshes[0]!.primitives[0]!.indices]!.count / 3, family).toBeLessThan(1000);
    }
    expect(total).toBeLessThan(250 * 1024);
  });
});
