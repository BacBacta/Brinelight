/**
 * Talks to Solana's JSON-RPC (week 9, task 3; protected), on the free public endpoints of the notary's network
 * (`CLUSTERS` in shared, or SOLANA_RPC_URLS). A call that fails is tried again, spaced out, on the next endpoint. The
 * first call to an endpoint asks its genesis hash: an endpoint of another network is never used. Nothing sent here
 * holds a key: only public data and the signed transaction.
 */
import { CLUSTERS, type Cluster } from "@brinelight/shared";

export class RpcError extends Error {
  constructor(
    message: string,
    /** The JSON-RPC error code, when the node answered one. */
    readonly code?: number,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

export type Rpc = { readonly cluster: Cluster; call<T>(method: string, params?: unknown[]): Promise<T> };

export type RpcOptions = {
  /** The endpoints, tried in turn. Default: the network's public ones. */
  urls?: readonly string[];
  fetch?: typeof fetch;
  /** Tries in all, across the endpoints. */
  tries?: number;
  timeoutMs?: number;
  /** Waits between tries (tests pass one that does not wait). */
  wait?: (ms: number) => Promise<void>;
};

/** The pauses between tries: 1 s, 3 s, then 9 s. */
export const RETRY_WAITS_MS = [1000, 3000, 9000];

/** The endpoints from SOLANA_RPC_URLS (comma-separated https addresses), or the network's own. */
export function rpcUrls(cluster: Cluster, text: string | undefined): readonly string[] {
  const urls = (text ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (urls.some((u) => !/^https:\/\/[^\s/]+(\/\S*)?$/.test(u))) throw new Error("SOLANA_RPC_URLS must be https addresses, separated by commas");
  return urls.length ? urls : CLUSTERS[cluster].rpc;
}

/** What is said of an endpoint in a log line or an error: its host only (a provider's address may hold its key). */
export const endpointName = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return "an endpoint";
  }
};

export function createRpc(cluster: Cluster, options: RpcOptions = {}): Rpc {
  const urls = options.urls?.length ? options.urls : CLUSTERS[cluster].rpc;
  const doFetch = options.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const tries = options.tries ?? 4;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const wait = options.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const checked = new Set<string>();
  /** Endpoints found on another network: never used again. */
  const wrong = new Set<string>();
  let id = 0;

  /** One request to one endpoint. A JSON-RPC error is an RpcError with its code; anything else, an RpcError too. */
  async function once<T>(url: string, method: string, params: unknown[]): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new RpcError(`${endpointName(url)} did not answer ${method}`);
    }
    let body: { result?: unknown; error?: { code?: unknown; message?: unknown } };
    try {
      body = (await res.json()) as typeof body;
    } catch {
      throw new RpcError(`${endpointName(url)} answered ${method} with HTTP ${res.status} and no JSON`);
    }
    if (body.error) {
      const code = typeof body.error.code === "number" ? body.error.code : undefined;
      const message = typeof body.error.message === "string" ? body.error.message.slice(0, 300) : "an error";
      throw new RpcError(`${endpointName(url)} refused ${method}: ${message}`, code);
    }
    if (!res.ok || !("result" in body)) throw new RpcError(`${endpointName(url)} answered ${method} with HTTP ${res.status}`);
    return body.result as T;
  }

  /** The endpoint's network must be ours: checked once per endpoint, before its first real call. */
  async function sameNetwork(url: string): Promise<void> {
    if (checked.has(url)) return;
    const genesis = await once<string>(url, "getGenesisHash", []);
    if (genesis !== CLUSTERS[cluster].genesis) {
      wrong.add(url);
      throw new RpcError(`${endpointName(url)} is not on ${cluster} (its genesis hash is another)`);
    }
    checked.add(url);
  }

  return {
    cluster,
    async call<T>(method: string, params: unknown[] = []): Promise<T> {
      let last: unknown;
      for (let i = 0; i < tries; i++) {
        const usable = urls.filter((u) => !wrong.has(u));
        if (!usable.length) break;
        const url = usable[i % usable.length]!;
        try {
          await sameNetwork(url);
          return await once<T>(url, method, params);
        } catch (err) {
          last = err;
          if (i < tries - 1) await wait(RETRY_WAITS_MS[Math.min(i, RETRY_WAITS_MS.length - 1)]!);
        }
      }
      throw last instanceof RpcError ? last : new RpcError(`${method} failed: no endpoint on ${cluster}`);
    },
  };
}
