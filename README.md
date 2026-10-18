# Brinelight

A mobile and web strategy game in a drowned world: a floating city around its Lighthouse, the Mist, alliances, the Leviathan. USDC payments on Solana, no token, no airdrop.

Status: **week 7 of the roadmap** (`docs/tasks/week-7.md`). The whole city of the prototype is decided by the server; the plan of each week is in `docs/tasks/`, and the decisions in `docs/decisions.md`.

## Getting started

You need Node.js 22 or later.

```bash
npm install
npm run check        # types, tests, build: everything must be green
npm run dev:client   # http://localhost:5173 (the prototype is at /prototype/)
npm run dev:server   # http://localhost:8787/health
```

Signed in, the city's time is the server's: `DEV_SPEED=60 npm run dev:server` runs it 60 times faster, as the client does on its own in development (refused in production).

## Layout

| Folder | Role |
| --- | --- |
| `shared/` | Pure, tested game rules: buildings, economy, combat, research, rafts, captains, convenience cap, power |
| `server/` | Fastify server that will decide everything (week 3 onward) |
| `client/` | Vite + three.js client; the prototype's 3D arrives here in week 2 |
| `docs/` | Decisions and notes |
| `.github/workflows/` | Tests on every commit (`npm run check`) |

## Deploying the client (Cloudflare Pages)

The Cloudflare Pages project `brinelight` is connected to this GitHub repository and builds the client by itself:

- build command: `npm run build`, output folder: `client/dist`;
- every push to `main` publishes https://brinelight.pages.dev;
- every other branch gets a preview URL, posted by the Cloudflare bot on its pull request.

Cloudflare does not wait for the tests: check that the "check" job of GitHub Actions is green before merging into `main`.

## Working with a coding assistant

The `CLAUDE.md` file holds the project rules: structure, commands, protected areas and the game principles never to break. The assistant reads it before every task.
