/**
 * Calls to the game server. A refusal keeps the server's `code`, tested by the client, its `error`, shown to the
 * player, and its whole body (an action's refusal carries the server's city). No network gives the code "offline",
 * no answer in time the code "timeout".
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: string; error: string; body?: unknown };

export const OFFLINE = "offline";
export const TIMEOUT = "timeout";
export const SERVER_DOWN = { ok: false, code: "server_error", error: "Something went wrong on the server. Please try again" } as const;

export type CallOptions = {
  token?: string | null;
  body?: unknown;
  keepalive?: boolean;
  /** No answer within this time: the request is dropped, with the code "timeout". */
  timeoutMs?: number;
};

export type Api = {
  call<T>(method: "GET" | "POST" | "PUT", path: string, options?: CallOptions): Promise<ApiResult<T>>;
};

/** The server address, from VITE_API_URL; none means the game is played without accounts. */
export const apiUrl = (): string | null => (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || null;

export function createApi(base: string, fetchFn: typeof fetch = (...a) => fetch(...a)): Api {
  return {
    async call<T>(method: "GET" | "POST" | "PUT", path: string, options: CallOptions = {}) {
      const headers: Record<string, string> = {};
      if (options.token) headers.authorization = `Bearer ${options.token}`;
      if (options.body !== undefined) headers["content-type"] = "application/json";
      const abort = options.timeoutMs ? new AbortController() : null;
      let timedOut = false;
      const timer = abort
        ? setTimeout(() => {
            timedOut = true;
            abort.abort();
          }, options.timeoutMs)
        : null;
      try {
        let res: Response;
        try {
          res = await fetchFn(`${base}${path}`, {
            method,
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            keepalive: options.keepalive ?? false,
            ...(abort ? { signal: abort.signal } : {}),
          });
        } catch {
          return { ok: false, code: timedOut ? TIMEOUT : OFFLINE, error: "" };
        }
        let data: unknown = null;
        try {
          data = await res.json();
        } catch {
          // A success whose body cannot be read (the page going away cuts it): as good as no answer.
          if (timedOut) return { ok: false, code: TIMEOUT, error: "" };
          return res.ok ? { ok: false, code: OFFLINE, error: "" } : SERVER_DOWN;
        }
        if (res.ok) return { ok: true, data: data as T };
        const o = data as { code?: unknown; error?: unknown } | null;
        return typeof o?.code === "string" && typeof o.error === "string" ? { ok: false, code: o.code, error: o.error, body: data } : SERVER_DOWN;
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}
