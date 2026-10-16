/**
 * A wallet for tests only: it registers in the page with the Wallet Standard, offers `solana:signIn` and nothing
 * else, and builds the Sign In With Solana message as a real wallet does, with the page's own domain.
 * The key is generated here and never enters the page: the page asks Node to sign through `__e2eSign`.
 * This file lives in e2e/ and is never part of the client build.
 */
import { generateKeyPairSync, sign } from "node:crypto";
import type { BrowserContext } from "playwright-core";
import { base58Encode } from "../server/src/auth/base58.js";

export type TestWallet = { address: string };

export async function installFakeWallet(context: BrowserContext): Promise<TestWallet> {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const address = base58Encode(raw);
  await context.exposeFunction("__e2eSign", (messageBase64: string) => sign(null, Buffer.from(messageBase64, "base64"), privateKey).toString("base64"));
  await context.addInitScript(
    ({ address, key }) => {
      const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
      const account = { address, publicKey: bytes(key), chains: ["solana:mainnet"], features: ["solana:signIn"] };
      type Input = { statement: string; uri: string; version: string; chainId: string; nonce: string; issuedAt: string; expirationTime: string };
      const wallet = {
        version: "1.0.0",
        name: "Test Wallet",
        icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiLz4=",
        chains: ["solana:mainnet"],
        accounts: [account],
        features: {
          "standard:events": { version: "1.0.0", on: () => () => {} },
          "solana:signIn": {
            version: "1.0.0",
            // The domain is the page's own, whatever the game asks: that is what a real wallet checks.
            signIn: async (input: Input) => {
              const text = [
                `${location.host} wants you to sign in with your Solana account:`,
                address,
                "",
                input.statement,
                "",
                `URI: ${input.uri}`,
                `Version: ${input.version}`,
                `Chain ID: ${input.chainId}`,
                `Nonce: ${input.nonce}`,
                `Issued At: ${input.issuedAt}`,
                `Expiration Time: ${input.expirationTime}`,
              ].join("\n");
              const message = new TextEncoder().encode(text);
              const signature = await (window as unknown as { __e2eSign(m: string): Promise<string> }).__e2eSign(b64(message));
              return [{ account, signedMessage: message, signature: bytes(signature), signatureType: "ed25519" }];
            },
          },
        },
      };
      const callback = ({ register }: { register(w: unknown): void }) => register(wallet);
      window.addEventListener("wallet-standard:app-ready", (e) => callback((e as CustomEvent).detail));
      window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: callback }));
    },
    { address, key: raw.toString("base64") },
  );
  return { address };
}
