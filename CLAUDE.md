# Brinelight · rules for the coding assistant

A mobile and web strategy game (in the vein of Whiteout Survival) set in a drowned world. Solana acts as a notary: USDC payments, proofs, badges and cosmetics. One developer, tight budget.

Read this whole file before every task. When in doubt, ask rather than guess.

## Structure

- `shared/`: the game rules in pure TypeScript (`@brinelight/shared`). No dependency on the network, the DOM, the system clock or randomness. Everything in it is tested.
- `server/`: Fastify. The server DECIDES. It applies the rules from `shared/` and refuses everything they refuse.
- `client/`: Vite + three.js. The client DISPLAYS. It sends intentions ("upgrade the Refinery"), never results ("I have 9,000 oil").
- `client/public/prototype/`: the reference prototype. We consult it; we no longer modify it.
- `docs/decisions.md`: the decisions made and why. Add a line whenever you settle something.

## Commands

- `npm install`: installs the whole monorepo.
- `npm test`: all tests (Vitest). Must pass before every commit.
- `npm run typecheck`: type checking of the three packages.
- `npm run build`: client build.
- `npm run check`: all three in a row. This is what continuous integration runs.
- `npm run dev:client` and `npm run dev:server`: local development.

## Working rules

1. One task at a time, small, described in writing: what it does, what it does not do, how it is tested.
2. Every new or changed game rule goes in `shared/src/rules/` with its tests in `shared/test/`. Write the test first when you can.
3. Never change a balance value (cost, duration, rate, cap) without saying so explicitly in your answer and updating the relevant test.
4. Rule durations are in REAL seconds and rates are PER real HOUR (see `shared/src/rules/time.ts`). Development speedup happens on the server, never in the rules.
5. A rule refuses with a readable reason in English (`refuse("…")`). The server returns that reason as is.
6. No new dependency without announcing it and saying why. Exact versions only.
7. Run `npm run check` before saying a task is done.

## Protected areas: do not modify without an explicit request and human review

- Any code for payments, Solana transaction verification or purchase delivery.
- Keys, secrets and `.env` files (never read, display or commit them).
- `shared/src/rules/comfort.ts`: the convenience cap (100 USDC per month, 30 for a minor, 4 h per day) is a public promise.
- The recruitment odds (`RECRUIT_ODDS`): they are published.

## Game principles never to break

- Never paid randomness. The only random draw, the daily recruitment, is free and verifiable.
- Never a token, an airdrop, or land sold as NFTs.
- Never for sale: troops, recruitments, fragments, Pearls, rafts, protections, alliance seats.
- USDC payment is reserved for adults; the convenience cap is counted per game account, not per wallet.
- The Alliance Treasury holds only Pearls and can never pay a chosen player.
- No personal data on chain.

## Style

- Strict TypeScript. Pure functions in `shared/`. Player-facing text in English (plain, short, second person), code identifiers in English.
- Game text: short sentences, second person ("you"), the player's vocabulary ("city", "Lighthouse", "fleet"), never technical jargon.
- Short commits in the imperative present: "Add the raft rule".
