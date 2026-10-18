# Week 8 · The game server online

Goal of the week: the game server runs on a Hetzner machine, at `https://api.brinelight.xyz`, with the game at `https://play.brinelight.xyz`. Its database is backed up every night, a restore is tested on its own every week, and you get an e-mail when the server is down. The kit has been ready since week 4 (`deploy/`, `docs/deploy.md`) and the CI starts it on every push. This week makes it real, then measures how many players one machine holds. Three smaller tasks follow: the Mist and Leviathan hours per server, the CI actions on Node 24, and the other buildings that pass the storage.

Do the tasks in order, one per session. For each one: read CLAUDE.md, say what you will do and what you will not do, wait for approval, write the code, run `npm run check` (and `npm run e2e` when the client changes), commit, push. One pull request for the whole week.

## For every task this week

- **Secrets never leave the server.** `deploy/.env` (the database password, the e-mail for the certificates), the SSH private key, the `brinelight` user's password, and the Hetzner, Vercel and Cloudflare logins: only you type them, on the server or in the provider's console.
  - Claude Code never reads, shows, asks for or commits them.
  - When something fails, you send command outputs that hold no secret: `docker compose ps`, `/health`, the last lines of `docker compose logs`. The server's logs never contain a session token.
- **No new dependency.** Everything below uses what the repository and the server already have: Node, Docker, Caddy, PostgreSQL, systemd, GitHub Actions. A paid service or a new account is a question for you (at the end), never a default.
- **No change to the rules of the game**, except in task 4 (the hours) and task 6 (only if you choose an option).
- **Protected areas stay untouched:** sign-in and sessions, payments, `comfort.ts`, `RECRUIT_ODDS`.

## What it costs

Hetzner prices since 15 June 2026, excluding VAT. They come from a price tracker (costgoat.com, updated September 2026), not from Hetzner's own page, which does not show them without an account. You check them in the Hetzner console before creating the server; `docs/decisions.md` still says "about €5", from week 4.

