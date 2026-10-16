import { describe, expect, it } from "vitest";
import { base58Decode, base58Encode, decodeAddress } from "../src/auth/base58.js";

const hex = (h: string) => Uint8Array.from(Buffer.from(h, "hex"));

// Reference vectors of the Bitcoin base58 test suite (base58_encode_decode.json), hex ↔ base58.
const VECTORS: [string, string][] = [
  ["", ""],
  ["61", "2g"],
  ["626262", "a3gV"],
  ["636363", "aPEr"],
  ["73696d706c792061206c6f6e6720737472696e67", "2cFupjhnEsSn59qHXstmK2ffpLv2"],
  ["00eb15231dfceb60925886b67d065299925915aeb172c06647", "1NS17iag9jJgTHD1VXjvLCEnZuQ3rJDE9L"],
  ["516b6fcd0f", "ABnLTmg"],
  ["bf4f89001e670274dd", "3SEo3LWLoPntC"],
  ["572e4794", "3EFU7m"],
  ["ecac89cad93923c02321", "EJDM8drfXA6uyA"],
  ["10c8511e", "Rt5zm"],
  // Leading zeros: each zero byte is one leading "1", in both directions.
  ["00", "1"],
  ["0000", "11"],
  ["00000000000000000000", "1111111111"],
  ["0001", "12"],
  ["000001", "112"],
  ["00000000ff", "11115Q"],
];

describe("base58", () => {
  it.each(VECTORS)("encodes %s as %s", (h, b58) => {
    expect(base58Encode(hex(h))).toBe(b58);
  });

  it.each(VECTORS)("decodes %s from %s", (h, b58) => {
    expect(Buffer.from(base58Decode(b58)!).toString("hex")).toBe(h);
  });

  it("the System Program address is 32 zero bytes", () => {
    expect(decodeAddress("11111111111111111111111111111111")).toEqual(new Uint8Array(32));
    expect(base58Encode(new Uint8Array(32))).toBe("11111111111111111111111111111111");
  });

  it("round-trips 32-byte keys, with and without leading zeros", () => {
    const keys = [
      Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 11) % 256),
      Uint8Array.from({ length: 32 }, (_, i) => (i < 3 ? 0 : 255 - i)),
      Uint8Array.from({ length: 32 }, () => 255),
    ];
    for (const k of keys) {
      const a = base58Encode(k);
      expect(decodeAddress(a)).toEqual(k);
    }
    expect(base58Encode(keys[1]!).startsWith("111")).toBe(true);
  });

  it("refuses characters outside the alphabet", () => {
    for (const bad of ["0", "O", "I", "l", "abc+", "abc ", "é"]) expect(base58Decode(bad)).toBeNull();
  });

  it("an address must decode to exactly 32 bytes", () => {
    expect(decodeAddress("1NS17iag9jJgTHD1VXjvLCEnZuQ3rJDE9L")).toBeNull(); // 25 bytes
    expect(decodeAddress(base58Encode(new Uint8Array(33).fill(7)))).toBeNull();
    expect(decodeAddress("")).toBeNull();
  });
});
