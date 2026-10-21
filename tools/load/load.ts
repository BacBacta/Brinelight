/**
 * The load test (week 8, task 4): N simulated players against a game server, at a human rhythm. Each signs in with its
 * own throwaway Ed25519 key, made here and forgotten at the end, exactly as a wallet signs in; then it opens its city
 * now and then ("a launch") and sends an action every 20 to 60 seconds: an upgrade, a fleet, a claim. The server's
 * limits are never changed or bypassed: sign-ins are paced under the limit per address.
 */
import { generateKeyPairSync, randomUUID, sign, type KeyObject } from "node:crypto";
import { BUILDING_IDS, SEA_SITES } from "@brinelight/shared";
import { base58Encode } from "../../server/src/auth/base58.js";
import { STATEMENT, formatSignInMessage } from "../../server/src/auth/siws.js";

export type LoadOptions = {
  /** The game server, e.g. https://api.brinelight.xyz. */
  url: string;
  /** The game page allowed to sign in (ALLOWED_ORIGINS), e.g. https://play.brinelight.xyz. */
  origin: string;
  /** The players playing in each stage: they add up (100, then 150 more to make 250…). */
  stages: number[];
  /** How long each stage is measured, once all its players have signed in. */
  stageSeconds: number;
  /** Seconds between two actions of a player, at random between the two. */
  actionEvery: [number, number];
  /** Seconds between two launches (GET /city) of a player. */
  launchEvery: [number, number];
  /** Sign-ins a minute, under the server's limit per address (AUTH_PER_MINUTE, 20). */
  signInsPerMinute: number;
};

export const DEFAULTS: Omit<LoadOptions, "url" | "origin"> = {
  stages: [100, 250, 500],
  stageSeconds: 600,
  actionEvery: [20, 60],
  launchEvery: [180, 420],
  signInsPerMinute: 18,
};

/** What an answer was: fine, refused by the rules of the game (they decide), or something to look at. */
export type Outcome = "ok" | "rules" | "tooMany" | "error";

export const outcomeOf = (status: number | null): Outcome =>
  status === null ? "error" : status < 300 ? "ok" : status === 422 ? "rules" : status === 429 ? "tooMany" : "error";

/** The value under which `share` of the sorted values fall (0.99: the slowest 1 % are above it). */
export function percentile(values: readonly number[], share: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(share * sorted.length) - 1)]!;
}

/**
 * Never more than `perMinute` starts in any 61 seconds (a second of margin on the server's window). Returns the
 * milliseconds to wait before the next start, given the times of the previous ones.
 */
export function waitBeforeNext(starts: readonly number[], now: number, perMinute: number): number {
  const recent = starts.filter((t) => now - t < 61_000);
  if (recent.length < perMinute) return 0;
  return Math.min(...recent) + 61_000 - now;
}

const between = ([a, b]: [number, number]) => (a + Math.random() * (b - a)) * 1000;
const sleep = (ms: number, stop: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    stop.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

/** A throwaway wallet: its key lives in this process only. */
function newWallet(): { address: string; key: KeyObject } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { address: base58Encode(publicKey.export({ format: "der", type: "spki" }).subarray(-32)), key: privateKey };
}

type Sample = { at: number; ms: number; outcome: Outcome; what: string; status: number | null };

class Recorder {
  samples: Sample[] = [];
  async call(what: string, url: string, init: RequestInit): Promise<{ status: number | null; body: unknown }> {
    const start = performance.now();
    let status: number | null = null;
    let body: unknown = null;
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
      status = res.status;
      body = await res.json().catch(() => null);
    } catch {
      status = null;
    }
    this.samples.push({ at: Date.now(), ms: performance.now() - start, outcome: outcomeOf(status), what, status });
    return { status, body };
  }
}

/** Signs a player in as a wallet would: the server's nonce, the Sign In With Solana message, the signature. */
async function signIn(o: LoadOptions, rec: Recorder): Promise<string | null> {
  const wallet = newWallet();
  const headers = { origin: o.origin, "content-type": "application/json" };
  const n = await rec.call("sign-in", `${o.url}/auth/nonce`, { method: "POST", headers: { origin: o.origin } });
  const nonce = n.body as { nonce: string; issuedAt: string; expiresAt: string; chainId: string } | null;
  if (n.status !== 200 || !nonce) return null;
  const message = formatSignInMessage({
    domain: new URL(o.origin).host,
    address: wallet.address,
    statement: STATEMENT,
    uri: o.origin,
    version: "1",
    chainId: nonce.chainId,
    nonce: nonce.nonce,
    issuedAt: nonce.issuedAt,
    expirationTime: nonce.expiresAt,
  });
  const bytes = Buffer.from(message, "utf8");
  const payload = { address: wallet.address, signedMessage: bytes.toString("base64"), signature: sign(null, bytes, wallet.key).toString("base64") };
  const v = await rec.call("sign-in", `${o.url}/auth/verify`, { method: "POST", headers, body: JSON.stringify(payload) });
  return v.status === 200 ? (v.body as { token: string }).token : null;
}

