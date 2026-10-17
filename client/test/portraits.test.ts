import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CAPTAINS, type CaptainId } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { PORTRAIT_SIZES, captainPortrait } from "../src/ui/portraits.js";

const PUBLIC = fileURLToPath(new URL("../public", import.meta.url));
const IDS = Object.keys(CAPTAINS) as CaptainId[];

/** Width and height of a WebP file, read from its header (VP8, VP8L or VP8X). */
function webpSize(bytes: Buffer): { w: number; h: number } {
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8 ") return { w: bytes.readUInt16LE(26) & 0x3fff, h: bytes.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const b = bytes.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  return { w: bytes.readUIntLE(24, 3) + 1, h: bytes.readUIntLE(27, 3) + 1 };
}

describe("the captains' portraits", () => {
  it("one address per captain and size, under captains/", () => {
    expect(captainPortrait("tom", 96)).toBe("/captains/tom-96.webp");
    expect(captainPortrait("nera", 512)).toBe("/captains/nera-512.webp");
  });

  it(`the ${IDS.length * PORTRAIT_SIZES.length} files exist, as square WebP images of their size`, () => {
    expect(IDS).toHaveLength(6);
    for (const id of IDS)
      for (const size of PORTRAIT_SIZES) {
        const file = `${PUBLIC}${captainPortrait(id, size)}`;
        expect(existsSync(file), file).toBe(true);
        expect(webpSize(readFileSync(file)), file).toEqual({ w: size, h: size });
      }
  });
});
