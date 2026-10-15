import { createPublicKey, verify } from "node:crypto";

/** DER header of an Ed25519 public key (SubjectPublicKeyInfo); the 32 key bytes follow it. */
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Checks an Ed25519 signature with Node's own crypto module. Never throws. */
export function verifyEd25519(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
  if (publicKey.length !== 32 || signature.length !== 64) return false;
  try {
    const key = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, publicKey]), format: "der", type: "spki" });
    return verify(null, message, key, signature);
  } catch {
    return false;
  }
}
