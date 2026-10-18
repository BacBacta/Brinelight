/**
 * Reads the PNG files Chromium writes (8 bits per channel, RGB or RGBA, not interlaced) into RGBA pixels, and
 * compares two of them pixel by pixel. Only node:zlib: no dependency.
 */
import { inflateSync } from "node:zlib";

export type Pixels = { width: number; height: number; rgba: Uint8Array };

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export function decodePng(file: Uint8Array): Pixels {
  if (!SIGNATURE.every((b, i) => file[i] === b)) throw new Error("Not a PNG file");
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  let width = 0;
  let height = 0;
  let colorType = 0;
  const data: Uint8Array[] = [];
  for (let at = 8; at < file.length; ) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...file.subarray(at + 4, at + 8));
    const body = file.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      const depth = body[8];
      colorType = body[9]!;
      if (depth !== 8 || (colorType !== 2 && colorType !== 6) || body[12] !== 0) throw new Error(`Unsupported PNG (depth ${depth}, color type ${colorType}, interlace ${body[12]})`);
    } else if (type === "IDAT") data.push(body);
    else if (type === "IEND") break;
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const rows = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? rows[y * stride + x - channels]! : 0;
      const b = y > 0 ? rows[(y - 1) * stride + x]! : 0;
      const c = x >= channels && y > 0 ? rows[(y - 1) * stride + x - channels]! : 0;
      let v = line[x]!;
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`Unknown PNG filter ${filter}`);
      rows[y * stride + x] = v & 255;
    }
  }
  if (channels === 4) return { width, height, rgba: rows };
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba.set(rows.subarray(i * 3, i * 3 + 3), i * 4);
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, rgba };
}

/** How many pixels differ, and where the first one is (null when the images are the same). */
export function comparePixels(a: Pixels, b: Pixels): { size: boolean; differing: number; first: { x: number; y: number } | null } {
  if (a.width !== b.width || a.height !== b.height) return { size: false, differing: a.width * a.height, first: { x: 0, y: 0 } };
  let differing = 0;
  let first: { x: number; y: number } | null = null;
  for (let i = 0; i < a.width * a.height; i++) {
    const o = i * 4;
    if (a.rgba[o] !== b.rgba[o] || a.rgba[o + 1] !== b.rgba[o + 1] || a.rgba[o + 2] !== b.rgba[o + 2] || a.rgba[o + 3] !== b.rgba[o + 3]) {
      differing++;
      first ??= { x: i % a.width, y: Math.floor(i / a.width) };
    }
  }
  return { size: true, differing, first };
}
