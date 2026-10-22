# Week 9 · The first proof on Solana

Goal of the week: a moment of a player's game becomes a proof anyone can check on Solana, without trusting Brinelight. Every night, the server seals the day's milestones in one Solana transaction: a single fingerprint (a Merkle root) that says nothing about anyone. Each player can see their proofs in the game and check them, alone, against the chain. This is the "notary" of `CLAUDE.md`, at its smallest: nothing is sold, nothing is sent to a player's wallet, nothing personal goes on chain. The same notary will later seal the titles of Guardians of the Great Lighthouse and the seasons of the Tides (week 13), and the daily recruitment's draw (week 15).

**Status: tasks 1 to 5 are done (22 October), on devnet only; tasks 3 and 4 had their independent review (below). Stop before task 6 (mainnet): nothing on mainnet without the owner's yes.**

Do the tasks in order, one per session. For each one: read CLAUDE.md, say what you will do and what you will not do, wait for approval, write the code, run `npm run check` (and `npm run e2e` when the client changes), commit, push. One pull request for the whole week.

## For every task this week

- **Protected areas (`CLAUDE.md`):** tasks 3 and 4 hold the notary's key and build, sign, send and check Solana transactions. They are written in their own commits, marked "protected" in their message, and are merged only after their review (just below). Nothing touches the wallet sign-in, the sessions, payments, `comfort.ts` or `RECRUIT_ODDS`.
- **The review of tasks 3 and 4** (owner's answer 8; the owner is not a developer):
  - an independent review by a separate agent, which did not write the code and looks for the flaws: the key leaking into a log line, an error, an answer or a backup; the wrong network; a seal sent twice; the amount spent; what the transaction carries;
  - a list of checks in plain French, in `docs/proofs.md`, that the owner goes through alone before mainnet;
  - before the USDC payments, a review by a human Solana developer will be required (`docs/decisions.md`).
- **No key, no secret in the repository or in the conversation.** The notary's key is made on the server by the owner, with a script that writes it in the server's `.env` and prints only its public address. The key is never copied off the server. The tests make throwaway keys and forget them, as the e2e's test wallet does. A test checks that the key never reaches a log line, an error or an answer.
- **Nothing personal on chain.** The chain receives one line a night: `brinelight proof v1 <day> <root>`. The root is a hash of hashes; each leaf has its own random salt, kept only by the server and given only to its player. Without the salt, nobody can tell whose milestone a leaf is, or guess one. A player deleted takes their salts with them: their leaves can then be tied to no one.
- **No token, no airdrop, no NFT, nothing in the player's wallet.** The player's wallet signs nothing and receives nothing this week. The notary pays the fees: one transaction a night, about 0.000005 SOL, whatever the number of players.
- **The server decides.** A milestone is recorded only from the city the rules made on the server. The client never sends a milestone, a date or a proof.
- **No new dependency** (owner's answer 5): the transaction is a single Memo, built by hand and signed with Node's own Ed25519 (`node:crypto`), with the `base58.ts` already there.
- Player text in English, short, second person.

## Task 1 · The proof's format (no key, no chain)

What it does:

- **`docs/proofs.md`, the format, written for someone who does not trust us:**
  - a leaf: `sha256(0x00 ‖ "brinelight proof v1" ‖ salt (16 bytes) ‖ wallet ‖ fact ‖ when ‖ day)`, each of the last four fields as one byte of length then its ASCII text;
  - a fact is `<kind>:<value>`. Today one kind, `lighthouse` (`lighthouse:10`). Later kinds (the titles of Guardians of the Great Lighthouse, the seasons of the Tides) are new kinds in the same format: the version stays `v1` (owner's answer 1). A checker that meets a kind it does not know still checks its proof;
  - `when` is `on` (the day the work ended) or `by` (reached on that day at the latest: the milestones passed before the notary, owner's answer 9);
  - the day: a UTC day, `YYYY-MM-DD`; no hour;
  - a node: `sha256(0x01 ‖ left ‖ right)`, in leaf order; an odd node goes up alone, never paired with itself. The two prefixes keep a leaf from passing for a node;
  - the memo: `brinelight proof v1 <day sealed> <root in hex>`, signed by the notary;
  - **the notary's official public addresses**, the current one and the history of the old ones with their dates, so players recognize the real signature (empty until task 3);
  - one example worked by hand, byte by byte, that anyone can redo with `xxd` and `sha256sum`.
- **The code:**
  - `shared/src/rules/proofs.ts` (pure): the milestones (`LIGHTHOUSE_MILESTONES`: 5, 10, 15, 20, 25, 30), the facts, the days, and the bytes of a leaf, of a node and of the memo;
  - `server/src/proofs/merkle.ts` (Node's `crypto`): leaves, root, the path of one leaf, the check of a path.
- **Test vectors** (`shared/test/fixtures/proofs-v1.json`): leaves, roots and paths for 1, 2, 3, 7 and 1,000 leaves, used by the server's tests, by the client's check (task 5) and by the check script.

What it does not do: no database, no key, no network.

How it is tested:
- the hand-worked example of `docs/proofs.md`, byte by byte;
- the vectors;
- a path checks only its own leaf and its own root: changing one byte anywhere (salt, wallet, fact, when, day, path, root) fails;
- a node can never pass for a leaf (the prefixes); a field can never spill into the next (the lengths);
- a fact, a day or a wallet that does not follow the format is refused;
- the same leaves always give the same root.

**Done (22 October).** `shared/src/rules/proofs.ts` (pure, with no `Date`: the UTC days are counted by hand and checked against the platform's calendar over 60 years), `server/src/proofs/merkle.ts`, the frozen vectors `shared/test/fixtures/proofs-v1.json` and `docs/proofs.md`, whose hand-worked leaf was checked with `sha256sum` apart from Node. Tests: `shared/test/proofs.test.ts`, `server/test/merkle.test.ts`.

## Task 2 · Recording the milestones

What it does:

- **A table `proofs`** (migration `0004`):
  - player, fact, `when`, day, salt, leaf, the time it was recorded;
  - a fact is recorded once per player (`unique (player, fact)`);
  - a player deleted takes their rows with them;
  - the night's seal each row belongs to comes with task 4.
- **The server records a milestone** in the same transaction as the city it saves, when the saved city's Lighthouse is at a milestone or above that is not recorded yet:
  - a Lighthouse that rose since the last save: `on` the day its work ended, read from the stored city's clock and the time its upgrade had left (never after the day of the save);
  - a milestone passed before (the cities that already passed one, two today): `by` the day of that save;
  - the salt comes from the server's `crypto.randomBytes`.

What it does not do: no seal, no chain, nothing shown in the game, no new answer field.

How it is tested:
- a Lighthouse that ends, offline or online, records one milestone `on` the rules' day;
- a city already at Lighthouse 12 records 5 and 10 `by` the day of its next save, and nothing more;
- an action replayed, a city saved twice, a refused action or an action that changes nothing records nothing more;
- the cheat cases: an action carrying a `proof`, a `fact`, a `day` or a `milestone` field, or a body with one beside the action, is refused as invalid and records nothing;
- the migration on PGlite and on PostgreSQL (the `postgres` job).

**Done (22 October).** The table `proofs` (migration `0004_proofs`; the column of `when` is named `dated`, as `when` is a word of SQL), `milestonesReached` in `shared/src/state/milestones.ts`, and `server/src/proofs/record.ts`, called in the transaction that writes the city. Below Lighthouse 5, no query is added. A wallet that does not fit the format records nothing and is logged with the player id only; the action still goes through. Tests: `server/test/proofs.test.ts`, on PGlite, and on PostgreSQL in the CI's `postgres` job (also run here on PostgreSQL 16).

## Task 3 · The notary: its key and its transaction (protected)

What it does:

- **The key:**
  - `deploy/notary-key.sh`, run by the owner on the server, makes an Ed25519 key with Node and writes it to the server's `.env` as `NOTARY_KEY` (mode 600);
  - it prints only the public address. Claude Code gives that address to the owner, who sends it 0.02 SOL from Phantom (owner's answer 6); it goes into `docs/proofs.md`;
  - without `NOTARY_KEY`, the server runs as today and seals nothing.
- **The transaction** (`server/src/proofs/notary.ts`):
  - one legacy transaction, one signer (the notary, who pays), one instruction to the Memo program (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) carrying the memo of task 1;
  - built byte by byte, signed with Node's Ed25519;
  - sent through Solana's JSON-RPC (`getLatestBlockhash`, `sendTransaction`, `getSignatureStatuses`) to Solana's free public endpoints (owner's answer 4), with new tries spaced out and a second public endpoint when the first fails;
  - read back with `getTransaction`: the memo on chain must be exactly the one sent, signed by the notary;
  - `docs/proofs.md` says when to move to a provider (for example when a night needs more than three tries several times in a week), and how.
- **The network:** devnet all week (`SOLANA_CLUSTER=devnet`); mainnet only at task 6, after the review (owner's answer 3). A key made for devnet is never used on mainnet.

What it does not do:
- No other program, no account created, no token, no transfer to anyone.
- The key never leaves the server: no copy in GitHub, in the CI, in a backup or in the conversation.
- Nothing in the player's wallet.

How it is tested:
- the transaction's bytes and the Memo instruction against the examples of Solana's official documentation (the format of a transaction and of its message, the compact lengths, the Memo program); with a throwaway key, its signature checks with Node's Ed25519;
- a fake RPC server in the tests (no network in the CI): an answer refused, late, never confirmed, a first endpoint down;
- the key never appears in a log line, an error or an answer;
- the independent review, then once, by hand, on devnet from the server: a real transaction, its signature and its link on `explorer.solana.com` sent to the owner.

**Done (22 October), owner's go of 22 October for tasks 3 to 5 on devnet.**
- `deploy/notary-key.sh devnet|mainnet` runs `server/src/proofs/keygen.ts` in a throwaway container of the server's image, with no network and no Docker log (Node is not on the machine). The two lines it prints are read into a bash variable, never onto the screen, with no other program and no temporary file. The key goes into `deploy/.env` (mode 600) as `NOTARY_KEY_DEVNET` or `NOTARY_KEY_MAINNET`. Only the address is shown. An existing key is never replaced, and nothing is written when anything fails. `keygen.ts` refuses to print to a terminal.
- `server/src/proofs/key.ts`: `SOLANA_CLUSTER` picks the only variable read. Both key variables leave the environment as soon as they are read. The same key on both networks is refused. A malformed key turns the notary off, with a reason that names the variable, never its value. The key lives only in a Node key object, and printing the notary shows its network and address.
- `transaction.ts`: the Memo transaction, byte by byte. It is identical, to the byte, to the one Solana's own SDK builds (solders 0.27.1, run once outside the repository: `server/test/fixtures/memo-tx-solders.json`). It follows the field table of Solana's documentation and RFC 8032's signature. A real devnet node simulated it and verified its signature (`AccountNotFound` only, as the throwaway key had no SOL). One byte changed in the signature or the memo gives `SignatureFailure`. The devnet faucet refused this session's address (its daily limit), so the first real transaction is the server's.
- `rpc.ts`: the public endpoints, 4 tries 1, 3 and 9 s apart on the next endpoint. Each endpoint's genesis hash is checked before use, and one of another network is never used again. Errors name the endpoint's host only.
- Tests: `server/test/transaction.test.ts`, `notaryKey.test.ts` (the script run for real with a fake `docker`), `notary.test.ts`, against a fake Solana network (`server/test/fakeSolana.ts`).

## Task 4 · The nightly seal (protected)

What it does:

- **Every night at 00:15 UTC** (after `s1`'s reset, owner's answer 10), on real time, never sped up by `DEV_SPEED`:
  - the server takes the milestones not yet sealed (migration `0005`: the seals and the link of each milestone to its seal);
  - it builds their root, sends its memo, waits until the transaction is finalized, then writes the transaction's signature on the seal. Nothing to seal: no transaction.
- **One seal per night, never two:**
  - the transaction is written before it is sent;
  - after a restart or an error, the server first asks the chain what became of it, and sends a new one only if the first can no longer land (its blockhash expired);
  - it tries again every hour until it lands.
- **`/health` says how the notary is:**
  - `notary: ok`, `late` (no seal for more than 26 hours while milestones wait), `low` (less than 0.005 SOL), or `off` (no key);
  - the `watch` workflow then alerts on `late` and `low`, as it does for the backups.

What it does not do: it never seals a milestone twice, never seals a day not yet ended, and never spends more than the transaction's fee.

How it is tested:
- with the fake RPC and a fake clock: a quiet night, a night with nothing, the RPC down for 3 hours, a restart between the sending and the confirmation, an expired blockhash;
- in every case: one root on chain a night at most, and each milestone sealed exactly once;
- `/health` in each state;
- the independent review of the diff.

**Done (22 October).**
- `server/src/proofs/seal.ts` and migration `0005_seals` (`seals`; `proofs.seal_id` and `position`). Every 5 minutes, on real time, the server follows the seals sent. From 00:15 UTC it seals the milestones recorded before midnight. The seal and its signed transaction are written before the sending. The index `seals_one_a_night` allows one `sent` or `finalized` seal a night per network. A seal still able to land is only sent again as it is. Its milestones go back only once its blockhash is 150 blocks past its last valid height (`expired`), or if it landed with an error (`failed`, 3 a night at most). A finalized seal is read back from the chain and compared with what was written.
- `/health` gets `notary`: `ok`, `late`, `low`, `unlisted` or `off` (only `off` leaves `ok` true). `watch.yml` alerts on the others. `compose.yaml` passes `SOLANA_CLUSTER`, the two key variables and `SOLANA_RPC_URLS`. `GET /proofs` (task 5) is in this commit too.
- Tests: `server/test/seal.test.ts`, on PGlite and on PostgreSQL in the CI. It covers a quiet night, a night with nothing, the network down 3 hours, a sending that fails, a restart, a lost transaction, two processes at once, an empty notary, 3 failures, `/health`, `GET /proofs`, and the key looked for through a whole night in the logs, errors, HTTP answers and every table.

## Task 5 · Your proofs, in the game

What it does:

- **`GET /proofs`** (signed in): the player's milestones, each with:
  - its leaf, salt, path and root;
  - the transaction's signature, or "waiting for tonight's seal".
- **In the Profile, "Your proofs":** one line per milestone, for example "Lighthouse 10 · 21 October 2026 · Sealed on Solana", or "Lighthouse 5 · by 23 October 2026".
  - **The notary's official address**, written in full, with "Only this address seals Brinelight's proofs." and a link to `docs/proofs.md` for the old ones.
  - **Check:** the client recomputes the leaf and the path with the browser's Web Crypto, and shows "This proof matches the seal", or what does not.
  - **See it on Solana:** opens the transaction on `explorer.solana.com` (owner's answer 7), where the memo, its root and the notary's signature can be read.
  - **Save the proof:** a small JSON file.
- **`npm run proof:check -- <file>`** (`tools/proof/`): checks a saved proof against the chain itself, through any public RPC, without our server: the transaction exists, is finalized, is signed by a notary address listed in `docs/proofs.md` for that day, and its root matches.

What it does not do:
- No sharing on social networks.
- No public page of a player's proofs.
- Nothing sent to the wallet.

How it is tested:
- client tests on the task 1 vectors, and on a proof changed by one byte;
- `proof:check` against the fake RPC, with a transaction signed by an address that is not the notary's (refused);
- an e2e: a Lighthouse that ends, the night sealed by the fake notary, the line in the Profile, "Check" green;
- look captures of the Profile (412 and 360), shown before their references are made again.

**Done (22 October).**
- "Your proofs" shows only once you have a proof. Before that, the Profile is exactly as it was, and its look references do not move. The notary's address comes from the game's own list (`NOTARIES`, `shared/src/rules/notary.ts`). Until it is published there, the section says so in red. **Check** uses Web Crypto, **See it on Solana** opens `explorer.solana.com` (`?cluster=devnet`), **Save the proof** gives a JSON file.
- `npm run proof:check -- <file>` (`tools/proof/`).
- Tests: `client/test/proofs.test.ts`, `tools/proof/check.test.ts`, `shared/test/proofs.test.ts`, and one e2e: Lighthouse 5 recorded, sealed by the harness's fake notary, shown, checked, saved, and the file holds against the chain. Captures `shot-profile-proofs-412` and `-360` are in the e2e artifact, not references.

## The independent review of tasks 3 and 4 (22 October)

A separate agent, which had not written the code, read it to find flaws: the key leaking, the wrong network, a seal sent twice, the money spent, the transaction's exact content. It ran the tests and a scratch test of its own. What it found, and what was done:

| # | Finding | Done |
| --- | --- | --- |
| H1 (high) | A seal that landed could be judged lost by an endpoint without transaction history, and then sealed again with no limit, every 5 minutes. Its own test showed 6 transactions for one night. | Fixed. A seal is given up only if the node's history, asked directly, confirms the transaction is not there. A node without history answers with an error, and nothing is given up. Lost seals now count in the cap of 3 tries a night. Tested with a fake node without history: one transaction. |
| M1 | The key went through Docker's log file on disk while it was made. | Fixed. The key is made with `docker run --log-driver none --network none` on the server's image: no log, no network, no setting from `.env` in that container. |
| M2 | Once the server runs, the key is in the container's environment: `docker inspect`, `docker compose config`, `/proc/1/environ`. | **A question for the owner.** It follows the owner's choice of `deploy/.env`. Docker's secrets would mount it as a file instead, out of the container's environment. Warned in `docs/deploy.md` and in the checklist. |
| M3 | Moving from devnet to mainnet would leave the milestones sealed on devnet unsealed on mainnet, and `/health` blind to it. | `/health` now counts as waiting a milestone sealed on another network. Sealing them again on mainnet, with new salts, is task 6's job (below). |
| M4 | A player deleted would break the proofs of the others in the same seal (not reachable yet: there is no deletion). | Fixed. Each seal keeps its list of leaves (`seals.leaf_hashes`), and `GET /proofs` builds the paths from it. Tested. |
| L1 | Giving up or finalizing a seal was not guarded against a second server process. | Fixed. Both act only on a seal still `sent`. |
| L2 | A failure was believed before it was finalized. | Fixed: only once finalized. |
| L3 | One seal that could not be followed stopped all sealing. | Fixed. Each seal is followed on its own, and an error is logged. |
| L4 | Pitfalls in the script: the file rewritten in place, `chmod` after the key, a missing last end of line, `.env` holding only the empty line, `bash -x`. | Fixed and tested, each one. |
| L5 | `/health` and `GET /proofs` could load the database. | `/health` asks the notary's state at most once a minute. `GET /proofs` reads the leaves from the seal, with no query per leaf. |
| Note | The key could sign any bytes. | Fixed. It can sign only a seal (`NotaryKey.signSeal`): it builds the Memo transaction itself. |

Found sound by the review: the transaction's bytes; the wrong network made impossible; no key in `ps`, the shell's history, the terminal, logs, errors, the database or its backups; one seal a night on the normal paths; SQL with parameters only; `GET /proofs` limited to your own rows; nothing personal in the memo; the seal on real UTC time.

## Task 6 · On mainnet

What it does:

- **The milestones sealed on devnet, sealed again on mainnet:** a migration gives each a new salt and a new leaf, and takes it out of its devnet seal. The first mainnet night seals them all. The devnet seals stay in the table, as a record.

- **Before:** the owner goes through the checklist in plain French of `docs/proofs.md` (task 3 and 4's review), and says yes.
- **Then:**
  - the owner runs `deploy/notary-key.sh` for mainnet on the server; Claude Code gives the owner the public address it prints, and the owner sends it 0.02 SOL from Phantom;
  - `SOLANA_CLUSTER=mainnet`; the first night sealed on mainnet, its link sent to the owner.
- **If the key is lost** (the server lost, the key leaked):
  - a new key is made on the server, and its new address is published in `docs/proofs.md` and in the game, with the history of the old ones and the days each one sealed;
  - the proofs already sealed stay checkable: they are signed by an old address that stays listed for its days;
  - a leaked key is listed with the day it leaked: what it signs after that day is not ours;
  - the key is never copied off the server, so there is no copy to lose or steal.
- **The documentation:**
  - `docs/deploy.md`: the notary's key, its funding, the loss of the key;
  - `docs/proofs.md`: the mainnet address;
  - `docs/decisions.md`: one line per decision of the week.

What it does not do: no seal of the devnet's milestones on mainnet. Those of the week are sealed again on the first mainnet night, with new salts.

How it is tested:
- `proof:check` on the first mainnet proof, from another machine than the server;
- `/health` reports `notary: ok` the next morning.

## Not this week

- Payments in USDC, and checking their transactions (week 14, protected; a human Solana developer's review first).
- Badges and cosmetics as NFTs, or anything sent to the player's wallet.
- The seal of the seasons and the Guardians of the Great Lighthouse (week 13). They will be new kinds of fact in the same format.
- The verifiable draw of the daily recruitment (week 15). The notary built here will serve it.
- The embedded wallet.

## The owner's answers (22 October)

1. **What is proved first:** the Lighthouse's milestones 5, 10, 15, 20, 25 and 30. The format must take other kinds later (Guardians of the Great Lighthouse, the seasons of the Tides) without a new version.
2. **What a leaf is tied to:** the wallet, with a random salt, then hashed.
3. **The network:** devnet all week, mainnet at task 6.
4. **The RPC:** Solana's free public endpoints, with new tries, and a note in `docs/proofs.md` to move to a provider if the sending fails often.
5. **The transaction:** built by hand, with no new dependency, signed with Node's Ed25519 (`node:crypto`). Tested against the examples of Solana's official documentation (the serialization, the Memo instruction), then for real on devnet.
6. **The SOL:** 0.02 SOL, an alert under 0.005. The owner sends it from Phantom; Claude Code gives only the public address, when the time comes.
7. **The explorer:** `explorer.solana.com`.
8. **The review of tasks 3 and 4:** the owner is not a developer. This week: an independent review by a separate agent that did not write the code and looks for the flaws (the key leaking into a log, an error or a backup; the wrong network; a double seal; the amount; what the transaction carries), and a checklist in plain French that the owner goes through before mainnet. Before the USDC payments, a review by a human Solana developer will be required.
9. **The milestones already passed:** dated "by" the day of their next save.
10. **The seal's hour:** 00:15 UTC.

Also asked: the notary's official address published in `docs/proofs.md` and shown in "Your proofs"; and the loss of the key (a new key, its address published with the history of the old ones, the proofs already sealed still checkable, no copy of the key off the server).
