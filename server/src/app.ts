/**
 * Semaine 1 : un serveur minimal qui répond avec les règles partagées.
 * Semaine 3 : base de données, connexion par wallet, actions validées.
 * Principe à garder : le client envoie des intentions, le serveur décide avec @phare/shared.
 */
import Fastify from "fastify";
import { BUILDING_IDS, upgradeCost, upgradeTime, type BuildingId } from "@phare/shared";

export function buildApp() {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ ok: true, service: "projet-phare", version: "0.1.0" }));

  app.get<{ Params: { id: string; level: string } }>("/rules/buildings/:id/:level", async (req, reply) => {
    const id = req.params.id as BuildingId;
    const level = Number(req.params.level);
    if (!BUILDING_IDS.includes(id)) return reply.code(404).send({ error: "Bâtiment inconnu" });
    if (!Number.isInteger(level) || level < 0 || level > 60) return reply.code(400).send({ error: "Niveau invalide" });
    return { id, level, cost: upgradeCost(id, level), seconds: upgradeTime(id, level) };
  });

  return app;
}
