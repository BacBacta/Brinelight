/**
 * Wallet sign-in (Sign In With Solana) and sessions. Protected area: see CLAUDE.md.
 *
 * POST /auth/nonce   gives a single-use nonce, valid 5 minutes.
 * POST /auth/verify  checks the signed message and opens a session; the token is returned once.
 * POST /auth/logout  closes the session of the token sent.
 * GET  /me           the signed-in player.
 */
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Config } from "../config.js";
import { createNonce, createSession, deleteSession, findOrCreatePlayer, findPlayer, findSession, nonceRefusal, useNonce, type Db } from "../db/index.js";
import { INVALID_REQUEST, SIGNED_OUT, refusal, type Refusal } from "../refusals.js";
import { decodeAddress } from "./base58.js";
import { verifyEd25519 } from "./ed25519.js";
import { bearer } from "./session.js";
import { STATEMENT, parseSignInMessage } from "./siws.js";

export const NONCE_MS = 5 * 60_000;
export const SESSION_MS = 30 * 24 * 3600_000;
/** How far `Issued At` may be from the server clock, either way. */
export const ISSUED_AT_SLACK_MS = 5 * 60_000;
/** The longest life a sign-in message may ask for. */
export const MESSAGE_MAX_MS = 10 * 60_000;
/** Sign-in requests allowed per minute and per player IP address. */
export const AUTH_PER_MINUTE = 20;

/** The refusals of sign-in, each with its stable code (see refusals.ts). */
export const REFUSED = {
  origin: refusal("origin_not_allowed", "This page is not allowed to sign in to Brinelight"),
  request: INVALID_REQUEST,
  message: refusal("invalid_message", "This sign-in message is not valid"),
  address: refusal("wrong_wallet", "This message was signed for another wallet"),
  site: refusal("wrong_site", "This message was made for another site"),
  statement: refusal("wrong_statement", "This message does not ask to sign in to Brinelight"),
  chain: refusal("wrong_network", "This message is for another Solana network"),
  clock: refusal("wrong_time", "This message was made at the wrong time. Check your device's clock"),
  expiry: refusal("expiry_too_long", "This message must expire within 10 minutes"),
  expired: refusal("sign_in_expired", "This sign-in has expired. Please try again"),
  signature: refusal("bad_signature", "This message was not signed by this wallet"),
  unknown: refusal("unknown_nonce", "This sign-in was not started here. Please try again"),
  used: refusal("nonce_used", "This sign-in was already used. Please try again"),
  session: SIGNED_OUT,
} as const;

export type AuthOptions = { db: Db; config: Config; now: () => Date };

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
/** Strict base64: only the canonical spelling of some bytes, or null. */
const fromBase64 = (text: string): Buffer | null => {
  if (!BASE64.test(text)) return null;
  const bytes = Buffer.from(text, "base64");
  return bytes.toString("base64") === text ? bytes : null;
};
const utf8 = new TextDecoder("utf-8", { fatal: true });
const readUtf8 = (bytes: Uint8Array): string | null => {
  try {
    return utf8.decode(bytes);
  } catch {
    return null;
  }
};

const verifyBody = {
  type: "object",
  required: ["address", "signedMessage", "signature"],
  additionalProperties: false,
  properties: {
    address: { type: "string", minLength: 32, maxLength: 44 },
    signedMessage: { type: "string", minLength: 1, maxLength: 2048 },
    signature: { type: "string", minLength: 88, maxLength: 88 },
  },
} as const;

export async function authRoutes(app: FastifyInstance, { db, config, now }: AuthOptions): Promise<void> {
  const limit = { rateLimit: { max: AUTH_PER_MINUTE, timeWindow: 60_000 } };

  app.post("/auth/nonce", { config: limit }, async () => {
    const at = now();
    const nonce = randomBytes(16).toString("hex");
    const expiresAt = new Date(at.getTime() + NONCE_MS);
    await createNonce(db, nonce, at, expiresAt);
    return { nonce, expiresAt: expiresAt.toISOString() };
  });

  app.post<{ Body: { address: string; signedMessage: string; signature: string } }>(
    "/auth/verify",
    { config: limit, schema: { body: verifyBody } },
    async (req, reply) => {
      const refuse = (status: number, why: Refusal) => reply.code(status).send(why);
      const origin = req.headers.origin;
      if (!origin || !config.allowedOrigins.includes(origin)) return refuse(403, REFUSED.origin);

      const { address, signedMessage, signature } = req.body;
      const messageBytes = fromBase64(signedMessage);
      const signatureBytes = fromBase64(signature);
      if (!messageBytes || !signatureBytes || signatureBytes.length !== 64) return refuse(400, REFUSED.request);
      const text = readUtf8(messageBytes);
      const message = text === null ? null : parseSignInMessage(text);
      if (!message) return refuse(400, REFUSED.message);

      if (message.address !== address) return refuse(400, REFUSED.address);
      let uriOrigin: string | null = null;
      try {
        uriOrigin = new URL(message.uri).origin;
      } catch {
        uriOrigin = null;
      }
      if (message.domain !== new URL(origin).host || uriOrigin !== origin) return refuse(400, REFUSED.site);
      if (message.statement !== STATEMENT || message.version !== "1") return refuse(400, REFUSED.statement);
      if (message.chainId !== config.chainId) return refuse(400, REFUSED.chain);

      const at = now();
      const issued = message.issuedAt.getTime();
      const expires = message.expirationTime.getTime();
      if (Math.abs(issued - at.getTime()) > ISSUED_AT_SLACK_MS) return refuse(400, REFUSED.clock);
      if (expires <= issued || expires - issued > MESSAGE_MAX_MS) return refuse(400, REFUSED.expiry);
      if (expires <= at.getTime()) return refuse(401, REFUSED.expired);

      // The signature is checked on the exact bytes the wallet returned, with the key the message names.
      const key = decodeAddress(message.address);
      if (!key || !verifyEd25519(key, messageBytes, signatureBytes)) return refuse(401, REFUSED.signature);

      // Only now is the nonce used: a single UPDATE, so two sign-ins with the same nonce cannot both pass.
      if (!(await useNonce(db, message.nonce, at))) {
        const why = await nonceRefusal(db, message.nonce, at);
        return refuse(401, REFUSED[why]);
      }

      const player = await findOrCreatePlayer(db, message.address, at);
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(at.getTime() + SESSION_MS);
      await createSession(db, token, player.id, at, expiresAt);
      return { token, expiresAt: expiresAt.toISOString(), player: { id: player.id, wallet: player.wallet } };
    },
  );

  app.post("/auth/logout", { config: limit }, async (req, reply) => {
    const token = bearer(req);
    if (!token) return reply.code(401).send(REFUSED.session);
    await deleteSession(db, token);
    return { ok: true };
  });

  app.get("/me", async (req, reply) => {
    const token = bearer(req);
    const session = token ? await findSession(db, token, now()) : null;
    const player = session ? await findPlayer(db, session.playerId) : null;
    if (!session || !player) return reply.code(401).send(REFUSED.session);
    return { player: { id: player.id, wallet: player.wallet }, expiresAt: session.expiresAt.toISOString() };
  });
}
