# Brinelight

A mobile and web strategy game in a drowned world: a floating city around its Lighthouse, the Mist, alliances, the Leviathan. USDC payments on Solana, no token, no airdrop.

Status: **week 1 of the roadmap** (foundations). The game rules are extracted from the prototype and tested; the client and the server are skeletons that use them.

## Getting started

You need Node.js 22 or later.

```bash
npm install
npm run check        # types, tests, build: everything must be green
npm run dev:client   # http://localhost:5173 (the prototype is at /prototype/)
npm run dev:server   # http://localhost:8787/health
```

## Layout

| Folder | Role |
| --- | --- |
| `shared/` | Pure, tested game rules: buildings, economy, combat, research, rafts, captains, convenience cap, power |
| `server/` | Fastify server that will decide everything (week 3 onward) |
| `client/` | Vite + three.js client; the prototype's 3D arrives here in week 2 |
| `docs/` | Decisions and notes |
| `.github/workflows/` | Tests on every commit, client deployment to Cloudflare Pages |

## Deploying the client (Cloudflare Pages)

1. Create a Cloudflare Pages project named `brinelight` (free plan).
2. In the GitHub repository settings, add two secrets: `CLOUDFLARE_API_TOKEN` (a token with the "Cloudflare Pages: Edit" permission) and `CLOUDFLARE_ACCOUNT_ID`.
3. Every commit on `main` that passes the tests deploys the client.

## Working with a coding assistant

The `CLAUDE.md` file holds the project rules: structure, commands, protected areas and the game principles never to break. The assistant reads it before every task.
