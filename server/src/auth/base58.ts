/**
 * Base58 (Bitcoin alphabet), as used for Solana addresses. Small and dependency-free on purpose:
 * this is sign-in code, and it is easier to review than a package. Tested with known vectors.
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));

export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  // Base-58 digits, least significant first.
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]!;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j]! * 256;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return "1".repeat(zeros) + digits.reverse().map((d) => ALPHABET[d]).join("");
}

/** Decodes base58, or returns null if the text has a character outside the alphabet. */
export function base58Decode(text: string): Uint8Array | null {
  let zeros = 0;
  while (zeros < text.length && text[zeros] === "1") zeros++;
  // Bytes, least significant first.
  const bytes: number[] = [];
  for (let i = zeros; i < text.length; i++) {
    const value = INDEX.get(text[i]!);
    if (value === undefined) return null;
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  return Uint8Array.from([...new Array<number>(zeros).fill(0), ...bytes.reverse()]);
}

/** A Solana address: base58 of exactly 32 bytes (an Ed25519 public key). Null otherwise. */
export function decodeAddress(address: string): Uint8Array | null {
  if (address.length < 32 || address.length > 44) return null;
  const bytes = base58Decode(address);
  return bytes && bytes.length === 32 ? bytes : null;
}
