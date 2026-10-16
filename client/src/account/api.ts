/**
 * Calls to the game server. A refusal keeps the server's `code`, tested by the client, and its `error`,
 * shown to the player. No network gives the code "offline".
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: string; error: string };

export const OFFLINE = "offline";
const SERVER_DOWN = { ok: false, code: "server_error", error: "Something went wrong on the server. Please try again" } as const;

export type Api = {
  call<T>(method: "GET" | "POST" | "PUT", path: string, options?: { token?: string | null; body?: unknown; keepalive?: boolean }): Promise<ApiResult<T>>;
};

/** The server address, from VITE_API_URL; none means the game is played without accounts. */
export const apiUrl = (): string | null => (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || null;

export function createApi(base: string, fetchFn: typeof fetch = (...a) => fetch(...a)): Api {
  return {
    async call<T>(method: "GET" | "POST" | "PUT", path: string, options: { token?: string | null; body?: unknown; keepalive?: boolean } = {}) {
      const headers: Record<string, string> = {};
      if (options.token) headers.authorization = `Bearer ${options.token}`;
      if (options.body !== undefined) headers["content-type"] = "application/json";
      let res: Response;
      try {
        res = await fetchFn(`${base}${path}`, {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          keepalive: options.keepalive ?? false,
        });
      } catch {
        return { ok: false, code: OFFLINE, error: "" };
      }
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        // A success whose body cannot be read (the page going away cuts it): as good as no answer.
        return res.ok ? { ok: false, code: OFFLINE, error: "" } : SERVER_DOWN;
      }
      if (res.ok) return { ok: true, data: data as T };
      const o = data as { code?: unknown; error?: unknown } | null;
      return typeof o?.code === "string" && typeof o.error === "string" ? { ok: false, code: o.code, error: o.error } : SERVER_DOWN;
    },
  };
}
