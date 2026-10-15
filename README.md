# Projet Phare

Jeu de stratégie mobile et web dans un monde noyé : une cité flottante autour de son Phare, la Brume, les alliances, le Léviathan. Paiements en USDC sur Solana, sans jeton ni airdrop.

État : **semaine 1 de la feuille de route** (fondations). Les règles du jeu sont extraites du prototype et testées ; le client et le serveur sont des squelettes qui les utilisent.

## Démarrer

Il faut Node.js 22 ou plus.

```bash
npm install
npm run check        # types, tests, build : tout doit être vert
npm run dev:client   # http://localhost:5173 (le prototype est sur /prototype/)
npm run dev:server   # http://localhost:8787/health
```

## Organisation

| Dossier | Rôle |
| --- | --- |
| `shared/` | Règles du jeu pures et testées : bâtiments, économie, combat, recherche, radeaux, capitaines, plafond de confort, puissance |
| `server/` | Serveur Fastify qui décidera de tout (semaine 3 et suivantes) |
| `client/` | Client Vite + three.js ; la 3D du prototype y arrive en semaine 2 |
| `docs/` | Décisions et notes |
| `.github/workflows/` | Tests à chaque commit, mise en ligne du client sur Cloudflare Pages |

## Mise en ligne du client (Cloudflare Pages)

1. Crée un projet Cloudflare Pages nommé `projet-phare` (offre gratuite).
2. Dans les réglages du dépôt GitHub, ajoute deux secrets : `CLOUDFLARE_API_TOKEN` (jeton avec le droit « Cloudflare Pages : modifier ») et `CLOUDFLARE_ACCOUNT_ID`.
3. Chaque commit sur `main` qui passe les tests met le client en ligne.

## Travailler avec un assistant de code

Le fichier `CLAUDE.md` contient les règles du projet : structure, commandes, zones protégées et principes du jeu à ne jamais casser. L'assistant le lit avant chaque tâche.
