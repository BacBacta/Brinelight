/**
 * The wallets of the browser, found with the Wallet Standard. Only the `solana:signIn` feature is used,
 * never `solana:signMessage`: with signIn, the wallet itself checks the site asking (docs/decisions.md).
 */
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";

export const SIGN_IN = "solana:signIn";
export const NO_SIGN_IN = "Your wallet cannot sign in yet. Use Phantom, Solflare or Backpack.";

/** What the game asks the wallet to sign (Sign In With Solana). */
export type SignInInput = {
  domain: string;
  statement: string;
  uri: string;
  version: "1";
  chainId: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
};
export type SignInOutput = { account: WalletAccount; signedMessage: Uint8Array; signature: Uint8Array; signatureType?: "ed25519" };
type SignInFeature = { version: string; signIn(...inputs: SignInInput[]): Promise<SignInOutput[]> };

export const isSolana = (w: Wallet): boolean => w.chains.some((c) => c.startsWith("solana:"));
export const canSignIn = (w: Wallet): boolean => SIGN_IN in w.features;
export const signInFeature = (w: Wallet): SignInFeature | null => (canSignIn(w) ? (w.features[SIGN_IN] as SignInFeature) : null);

/** Calls `onChange` with the Solana wallets now, and again each time a wallet appears or goes away. */
export function watchWallets(onChange: (wallets: readonly Wallet[]) => void): () => void {
  const api = getWallets();
  const emit = () => onChange(api.get().filter(isSolana));
  emit();
  const offA = api.on("register", emit);
  const offB = api.on("unregister", emit);
  return () => {
    offA();
    offB();
  };
}

/** On a phone without a wallet, this link opens the game inside Phantom's own browser. */
export const phantomLink = (page: string, origin: string): string =>
  `https://phantom.app/ul/browse/${encodeURIComponent(page)}?ref=${encodeURIComponent(origin)}`;

export const isPhone = (userAgent: string): boolean => /Android|iPhone|iPad|iPod/i.test(userAgent);
