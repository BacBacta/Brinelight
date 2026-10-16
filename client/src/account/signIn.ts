/** Sign-in from the game: a nonce from the server, `solana:signIn` in the wallet, then the server checks it. */
import type { Wallet } from "@wallet-standard/base";
import type { Api, ApiResult } from "./api.js";
import { NO_SIGN_IN, signInFeature } from "./wallets.js";

/** `playerId` names the account: its city is kept on this device under that id. */
export type Session = { token: string; wallet: string; playerId: string; expiresAt: string };
type Nonce = { nonce: string; issuedAt: string; expiresAt: string; chainId: string; statement: string };
type Verified = { token: string; expiresAt: string; player: { id: string; wallet: string } };

export const CANCELLED = "Sign-in cancelled";

const base64 = (bytes: Uint8Array): string => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

/**
 * Signs in with a wallet. The server gives the time, network and statement to sign, so a phone clock
 * that is off does not matter. Refusals keep the server's code; "cancelled" when the player says no in the wallet.
 */
export async function signIn(api: Api, wallet: Wallet, page: { host: string; origin: string }): Promise<ApiResult<Session>> {
  const feature = signInFeature(wallet);
  if (!feature) return { ok: false, code: "no_sign_in", error: NO_SIGN_IN };
  const n = await api.call<Nonce>("POST", "/auth/nonce");
  if (!n.ok) return n;
  let out;
  try {
    [out] = await feature.signIn({
      domain: page.host,
      statement: n.data.statement,
      uri: page.origin,
      version: "1",
      chainId: n.data.chainId,
      nonce: n.data.nonce,
      issuedAt: n.data.issuedAt,
      expirationTime: n.data.expiresAt,
    });
  } catch {
    return { ok: false, code: "cancelled", error: CANCELLED };
  }
  if (!out) return { ok: false, code: "cancelled", error: CANCELLED };
  const v = await api.call<Verified>("POST", "/auth/verify", {
    body: { address: out.account.address, signedMessage: base64(out.signedMessage), signature: base64(out.signature) },
  });
  if (!v.ok) return v;
  return { ok: true, data: { token: v.data.token, wallet: v.data.player.wallet, playerId: v.data.player.id, expiresAt: v.data.expiresAt } };
}
