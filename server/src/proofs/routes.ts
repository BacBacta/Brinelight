/**
 * GET /proofs  the signed-in player's proofs (week 9, task 5): each milestone with what its leaf holds, and, once its
 * night is finalized on Solana, the seal and the path from the leaf to the seal's root. Everything here is the
 * player's own or public: their wallet, their salts, the seal. Never another player's leaf.
 */
import { fromHex, toHex, type Cluster, type PlayerProof, type ProofWhen } from "@brinelight/shared";
import { asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requirePlayer } from "../auth/session.js";
import type { Db } from "../db/index.js";
import { players, proofs, seals } from "../db/schema.js";
import { TOO_MANY_REQUESTS } from "../refusals.js";
import { merklePath } from "./merkle.js";
import type { NotaryService } from "./seal.js";

/** Reads of the proofs allowed per minute and per player. */
export const PROOFS_PER_MINUTE = 20;

export type ProofsAnswer = { notary: { cluster: Cluster; address: string } | null; proofs: PlayerProof[] };

export async function proofRoutes(app: FastifyInstance, { db, now, notary }: { db: Db; now: () => Date; notary: NotaryService | null }): Promise<void> {
  const signedIn = requirePlayer(db, now);

  app.get(
    "/proofs",
    {
      onRequest: signedIn,
      config: {
        rateLimit: {
          max: PROOFS_PER_MINUTE,
          timeWindow: 60_000,
          hook: "onRequest",
          keyGenerator: (req) => `proofs:${req.playerId}`,
          errorResponseBuilder: () => ({ statusCode: 429, ...TOO_MANY_REQUESTS }),
        },
      },
    },
    async (req): Promise<ProofsAnswer> => {
      const [player] = await db.select({ wallet: players.wallet }).from(players).where(eq(players.id, req.playerId));
      const rows = await db
        .select({ proof: proofs, seal: seals })
        .from(proofs)
        .leftJoin(seals, eq(seals.id, proofs.sealId))
        .where(eq(proofs.playerId, req.playerId))
        .orderBy(asc(proofs.id));
      // The leaves of each finalized seal met, in their order, read once.
      const leavesOf = new Map<number, Uint8Array[]>();
      const out: PlayerProof[] = [];
      for (const { proof, seal } of rows) {
        let sealed: PlayerProof["seal"] = null;
        if (seal && seal.status === "finalized" && proof.position !== null) {
          if (!leavesOf.has(seal.id)) {
            const leaves = await db.select({ leaf: proofs.leaf }).from(proofs).where(eq(proofs.sealId, seal.id)).orderBy(asc(proofs.position));
            leavesOf.set(seal.id, leaves.map((l) => fromHex(l.leaf)!));
          }
          const path = merklePath(leavesOf.get(seal.id)!, proof.position).map((s) => ({ side: s.side, hash: toHex(s.hash) }));
          sealed = { cluster: seal.cluster as Cluster, day: seal.day, root: seal.root, signature: seal.signature, path };
        }
        out.push({ fact: proof.fact, when: proof.when as ProofWhen, day: proof.day, salt: proof.salt, wallet: player?.wallet ?? "", leaf: proof.leaf, seal: sealed });
      }
      return { notary: notary ? { cluster: notary.key.cluster, address: notary.key.address } : null, proofs: out };
    },
  );
}
