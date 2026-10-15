/**
 * Week 1: a minimal server that answers with the shared rules.
 * Week 3: database, wallet sign-in, validated actions.
 * Principle to keep: the client sends intentions, the server decides with @brinelight/shared.
 */
import Fastify from "fastify";
import { BUILDING_IDS, upgradeCost, upgradeTime, type BuildingId } from "@brinelight/shared";

export function buildApp() {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ ok: true, service: "brinelight", version: "0.1.0" }));

  app.get<{ Params: { id: string; level: string } }>("/rules/buildings/:id/:level", async (req, reply) => {
    const id = req.params.id as BuildingId;
    const level = Number(req.params.level);
    if (!BUILDING_IDS.includes(id)) return reply.code(404).send({ error: "Unknown building" });
    if (!Number.isInteger(level) || level < 0 || level > 60) return reply.code(400).send({ error: "Invalid level" });
    return { id, level, cost: upgradeCost(id, level), seconds: upgradeTime(id, level) };
  });

  return app;
}