| Item | What | € a month (excluding VAT) |
| --- | --- | --- |
| Server | Hetzner Cloud **CX23**: 2 vCPU, 4 GB RAM, 40 GB SSD, 20 TB traffic, Germany | 5.49 |
| IPv4 address | Needed: many players have no IPv6 | 0.50 |
| Hetzner Backups | The whole server, once a day, the last 7 kept, outside the machine (20 % of the server's price) | 1.10 |
| PostgreSQL | On the same machine, in Docker: nothing more to pay. Hetzner sells no managed database. | 0 |
| HTTPS certificate | Let's Encrypt, through Caddy | 0 |
| The game itself | Cloudflare Pages, free plan | 0 |
| Down alert | GitHub Actions on a public repository (task 1); or Better Stack, free plan | 0 |
| **Total** | | **7.09**, about **€8.50 with VAT** (VAT is your country's) |
| Domain `brinelight.xyz` | Already bought at Vercel; renewed once a year (price in your Vercel account) | – |
| *Optional:* Storage Box BX11 | 1 TB elsewhere at Hetzner for the nightly dumps (question 3) | *about 3.20* |

**Why the CX23:**
- It is the cheapest machine with room for PostgreSQL, Node and Caddy together (4 GB of memory).
- Its 40 GB disk holds years of cities: a city is a JSON document of a few kilobytes.
- The CAX11 (ARM, same size) costs more since June 2026 (€5.99), and the server image would have to be built for ARM.
- Task 3 measures what it really holds before anyone plays on it.

**What costs more when players come,** in the order it would happen:

| When | What changes | € a month (excluding VAT, IPv4 and Backups included) |
| --- | --- | --- |
| Task 3 shows the CX23 busy (processor over 70 % at the busy hour) | One click in the console, a few minutes offline: **CX33** (4 vCPU, 8 GB, 80 GB). The data stays. | about 10.70 |
| Twice that | **CX43** (8 vCPU, 16 GB, 160 GB) | about 19.70 |
| The database alone fills a machine | PostgreSQL on its own CX23 or CX33, on a private Hetzner network, no IPv4 | about +7 to +10 |
| Several game servers | A Hetzner load balancer in front (weeks 9 to 13 decide how cities are shared out) | a few euros, price to check then |

The 20 TB of traffic a month is far beyond a game that sends small JSON documents.

---

## Task 1 · Ready to rent (code, before the server exists)

What it does:

- **`/health` tells the truth.**
  - Today it answers `{"ok":true}` even when the database is down.
  - It will run a one-line query (`select 1`, with a 2-second limit) and answer `{"ok":false,"database":"down"}` with the status 503 when it fails.
  - It also says whether the last nightly backup is less than 26 hours old: `backup.sh` writes the time of its last success in a small file, which the game server reads through a read-only folder. Only a date, never the dump. A late backup gives `"backup":"late"` and `"ok":false`.
  - A single check then catches the three failures: the server down, the database down, the backups stopped.
- **A restore tested every week, on its own.**
  - A second systemd timer runs `restore.sh test` every Sunday at 04:30 UTC: the latest dump goes into a temporary database and is compared with the live one, as you do by hand today.
  - A failure makes the next `/health` say `"restore":"failed"` and `"ok":false`, so the down alert warns you.
- **The down alert, free and with no new account:**
  - A GitHub Actions workflow (`.github/workflows/watch.yml`) calls `https://api.brinelight.xyz/health` every 10 minutes and fails when the answer is not `"ok":true`. GitHub e-mails you when a scheduled run fails.
  - It is turned off while `api.brinelight.xyz` does not exist: it starts when you set the repository variable `API_URL` (task 2).
  - The limit: GitHub can delay a scheduled run by several minutes at busy times. Better Stack's free plan checks every 3 minutes, with a new account (question 4).
- **`docs/deploy.md` brought up to date:**
  - today's prices;
  - the new `/health`;
  - the weekly restore;
  - the alert, in place of UptimeRobot, whose free plan is for non-commercial use only since late 2024 (Brinelight will sell cosmetics);
  - how to go back to the previous version after an update (the backup that `update.sh` makes first, and the commit to return to).

What it does not do:
- It does not rent anything.
- It does not deploy from the CI.
- It does not copy the backups off the machine (question 3).
- It does not touch sign-in, sessions or the rules of the game.

How it is tested:
- Server tests:
  - `/health` with the database up;
  - the database stopped (PGlite closed);
  - a backup 25 hours old, then 27 hours old;
  - a failed restore.
- The CI's `deploy` job, which already starts the whole stack:
  1. a backup;
  2. `/health` says `"backup":"ok"`;
  3. the database stopped, `/health` says 503;
  4. the weekly restore unit started by hand, which must succeed.
- `shellcheck` on the scripts.
- The watch workflow is run once by hand on a fake address and must fail.

## Task 2 · Online (you, step by step; Claude Code guides and checks)

Nothing to code. Each step is in `docs/deploy.md`, with what you should see. At the end of each step, send the output it asks for: never a password, a key or the content of `.env`.

1. **Create the Hetzner account** at accounts.hetzner.com.
   - Hetzner may ask you to prove who you are (an ID or a payment): it is normal for a new account.
   - Turn on two-factor sign-in in the account settings.
2. **Pay:**
   - add a card or PayPal in **Billing**;
   - Hetzner bills by the hour, capped at the monthly price, and sends one invoice a month.
   - Create a **project** named `Brinelight` in the Cloud console.
3. **Create your SSH key** on your computer (`docs/deploy.md`, step 1). The private key never leaves your computer.
4. **Create the server** (step 3):
   - CX23, Ubuntu 24.04, Nuremberg or Falkenstein;
   - your public SSH key;
   - **Backups ticked**.
   - Send the server's IPv4 (it is not a secret).
5. **Point `api` to the server** at Vercel (step 4), then check with dnschecker.org.
6. **Prepare the server** (step 5):
   - `setup-server.sh`, then close SSH to your key only with `harden-ssh.sh`;
   - you choose the `brinelight` password and keep it in your password manager.
7. **Fill in the settings** (step 6):
   - on the server, `openssl rand -hex 32` makes the database password, and you paste it into `deploy/.env` with `nano`;
   - nobody else sees it, Claude Code included.
8. **Start** (step 7). Send the output of `docker compose ps`, and what `https://api.brinelight.xyz/health` shows.
9. **Backups** (step 8):
   - `sudo ./install-backup.sh`, which now installs the weekly restore too;
   - one backup by hand, then `sudo ./restore.sh test`. Send its last three lines.
10. **The game on `play.brinelight.xyz`** (step 9):
    - Cloudflare Pages first, then the `CNAME` at Vercel;
    - then `VITE_API_URL` for Production only.
11. **The alert:**
    - in GitHub, the repository → **Settings → Secrets and variables → Actions → Variables**: `API_URL` = `https://api.brinelight.xyz` (a variable, not a secret: the address is public);
    - test it: `docker compose stop server`, wait for GitHub's e-mail, then `docker compose start server`.
12. **The test of the week** (step 10): the same city on your phone in Phantom and on your computer.

What it does not do: no player is invited yet (task 3 comes first); no deploy key in GitHub.

How it is tested: the checklist above. Each step has its expected output, and Claude Code compares what you send with it.

## Task 3 · How many players one CX23 holds (the load test)

What it does:

- **A script, `tools/load/`, in Node with no new dependency.**
  - It plays N simulated players against a server.
  - Each one signs in with its own throwaway Ed25519 key, made with Node's `crypto`, as the e2e's test wallet does.
  - Each one then sends actions at a human rhythm: an upgrade, a fleet, a claim every 20 to 60 seconds, and a `GET /city` at each "launch".
  - It reports:
    - the answers per second;
    - the slowest 1 % (p99);
    - the refusals and errors;
    - the processor and memory of the machine (read with `docker stats` on the server).
- **Run on the real server, before it opens:**
  - 100, then 250, then 500 players for 10 minutes each;
  - then the database is put back as it was before the test with `restore.sh replace` and the backup made just before;
  - the result goes into `docs/perf.md`, with the threshold at which to move to the CX33.

What it does not do:
- No test against Cloudflare.
- No test of Solana.
- No change to the server's limits, unless a measure shows one refuses real play (then a question for you).
- The script never runs in the CI against the real server.

How it is tested:
- The script itself runs in the CI against the local stack with 20 players for 30 seconds: no error, no refusal other than the rules'.
- Its accounts are made only with keys it creates and forgets.

## Task 4 · The Mist and the Leviathan by server, not fixed UTC hours

Today the Mist comes at 04:00, 12:00 and 20:00 UTC, the Leviathan rises at 13:00 and 19:00 UTC, and the day resets at 00:00 UTC. These hours were provisional (`docs/decisions.md`).

What it does:

- **A list of servers in the rules** (`shared/src/rules/servers.ts`).
  - Each server has a name, its Mist hours, its Leviathan hours and its daily reset hour.
  - Today there is one: `s1`, with your hours (question 7).
  - The calendar is in the rules, not in a `.env`, because the client reads the same calendar to draw the countdowns.
- **The city knows its server** (`server: "s1"`).
  - City shape 10, with its migration: the cities stored before get `s1`, and `s1` keeps today's hours unless you choose others.
  - `mistAt`, `huntAt` and the daily reset read the city's server.
  - The server sets it when the city is made; the client never sends it.
- **What changes if `s1`'s hours change:**
  - A Mist or a hunt going on is never cut short: the change applies from the next one.
  - The day of the Daily Tasks changes at the next reset.

What it does not do:
- No choice of server by the player.
- No second server.
- No moving a city between servers.
- No time zone shown to the player: the countdowns already say "in 52 min".

How it is tested:
- Rules tests: two servers with different hours give their own Mists and hunts.
- `advance` in one long step equals many short ones.
- The migration test from shape 9.
- A server test: a client that sends `server` is refused.
- The e2e Mist and Leviathan scenarios still pass.

## Task 5 · The CI's actions on Node 24

`actions/checkout@v4`, `actions/setup-node@v4` and `actions/upload-artifact@v4` run on Node 20. GitHub warns on every run, and already forces them onto Node 24.

What it does:

- Each action moves to the first major version that runs on Node 24, read in its own release notes. To be checked when the task is done:
  - `checkout@v5`;
  - `upload-artifact@v6`, because its v5 still ran on Node 20 by default;
  - `setup-node`: the first version whose release notes say Node 24.
- Each version is pinned to its full commit (the 40-character SHA), with the version as a comment, if you choose it (question 6).
- One line in `docs/decisions.md`, and the open question about Node 20 removed.

What it does not do:
- It does not change the Node of the game (22) or of the server image.
- It does not change what the jobs run.

How it is tested:
- The CI is green on the four jobs.
- The e2e artifact is still uploaded with its hidden folder `e2e/.shots/`.
- No line "Node.js 20 is deprecated" left in the logs.

## Task 6 · The other buildings and the storage (measure, then you choose)

The other buildings keep ×1.6 a level, while the storage follows the Lighthouse. Even at Lighthouse 30 with Sealed Warehouses 3, the Barracks, Harbor or Observatory cost more than the storage holds from level 21, the Fishery and Lumberyard from 23 (`docs/decisions.md`, open question of week 6). The players of the simulation are at level 14 to 18 after a year: no one meets it yet.

What it does:

- Measure three options on temporary copies of the rules, with the simulation over two years. Nothing is applied before your choice.
  - **A. The other buildings follow the Lighthouse's curve past level 15:** ×1.3 in cost and ×1.2 in time a level.
  - **B. The cost of a level never passes 80 % of the storage at that Lighthouse level:** the curve flattens only where it would block.
  - **C. Nothing changes;** the buildings stop at level 20 for now, with levels added later.
- For each option:
  - the level of each building after one and two years;
  - the Lighthouse's milestones, which must stay within 10 % of week 6 (the test of week 7);
  - the wood and time a player spends on the other buildings.
- Then the chosen option, applied as a balance change: the tests, `npm run balance`, and its line in `docs/decisions.md`. It comes with a test that every building's next level fits in the storage at every level it can reach.

What it does not do: no change to the Lighthouse, the storage or the research.

How it is tested: the measures in a table, before anything is applied. Once you have chosen, the new test, the test of the milestones, and `npm run check`.

---

## Not this week

- Deploying from the CI (question 2).
- A second region, or a test server.
- Multiplayer (weeks 9 to 13).
- The first proof on Solana, planned for week 8 in the roadmap of 17 October (question 8).
- Payments.
- The daily recruitment (week 15).

## Questions for you

1. **The machine:** the CX23 in Germany (€7.09 a month with IPv4 and Backups, excluding VAT), after checking the price in the Hetzner console. Or do you prefer to start with the CX33 (about €10.70)?
2. **Deploying:**
   - by hand for now: one command on the server, `~/brinelight/deploy/update.sh`, after each merge of a week's pull request;
   - or from the CI, which needs an SSH key for GitHub stored in GitHub's secrets, and a server that accepts it. I propose by hand until players are there.
3. **The backups off the machine:** the nightly dumps live on the server, and Hetzner Backups copy the whole server every day, outside it. Is that enough for now, or do you want a Storage Box BX11 (about €3.20 a month, to confirm) that receives a copy of each night's dump?
4. **The alert:** GitHub Actions every 10 minutes (free, no new account, sometimes late), or Better Stack's free plan (every 3 minutes, an account to create; its terms to check for a game that sells something)?
5. **The load test:** on the real server before it opens, with the database put back afterwards (my proposal)? Or on a second CX23 rented for one hour (a few cents, then deleted)?
6. **The CI's actions:** pinned to their full commit (safer: a tag can be moved), or to their major version (simpler to read)?
7. **The hours of server `s1`:** keep today's (Mist 04:00, 12:00, 20:00; Leviathan 13:00, 19:00; reset 00:00 UTC), or choose them for your players' evenings (for example, in Paris time: Leviathan at 12:30 and 20:30, reset at 05:00)?
8. **The first Solana proof**, planned for week 8 in the roadmap: leave it for week 9, since putting the server online is the heart of this week?
9. **The other buildings:** the three options are measured first. Is there one you want to rule out before measuring?
