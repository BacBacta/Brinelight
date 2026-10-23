/**
 * Brinelight's notary on Solana (week 9, `docs/proofs.md`): the networks it seals on and its official public
 * addresses. Pure: only names and addresses. The client shows the official address from here, and `npm run
 * proof:check` checks a seal's signer against this list, never against what a server says.
 */

/** The Solana networks the notary knows. Devnet is for trying; mainnet only after the owner's review (week 9, task 6). */
export type Cluster = "devnet" | "mainnet";

export const CLUSTERS: Record<Cluster, { genesis: string; rpc: readonly string[]; explorerQuery: string }> = {
  // The genesis hash names the network for sure: an RPC endpoint that answers another one is not used.
  devnet: { genesis: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG", rpc: ["https://api.devnet.solana.com"], explorerQuery: "?cluster=devnet" },
  mainnet: {
    genesis: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
    rpc: ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"],
    explorerQuery: "",
  },
};

export const isCluster = (v: unknown): v is Cluster => v === "devnet" || v === "mainnet";

/**
 * One official address of the notary: the network, the address, the first day it seals, the last day (null while it
 * is the current one), and, for a key that leaked, the day it leaked (what it signs from that day on is not ours).
 */
export type NotaryAddress = { cluster: Cluster; address: string; from: string; until: string | null; leaked?: string };

/** Every address the notary ever sealed with, the current ones with `until: null`. Published in `docs/proofs.md` too. */
export const NOTARIES: readonly NotaryAddress[] = [
  // Made on the server on 23 October 2026 (docs/deploy.md, step 12); its first seal is that day's.
  { cluster: "devnet", address: "Dr8DjzcGqdE2UReZHfzoN7gkSiYTiinoDw58wb9G522K", from: "2026-10-23", until: null },
];

/** The notary's current address on a network, or null when it has none yet. */
export const currentNotary = (cluster: Cluster, list: readonly NotaryAddress[] = NOTARIES): NotaryAddress | null =>
  list.find((n) => n.cluster === cluster && n.until === null) ?? null;

/** Is this address the notary's on this network for this day (`YYYY-MM-DD`)? */
export const isOfficialNotary = (cluster: Cluster, address: string, day: string, list: readonly NotaryAddress[] = NOTARIES): boolean =>
  list.some((n) => n.cluster === cluster && n.address === address && n.from <= day && (n.until === null || day <= n.until) && (n.leaked === undefined || day < n.leaked));

/** A transaction on Solana's own explorer. */
export const explorerTx = (cluster: Cluster, signature: string): string => `https://explorer.solana.com/tx/${signature}${CLUSTERS[cluster].explorerQuery}`;

/** An address on Solana's own explorer. */
export const explorerAddress = (cluster: Cluster, address: string): string => `https://explorer.solana.com/address/${address}${CLUSTERS[cluster].explorerQuery}`;
