import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ICONS, ICON_NAMES, iconUrl, resourceIcon } from "../src/ui/icons.js";

const PUBLIC = fileURLToPath(new URL("../public", import.meta.url));

/** Width, height and transparency of a WebP file, from its header. */
function webpInfo(bytes: Buffer): { w: number; h: number; alpha: boolean } {
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { w: bytes.readUIntLE(24, 3) + 1, h: bytes.readUIntLE(27, 3) + 1, alpha: (bytes[20]! & 0x10) !== 0 };
  if (chunk === "VP8L") {
    const b = bytes.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1, alpha: ((b >> 28) & 1) === 1 };
  }
  return { w: bytes.readUInt16LE(26) & 0x3fff, h: bytes.readUInt16LE(28) & 0x3fff, alpha: false };
}

describe("the icons of the art direction", () => {
  it("24 icons, in the sheet's reading order", () => {
    expect(ICON_NAMES).toHaveLength(24);
    expect(ICON_NAMES.slice(0, 6)).toEqual(["fish", "wood", "oil", "rope", "pearl", "survivor"]);
    expect(ICON_NAMES.slice(18)).toEqual(["hammer", "research", "sail", "time", "mist", "morale"]);
  });

  it("each an image with its 48 and 96 px files, and an empty alt: the word next to it says the same", () => {
    expect(ICONS.fish).toBe('<img class="icon" src="/icons/fish-48.webp" srcset="/icons/fish-48.webp 1x, /icons/fish-96.webp 2x" alt="" draggable="false">');
    expect(resourceIcon("rope")).toBe(`<span class="ic cord">${ICONS.rope}</span>`);
  });

  it("the 48 files exist: square, transparent, at their size", () => {
    for (const name of ICON_NAMES)
      for (const size of [48, 96] as const) {
        const file = `${PUBLIC}${iconUrl(name, size)}`;
        expect(existsSync(file), file).toBe(true);
        expect(webpInfo(readFileSync(file)), file).toEqual({ w: size, h: size, alpha: true });
      }
  });
});
