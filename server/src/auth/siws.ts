/**
 * Sign In With Solana: strict reading of the message the wallet signed.
 * The server never rebuilds this text: it reads the exact bytes the wallet returned, after checking the signature on them.
 */
import { decodeAddress } from "./base58.js";

/** The only statement the game ever asks a player to sign. */
export const STATEMENT = "Sign in to Brinelight. This does not send a transaction and costs nothing.";

export type SignInMessage = {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: string;
  nonce: string;
  issuedAt: Date;
  expirationTime: Date;
};

const HEADER = " wants you to sign in with your Solana account:";
/** The fields after the statement, each exactly once and in this order. No other line is accepted. */
const FIELDS = ["URI", "Version", "Chain ID", "Nonce", "Issued At", "Expiration Time"] as const;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const NONCE = /^[A-Za-z0-9]{8,}$/;
const DOMAIN = /^[A-Za-z0-9.-]+(:\d{1,5})?$/;

const date = (text: string): Date | null => {
  if (!ISO.test(text)) return null;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Reads a Sign In With Solana message, strictly. Lines are separated by "\n" only; every expected line
 * appears once, in order; an unknown or optional line (Not Before, Request ID, Resources) is refused.
 * Returns null when anything does not match.
 */
export function parseSignInMessage(text: string): SignInMessage | null {
  const lines = text.split("\n");
  if (lines.length !== 5 + FIELDS.length) return null;
  const [head, address, blank1, statement, blank2, ...rest] = lines as [string, string, string, string, string, ...string[]];
  if (!head.endsWith(HEADER) || blank1 !== "" || blank2 !== "") return null;
  const domain = head.slice(0, -HEADER.length);
  if (!DOMAIN.test(domain) || !decodeAddress(address) || statement === "" || /[\r\t]/.test(text)) return null;
  const values: string[] = [];
  for (let i = 0; i < FIELDS.length; i++) {
    const prefix = `${FIELDS[i]}: `;
    const line = rest[i]!;
    if (!line.startsWith(prefix)) return null;
    const value = line.slice(prefix.length);
    if (value === "" || value.trim() !== value) return null;
    values.push(value);
  }
  const [uri, version, chainId, nonce, issued, expiration] = values as [string, string, string, string, string, string];
  const issuedAt = date(issued);
  const expirationTime = date(expiration);
  if (!issuedAt || !expirationTime || !NONCE.test(nonce)) return null;
  return { domain, address, statement, uri, version, chainId, nonce, issuedAt, expirationTime };
}

/** Builds the message text; used by tests (and later by the client), never by the server to verify. */
export function formatSignInMessage(m: Omit<SignInMessage, "issuedAt" | "expirationTime"> & { issuedAt: string; expirationTime: string }): string {
  return [
    `${m.domain}${HEADER}`,
    m.address,
    "",
    m.statement,
    "",
    `URI: ${m.uri}`,
    `Version: ${m.version}`,
    `Chain ID: ${m.chainId}`,
    `Nonce: ${m.nonce}`,
    `Issued At: ${m.issuedAt}`,
    `Expiration Time: ${m.expirationTime}`,
  ].join("\n");
}
