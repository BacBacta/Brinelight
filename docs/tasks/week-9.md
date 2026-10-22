# Week 9 · The first proof on Solana

Goal of the week: a moment of a player's game becomes a proof anyone can check on Solana, without trusting Brinelight. Every night, the server seals the day's milestones in one Solana transaction: a single fingerprint (a Merkle root) that says nothing about anyone. Each player can see their proofs in the game and check them, alone, against the chain. This is the "notary" of `CLAUDE.md`, at its smallest: nothing is sold, nothing is sent to a player's wallet, nothing personal goes on chain. The same notary will later seal the seasons' titles (week 13) and the daily recruitment's draw (week 15).

**Status: plan, waiting for the owner's answers (questions at the end). No code before them.**

Do the tasks in order, one per session. For each one: read CLAUDE.md, say what you will do and what you will not do, wait for approval, write the code, run `npm run check` (and `npm run e2e` when the client changes), commit, push. One pull request for the whole week.

## For every task this week

- **Protected areas (`CLAUDE.md`):** tasks 3 and 4 hold the notary's key and build, sign, send and check Solana transactions. They are written in their own commits, marked "protected" in their message, and are merged only after a human review of their diff. Nothing touches the wallet sign-in, the sessions, payments, `comfort.ts` or `RECRUIT_ODDS`.
- **No key, no secret in the repository or in the conversation.** The notary's key is made on the server by the owner, with a script that writes it in the server's `.env` and prints only its public address. The tests make throwaway keys and forget them, as the e2e's test wallet does. A test checks that the key never reaches a log line, an error or an answer.
- **Nothing personal on chain.** The chain receives one line a night: `brinelight proof v1 <day> <root>`. The root is a hash of hashes; each leaf has its own random salt, kept only by the server and given only to its player. Without the salt, nobody can tell whose milestone a leaf is, or guess one.
- **No token, no airdrop, no NFT, nothing in the player's wallet.** The player's wallet signs nothing and receives nothing this week. The notary pays the fees: one transaction a night, about 0.000005 SOL, whatever the number of players.
- **The server decides.** A milestone is recorded only from the city the rules made on the server. The client never sends a milestone, a date or a proof.
- **No new dependency** in my proposal (question 5): the transaction is a single Memo, built and signed with Node's own Ed25519 and the `base58.ts` already there.
- Player text in English, short, second person.

## Task 1 · The proof's format (no key, no chain)

What it does:

- **`docs/proofs.md`, the format, written for someone who does not trust us:**
  - a leaf: `sha256(0x00 ‖ "brinelight proof v1" ‖ salt (16 bytes) ‖ wallet address ‖ fact ‖ day)`;
  - a fact, for now: `lighthouse:<level>` (question 1);
  - the day: the UTC day the work ended, as `YYYY-MM-DD`; no hour;
  - a node: `sha256(0x01 ‖ left ‖ right)`, in leaf order; an odd node goes up alone. The two prefixes keep a leaf from passing for a node;
  - the memo: `brinelight proof v1 <day> <root in hex>`, signed by the notary, whose addresses are listed in that file.
