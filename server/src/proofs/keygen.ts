/**
 * Makes a new notary key (week 9, task 3; protected). Run only by `deploy/notary-key.sh` on the server, inside the
 * server's container (Node is not installed on the machine): it reads the two lines this prints, writes the key in
 * deploy/.env and shows only the address. Printing to a terminal is refused, so the key cannot land on a screen.
 */
import { generateKeyPairSync } from "node:crypto";
import { pathToFileURL } from "node:url";
import { base58Encode } from "../auth/base58.js";

/** A new key: its public address, and the 64 bytes (seed, then public key) in base58, the form NOTARY_KEY_* holds. */
export function makeNotaryKey(): { address: string; secret: string } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const seed = Buffer.from(privateKey.export({ format: "jwk" }).d!, "base64url");
  const pub = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
  const both = Buffer.concat([seed, pub]);
  const secret = base58Encode(both);
  seed.fill(0);
  both.fill(0);
  return { address: base58Encode(pub), secret };
}

/** The two lines the script reads: `address <address>`, then `secret <key>`. */
export const keygenOutput = (k: { address: string; secret: string }): string => `address ${k.address}\nsecret ${k.secret}\n`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.stdout.isTTY) {
    process.stderr.write("Run deploy/notary-key.sh instead: it writes the key into deploy/.env and shows only its address.\n");
    process.exit(1);
  }
  process.stdout.write(keygenOutput(makeNotaryKey()));
}
