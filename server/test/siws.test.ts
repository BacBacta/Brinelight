import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { base58Encode } from "../src/auth/base58.js";
import { verifyEd25519 } from "../src/auth/ed25519.js";
import { STATEMENT, formatSignInMessage, parseSignInMessage } from "../src/auth/siws.js";

const ADDRESS = "11111111111111111111111111111111";
const FIELDS = {
  domain: "brinelight.pages.dev",
  address: ADDRESS,
  statement: STATEMENT,
  uri: "https://brinelight.pages.dev",
  version: "1",
  chainId: "mainnet",
  nonce: "0123456789abcdef0123456789abcdef",
  issuedAt: "2026-10-15T12:00:00.000Z",
  expirationTime: "2026-10-15T12:05:00.000Z",
};
const TEXT = formatSignInMessage(FIELDS);
const lines = () => TEXT.split("\n");

describe("Sign In With Solana message", () => {
  it("reads every field of a well-formed message", () => {
    expect(parseSignInMessage(TEXT)).toEqual({
      ...FIELDS,
      issuedAt: new Date(FIELDS.issuedAt),
      expirationTime: new Date(FIELDS.expirationTime),
    });
  });

  it("refuses a line that is missing, repeated, unknown or out of order", () => {
    const l = lines();
    expect(parseSignInMessage(l.slice(0, -1).join("\n"))).toBeNull();
    expect(parseSignInMessage([...l, l[10]].join("\n"))).toBeNull();
    expect(parseSignInMessage([...l.slice(0, 10), "Request ID: 1", l[10]].join("\n"))).toBeNull();
    expect(parseSignInMessage([...l.slice(0, 9), "Not Before: 2026-10-15T12:00:00Z", l[10]].join("\n"))).toBeNull();
    const swapped = [...l];
    [swapped[6], swapped[7]] = [swapped[7]!, swapped[6]!];
    expect(parseSignInMessage(swapped.join("\n"))).toBeNull();
    expect(parseSignInMessage(TEXT + "\n")).toBeNull();
  });

  it("refuses Windows line endings, tabs and spaces around a value", () => {
    expect(parseSignInMessage(TEXT.replaceAll("\n", "\r\n"))).toBeNull();
    expect(parseSignInMessage(TEXT.replace("Version: 1", "Version:\t1"))).toBeNull();
    expect(parseSignInMessage(TEXT.replace("Version: 1", "Version: 1 "))).toBeNull();
  });

  it("refuses a bad header, address, nonce or date", () => {
    expect(parseSignInMessage(TEXT.replace("wants you to sign in", "wants you to log in"))).toBeNull();
    expect(parseSignInMessage(TEXT.replace("brinelight.pages.dev wants", "evil site wants"))).toBeNull();
    expect(parseSignInMessage(TEXT.replace(`\n${ADDRESS}\n`, "\n0OIl\n"))).toBeNull();
    expect(parseSignInMessage(TEXT.replace(`\n${ADDRESS}\n`, "\n1111\n"))).toBeNull();
    expect(parseSignInMessage(TEXT.replace(FIELDS.nonce, "short"))).toBeNull();
    expect(parseSignInMessage(TEXT.replace(FIELDS.nonce, "abc-def-ghi"))).toBeNull();
    expect(parseSignInMessage(TEXT.replace(FIELDS.issuedAt, "yesterday"))).toBeNull();
    expect(parseSignInMessage(TEXT.replace(FIELDS.expirationTime, "2026-13-45T12:00:00Z"))).toBeNull();
  });

  it("refuses an empty statement", () => {
    expect(parseSignInMessage(TEXT.replace(STATEMENT, ""))).toBeNull();
  });
});

describe("Ed25519", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const message = Buffer.from(TEXT.replace(ADDRESS, base58Encode(raw)));
  const signature = sign(null, message, privateKey);

  it("accepts a signature made with the key", () => {
    expect(verifyEd25519(raw, message, signature)).toBe(true);
  });

  it("refuses another message, another key or a broken signature, without throwing", () => {
    expect(verifyEd25519(raw, Buffer.concat([message, Buffer.from(" ")]), signature)).toBe(false);
    const other = generateKeyPairSync("ed25519").publicKey.export({ format: "der", type: "spki" }).subarray(-32);
    expect(verifyEd25519(other, message, signature)).toBe(false);
    const broken = Buffer.from(signature);
    broken[0] = broken[0]! ^ 1;
    expect(verifyEd25519(raw, message, broken)).toBe(false);
    expect(verifyEd25519(raw, message, signature.subarray(0, 63))).toBe(false);
    expect(verifyEd25519(raw.subarray(0, 31), message, signature)).toBe(false);
  });
});