- **The code:** `server/src/proofs/merkle.ts` (Node's `crypto`): leaves, root, the path of one leaf, the check of a path.
- **Test vectors** (`server/test/fixtures/proofs-v1.json`): leaves, roots and paths for 1, 2, 3, 7 and 1,000 leaves, used by the server's tests, by the client's check (task 5) and by the check script.

What it does not do: no database, no key, no network.

How it is tested:
- the vectors, written first;
- a path checks only its own leaf and its own root: changing one byte anywhere (salt, fact, day, path, root) fails;
- a node can never pass for a leaf (the prefixes);
- the same leaves always give the same root.

## Task 2 · Recording the milestones

What it does:

- **A table `proofs`** (migration `0004`):
  - player, fact, day, salt, leaf;
  - the night's seal it belongs to (empty until sealed).
  - A fact is recorded once per player (`unique (player, fact)`).
- **The server records a milestone** when it saves a city whose Lighthouse reached a new level:
  - read from the old and new cities, with `eventsBetween`;
  - the day is the one the rules say the work ended, never the moment the server saw it;
  - the salt comes from the server's `crypto.randomBytes`.
- **The cities that already passed a milestone** (two today) get theirs at their next save, dated the day of that save (question 9).

What it does not do: no seal, no chain, nothing shown in the game.

How it is tested:
- a Lighthouse that ends, offline or online, records one milestone with the rules' day;
- an action replayed, a city saved twice or a rejected action records nothing more;
- the cheat cases: an action carrying a `proof`, a `fact`, a `day` or a `milestone` field is refused as invalid, and records nothing;
- the migration on PGlite and on PostgreSQL (the `postgres` job).

## Task 3 · The notary: its key and its transaction (protected)

What it does:

- **The key:**
  - `deploy/notary-key.sh`, run by the owner on the server, makes an Ed25519 key with Node and writes it to the server's `.env` as `NOTARY_KEY` (mode 600);
  - it prints only the public address, which the owner sends a little SOL (question 6) and which goes into `docs/proofs.md`;
  - without `NOTARY_KEY`, the server runs as today and seals nothing.
- **The transaction** (`server/src/proofs/notary.ts`):
  - one legacy transaction, one signer (the notary, who pays), one instruction to the Memo program (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) carrying the memo of task 1;
  - built byte by byte, signed with Node's Ed25519;
  - sent through Solana's JSON-RPC (`getLatestBlockhash`, `sendTransaction`, `getSignatureStatuses`), to the endpoint `SOLANA_RPC_URL` (question 4);
  - read back with `getTransaction`: the memo on chain must be exactly the one sent, signed by the notary.
- **The network:** devnet all week (`SOLANA_CLUSTER=devnet`); mainnet only at task 6, after the review (question 3).

What it does not do:
- No other program, no account created, no token, no transfer to anyone.
- The key never leaves the server: no copy in GitHub, in the CI or in the conversation.
- Nothing in the player's wallet.

How it is tested:
- the transaction's bytes against vectors written by hand from Solana's documented format, with a throwaway key; its signature checks with Node's Ed25519;
- a fake RPC server in the tests (no network in the CI): an answer refused, late or never confirmed;
- the key never appears in a log line, an error or an answer;
- once, by hand, on devnet from the server: a real transaction, its signature and its explorer link sent to the owner.

## Task 4 · The nightly seal (protected)

What it does:

- **Every night at 00:15 UTC** (after `s1`'s reset), on real time, never sped up by `DEV_SPEED`:
  - the server takes the milestones not yet sealed;
  - it builds their root, sends its memo, waits until the transaction is finalized, then writes the transaction's signature on each of them. Nothing to seal: no transaction.
- **One seal per night, never two:**
  - the transaction sent is written before it is sent;
  - after a restart or an error, the server first asks the chain what became of it, and sends a new one only if the first can no longer land (its blockhash expired);
  - it tries again every hour until it lands.
- **`/health` says how the notary is:**
  - `notary: ok`, `late` (no seal for more than 26 hours while milestones wait), `low` (less than 0.005 SOL), or `off` (no key);
  - the `watch` workflow then alerts on `late` and `low`, as it does for the backups.

What it does not do: it never seals a milestone twice, never seals a day not yet ended, and never spends more than the transaction's fee.

How it is tested:
- with the fake RPC and a fake clock: a quiet night, a night with nothing, the RPC down for 3 hours, a restart between the sending and the confirmation, an expired blockhash;
- in every case: one root on chain a night at most, and each milestone sealed exactly once;
- `/health` in each state.

## Task 5 · Your proofs, in the game

What it does:

- **`GET /proofs`** (signed in): the player's milestones, each with:
  - its leaf, salt, path and root;
  - the transaction's signature, or "waiting for tonight's seal".
- **In the Profile, "Your proofs":** one line per milestone, for example "Lighthouse 10 · 21 October 2026 · Sealed on Solana".
  - **Check:** the client recomputes the leaf and the path with the browser's Web Crypto, and shows "This proof matches the seal", or what does not.
  - **See it on Solana:** opens the transaction in an explorer (question 7), where the memo and its root can be read.
  - **Save the proof:** a small JSON file.
- **`npm run proof:check -- <file>`** (`tools/proof/`): checks a saved proof against the chain itself, through any public RPC, without our server: the transaction exists, is finalized, is signed by a notary listed in `docs/proofs.md`, and its root matches.

What it does not do:
- No sharing on social networks.
- No public page of a player's proofs.
- Nothing sent to the wallet.

How it is tested:
- client tests on the task 1 vectors, and on a proof changed by one byte;
- `proof:check` against the fake RPC;
- an e2e: a Lighthouse that ends, the night sealed by the fake notary, the line in the Profile, "Check" green;
- look captures of the Profile (412 and 360), shown before their references are made again.

## Task 6 · On mainnet

What it does:

- After the human review of tasks 3 and 4:
  - the owner makes the mainnet key on the server and sends it the SOL;
  - `SOLANA_CLUSTER=mainnet`; the first night sealed on mainnet, its link sent to the owner.
- **The documentation:**
  - `docs/deploy.md`: the notary's key, its funding, what to do if it is lost (a new key, its address added to `docs/proofs.md`; the old proofs stay valid);
  - `docs/proofs.md`: the mainnet address;
  - `docs/decisions.md`: one line per decision of the week.

What it does not do: no seal of the devnet's milestones on mainnet. Those of the week are sealed again on the first mainnet night, with new salts.

How it is tested:
- `proof:check` on the first mainnet proof, from another machine than the server;
- `/health` reports `notary: ok` the next morning.

## Not this week

- Payments in USDC, and checking their transactions (week 14, protected).
- Badges and cosmetics as NFTs, or anything sent to the player's wallet.
- The seal of the seasons and the Guardians of the Great Lighthouse (week 13).
- The verifiable draw of the daily recruitment (week 15). The notary built here will serve it.
- The embedded wallet.
- A proof for anything but the Lighthouse (question 1).

## The questions for the owner

1. **What is proved first:** each new Lighthouse level, or only the milestones 5, 10, 15, 20, 25 and 30 (my proposal: fewer, and they mean something)? Something else (the first Leviathan hunted, a Daily Tasks streak)?
2. **What a leaf is tied to:** the account's wallet address, hashed with a salt (my proposal: the player can then prove "this wallet reached Lighthouse 10" by signing with it, and nothing on chain points to the wallet)? Or an anonymous game id, which proves less?
3. **The network:** devnet all week and mainnet at task 6, after the review (my proposal)? Or devnet only this week, and mainnet another week?
4. **The RPC:** Solana's public endpoints (free, limited, enough for one transaction a night, no account) with a second public one as backup (my proposal)? Or a provider's free plan (for example Helius), which needs an account and its key in the server's `.env`?
5. **The transaction:** built by hand, with no new dependency (my proposal: one Memo, about a hundred lines to review)? Or with `@solana/kit` at an exact version, bigger to install but maintained by Solana's developers?
6. **The SOL:** the notary spends about 0.000005 SOL a night, about 0.002 a year. Send it 0.02 SOL (about ten years of seals at today's fee) and be alerted below 0.005?
7. **The explorer:** Solana's own (`explorer.solana.com`, my proposal) or Solscan?
8. **The human review of tasks 3 and 4:** by you, on the diff of each commit, or by someone else you name?
9. **The milestones already passed** (your two cities): dated the day of their next save, saying "reached by" that day (my proposal: we do not know the day they were reached)? Or no proof for what was reached before the notary?
10. **The hour of the seal:** 00:15 UTC (my proposal, after the reset)? A milestone then waits at most one day for its seal.