// What a player does: the island's buildings to upgrade (the Lighthouse needs more), the sea's sites, the daily claim.
const BUILDINGS = BUILDING_IDS.filter((b) => b !== "lighthouse");
function anAction(): Record<string, unknown> {
  const id = randomUUID();
  const r = Math.random();
  if (r < 0.5) return { id, type: "upgrade", building: BUILDINGS[Math.floor(Math.random() * BUILDINGS.length)]! };
  if (r < 0.8) return { id, type: "sail", site: SEA_SITES[Math.floor(Math.random() * SEA_SITES.length)]!.id };
  return { id, type: "claimObjective" };
}

/** One player, from its sign-in until `stop`. */
async function play(o: LoadOptions, token: string, rec: Recorder, stop: AbortSignal): Promise<void> {
  const auth = { authorization: `Bearer ${token}` };
  const launch = () => rec.call("city", `${o.url}/city`, { headers: auth });
  await launch();
  let nextLaunch = Date.now() + between(o.launchEvery);
  while (!stop.aborted) {
    await sleep(between(o.actionEvery), stop);
    if (stop.aborted) break;
    if (Date.now() >= nextLaunch) {
      await launch();
      nextLaunch = Date.now() + between(o.launchEvery);
    }
    await rec.call("action", `${o.url}/city/actions`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ action: anAction() }),
    });
  }
}

export type StageResult = {
  players: number;
  seconds: number;
  requests: number;
  perSecond: number;
  p50: number;
  p99: number;
  rules: number;
  tooMany: number;
  errors: number;
  /** The first few unexpected answers, to look at. */
  examples: string[];
};

export function summarize(samples: readonly Sample[], players: number, from: number, to: number): StageResult {
  const inside = samples.filter((s) => s.at >= from && s.at < to);
  const ms = inside.map((s) => s.ms);
  const count = (k: Outcome) => inside.filter((s) => s.outcome === k).length;
  return {
    players,
    seconds: Math.round((to - from) / 1000),
    requests: inside.length,
    perSecond: Math.round((inside.length / ((to - from) / 1000)) * 100) / 100,
    p50: Math.round(percentile(ms, 0.5)),
    p99: Math.round(percentile(ms, 0.99)),
    rules: count("rules"),
    tooMany: count("tooMany"),
    errors: count("error"),
    examples: inside
      .filter((s) => s.outcome === "error" || s.outcome === "tooMany")
      .slice(0, 5)
      .map((s) => `${s.what} → ${s.status ?? "no answer"}`),
  };
}

/**
 * Runs the stages one after the other: the new players of a stage sign in (paced), then the stage is measured for
 * `stageSeconds` while all the players so far play. Sign-ins are counted apart and never in a stage's measures.
 */
export async function runLoad(o: LoadOptions, log: (line: string) => void = () => {}): Promise<{ stages: StageResult[]; signIns: StageResult }> {
  const rec = new Recorder();
  const signInRec = new Recorder();
  const stop = new AbortController();
  const playing: Promise<void>[] = [];
  const starts: number[] = [];
  const stages: StageResult[] = [];
  const signInFrom = Date.now();
  let players = 0;
  try {
    for (const target of o.stages) {
      log(`Signing in players ${players + 1} to ${target} (${o.signInsPerMinute} a minute)…`);
      while (players < target) {
        const wait = waitBeforeNext(starts, Date.now(), o.signInsPerMinute);
        if (wait > 0) await sleep(wait, stop.signal);
        starts.push(Date.now());
        const token = await signIn(o, signInRec);
        if (!token) throw new Error(`A sign-in was refused: ${signInRec.samples.at(-1)?.status ?? "no answer"}. Nothing else is measured.`);
        playing.push(play(o, token, rec, stop.signal));
        players++;
      }
      const from = Date.now();
      log(`${players} players: measuring for ${o.stageSeconds} s…`);
      await sleep(o.stageSeconds * 1000, stop.signal);
      const result = summarize(rec.samples, players, from, Date.now());
      stages.push(result);
      log(line(result));
    }
  } finally {
    stop.abort();
    await Promise.all(playing);
  }
  return { stages, signIns: summarize(signInRec.samples, players, signInFrom, Date.now()) };
}

export const line = (r: StageResult) =>
  `${r.players} players, ${r.seconds} s: ${r.requests} answers (${r.perSecond}/s), p50 ${r.p50} ms, p99 ${r.p99} ms, ` +
  `refused by the rules ${r.rules}, too many ${r.tooMany}, errors ${r.errors}${r.examples.length ? ` (${r.examples.join(", ")})` : ""}`;
