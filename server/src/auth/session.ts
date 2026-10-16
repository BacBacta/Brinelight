/** Who is signed in: the session token sent as `Authorization: Bearer`. Protected area: see CLAUDE.md. */
import type { FastifyReply, FastifyRequest } from "fastify";
import { findSession, type Db } from "../db/index.js";
import { SIGNED_OUT } from "../refusals.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by requirePlayer; empty on routes that do not need a session. */
    playerId: string;
  }
}

/** 32 random bytes in base64url: 43 characters. */
const TOKEN = /^Bearer ([A-Za-z0-9_-]{43})$/;
export const bearer = (req: FastifyRequest): string | null => TOKEN.exec(req.headers.authorization ?? "")?.[1] ?? null;

/**
 * An onRequest hook: refuses the request (401, signed_out) before its body is read unless it carries
 * a live session, and sets `req.playerId`.
 */
export const requirePlayer = (db: Db, now: () => Date) => async (req: FastifyRequest, reply: FastifyReply) => {
  const token = bearer(req);
  const session = token ? await findSession(db, token, now()) : null;
  if (!session) return reply.code(401).send(SIGNED_OUT);
  req.playerId = session.playerId;
};
