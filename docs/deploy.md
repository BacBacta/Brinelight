# Putting Brinelight online

This guide takes you from nothing to a game server online at `https://api.brinelight.xyz`, with the game at `https://play.brinelight.xyz`. It is written for a first time: copy each command, and compare with what you should see.

**The server is online since 22 October 2026** (steps 1 to 9 done by the owner, step 11 on): a CX23 in Germany, Ubuntu 24.04, SSH by key only. This guide is kept as it was really done, for a new server or a second one. The notes below come from that first installation (owner, 22 October):

- **A key for this server only**, `~/.ssh/brinelight`, never your everyday key: every `ssh` command below has `-i ~/.ssh/brinelight`.
- **It can all be done from an Android phone, in Termux** (step 1 says how).
- **Always look at the prompt before typing a command.** Your phone or computer, the server as root, or the server as `brinelight` each have their own (step 5.1 shows them). A command typed in the wrong place does nothing good.
- **After the setup script, restart the server if it says `System restart required`** (step 5.1).
- **Never run `do-release-upgrade`**, even when Ubuntu suggests it at each login: the server stays on Ubuntu 24.04 until a move is planned on purpose (step 5.1).

The domain `brinelight.xyz` was bought at Vercel, and its DNS stays at Vercel. Everywhere below, replace `203.0.113.10` with your server's IPv4 address.

Only two names are used: `api.brinelight.xyz` (the server) and `play.brinelight.xyz` (the game). The bare domain `brinelight.xyz` is not used for now.

## What you will have

```
Players ──https──> play.brinelight.xyz  (Cloudflare Pages: the game itself)
        ──https──> api.brinelight.xyz   (your Hetzner server)
                     └─ Caddy  (HTTPS certificate, ports 80 and 443)
                          └─ game server  (not reachable from outside)
                               └─ PostgreSQL 18  (not reachable from outside, no Internet access)
```

- Cost, excluding VAT (Hetzner's prices since 15 June 2026, from a price tracker: check them in the Hetzner console before creating the server):

  | Item | € a month |
  | --- | --- |
  | Hetzner Cloud **CX23** (2 vCPU, 4 GB, 40 GB, Germany) | 5.49 |
  | Its IPv4 address | 0.50 |
  | Hetzner Backups (20 % of the server's price) | 1.10 |
  | PostgreSQL, the certificate, the game on Cloudflare Pages, the down alert on GitHub Actions | 0 |
  | **Total** | **7.09**, about €8.50 with VAT |

  The domain is already bought (renewed once a year at Vercel). When players come, the next step is the CX33 (about €10.70 a month), one click in the console.
- Everything on the server runs in Docker. The settings live in one file on the server, `deploy/.env`, never in the repository.

## The order

| Step | Where | What |
| --- | --- | --- |
| 1 | Your computer | Create your SSH key |
| 2 | Vercel | The domain: already bought, nothing to do |
| 3 | Hetzner | Create the server, with Backups |
| 4 | Vercel | Point `api` to the server |
| 5 | Server | Prepare it, then close SSH to your key only |
| 6 | Server | Download the game and fill in the settings |
| 7 | Server | Start, and check |
| 8 | Server | Nightly backups, and a test restore every week |
| 9 | Cloudflare, then Vercel | `play.brinelight.xyz` and the server address for the game |
| 10 | Your phone and computer | The test of the week |
| 11 | GitHub | Be warned if the server goes down |

The rest of the guide is for later: updating, restoring, solving problems.

---

## Test with a real wallet without a server

On Windows, `deploy/local-test/START-TEST.bat` does all the steps below for you (double-click it; `STOP-TEST.bat` stops everything). It was used for the first Phantom test on 2026-10-16.

To try research and rafts on your phone without waiting hours, double-click `START-TEST-FAST.bat` instead: the same test, with the account's city 1000 times faster (the server's `DEV_SPEED=1000`). From a new city, the resources for the Lighthouse level 4 that rafts need are the long part: at 60 times faster the first raft is moored after about 1 h 50, at 1000 times faster after about 7 minutes (simulated with the rules: Observatory and Refinery first, then the Refining research, the Lighthouse levels 3 and 4, and the raft). The window shows the speed at start (`Game speed: 1000 times faster than real time`), and again next to the game address. It is the parameter `-Speed` of `start-test.ps1` (1 by default, real time). Only a signed-in city is sped up: a city played without an account keeps real time. The server refuses any speed other than 1 in production, so this is for this local test only.

By hand (the terminals below), the same is `DEV_SPEED=1000` before `npm run dev:server` (PowerShell: `$env:DEV_SPEED="1000"`).

On an Android phone, the whole test can run in Termux, with no computer: `deploy/local-test/start-test-termux.sh` does the same as `START-TEST.bat`, then opens the game in Phantom's browser. Once: `pkg install -y git nodejs-lts cloudflared`, then `git clone https://github.com/BacBacta/Brinelight.git ~/Brinelight` (one line at a time: a line pasted while `pkg` is still running is lost). Each test: `cd ~/Brinelight && git pull --ff-only && bash deploy/local-test/start-test-termux.sh 1000` (`1000`: the account's city 1000 times faster; without it, real time). Ctrl+C stops everything (in Termux: Volume down + C). The script keeps the phone awake while you are in Phantom (`termux-wake-lock`); if Android still closes Termux, set its battery use to "Unrestricted". The same script works on Linux and macOS.

This test runs everything on your own machine, without the real server (online since 22 October 2026). You can test signing in with Phantom on your phone from your own computer, for free, through two temporary Cloudflare tunnels. A tunnel gives a local program a public `https://….trycloudflare.com` address, with no account and nothing to configure.

Everything stays on your computer: the database is in memory (PGlite) and is lost when you stop the server. That is fine for a test.

### Once: install cloudflared

- macOS: `brew install cloudflared`
- Windows: `winget install --id Cloudflare.cloudflared`
- Linux: the `.deb` or the binary from github.com/cloudflare/cloudflared/releases

### Each test: five terminals, in this order

In the repository folder, after `npm install`.

**1. Tunnel for the server.** In terminal 1:

```
cloudflared tunnel --url http://127.0.0.1:8787
```

After a few seconds it prints an address like `https://tall-river-word-word.trycloudflare.com`. That is the **API address**. Keep the terminal open.

**2. Tunnel for the game.** In terminal 2:

```
cloudflared tunnel --url http://127.0.0.1:4173
```

It prints another address: the **game address**.

**3. The server**, allowed to be called only from the game address. In terminal 3 (macOS, Linux):

```
ALLOWED_ORIGINS=https://<game address> TRUSTED_PROXY=127.0.0.1 npm run dev:server
```

On Windows (PowerShell):

```
$env:ALLOWED_ORIGINS="https://<game address>"; $env:TRUSTED_PROXY="127.0.0.1"; npm run dev:server
```

The game address goes without a final `/`. `TRUSTED_PROXY` tells the server that the tunnel, on your own computer, is the only one allowed to say who the player is.

**4. The game, built with the API address.** In terminal 4 (macOS, Linux):

```
VITE_API_URL=https://<API address> npm run build
npm run preview -w client -- --host 127.0.0.1
```

On Windows (PowerShell): `$env:VITE_API_URL="https://<API address>"; npm run build`, then the same `npm run preview` line.

**5. Check the server through its tunnel.** In terminal 5, or in any browser: `https://<API address>/health` must answer `{"ok":true,…}`.

### On your phone

1. Open the **game address** inside Phantom's browser (in Phantom: the browser tab, then type the address). In Chrome, the Profile also offers "Open in Phantom".
2. Tap the Power card (top left), then "Sign in with your wallet", and approve in Phantom.
3. Check:
   - **the sign-in is accepted**: a toast says "Signed in. Your city is saved on your account." (or "Your account has its own city…" if you played on this phone before signing in), and the Power card gets a green mark;
   - **the city is found**: upgrade a building, then reload the page. The upgrade is still there. In terminal 3 you see `POST /city/actions` then `GET /city` with `statusCode` 200.
4. If you have Phantom in a browser on your computer too, open the game address there and sign in with the same wallet: you see the same city.

### Stop everything

Press `Ctrl+C` in each terminal. The two addresses stop working at once, and the test accounts and cities are gone. Do not share the addresses while the test runs: anyone who has them can reach your computer's server.

### If it fails

Send Claude Code:

- **the exact message shown in the game** (a toast or the Profile). Each one belongs to one refusal code, for example "This message was made for another site" is `wrong_site`, "This page is not allowed to sign in to Brinelight" is `origin_not_allowed`, "This message does not match this sign-in. Please try again" is `wrong_issued_at`, "This sign-in message is not valid" is `invalid_message`;
- **the last 30 lines of terminal 3** (the server). They never contain your session token, nor anything secret.

Never send your wallet's recovery phrase or private key: neither Claude Code nor the game ever needs them.

## 1. Create your SSH key (on your computer or phone)

An SSH key is a pair of files. The **private key** stays on your computer and proves it is you. The **public key** goes on the server. Never share, copy or send the private key: not by mail, not to a chat, not to Claude, not into the repository.

Make a key **for this server only**, named `brinelight`, rather than using your everyday key: if it is ever lost, you replace this one alone.

On macOS or Linux, open the Terminal. On Windows 10 or 11, open PowerShell. On an Android phone, install **Termux** (from F-Droid), then once: `pkg install -y openssh` (wait until it ends before typing the next line). Then, in each case:

```
ssh-keygen -t ed25519 -f ~/.ssh/brinelight -C "brinelight"
```

- Choose a **passphrase** and keep it in your password manager. It protects the key if your computer or phone is stolen.

You now have two files: `~/.ssh/brinelight` (private, keep it) and `~/.ssh/brinelight.pub` (public). Show the public one:

```
cat ~/.ssh/brinelight.pub
```

You should see one line starting with `ssh-ed25519 AAAA…` and ending with `brinelight`. This line is the one you give to Hetzner.

Every `ssh` command of this guide names this key with `-i ~/.ssh/brinelight`. Without it, `ssh` tries your other keys, and the server, which accepts only this one, answers `Permission denied (publickey)`.

## 2. The domain (Vercel)

`brinelight.xyz` is already bought at Vercel, and its DNS stays there: nothing to do. The records are added in steps 4 and 9.

## 3. Create the server (Hetzner)

In the Hetzner Cloud console: **Create Server**.

- Location: Germany (Nuremberg or Falkenstein).
- Image: **Ubuntu 24.04**.
- Type: **CX23**.
- SSH keys: **Add SSH key**, paste the line from step 1, name it.
- **Backups: tick it.** Why both kinds of backup are needed is explained in step 8.
- Name: `brinelight`.

Create it, then note its **IPv4** address (for example `203.0.113.10`).

## 4. Point `api` to the server (Vercel)

In Vercel: **Domains → brinelight.xyz → Add record** (in the DNS records part).

- Type: `A`.
- Name: `api` only (Vercel adds `.brinelight.xyz` itself; do not type the whole name).
- Value: the server's IPv4, for example `203.0.113.10`.
- TTL: leave the default.

Vercel's DNS has no proxy: the name points straight to the server. That is what we want: Caddy, on the server, gets its HTTPS certificate directly, and sees the real address of each player (the sign-in limit counts per address).

Do not add an `AAAA` (IPv6) record for `api`: through Docker, IPv6 players would all appear with the same address.

### Check the record

After a few minutes, from your computer (macOS, Linux, or Windows with WSL):

```
dig +short api.brinelight.xyz
```

It must print the server's IPv4, and only it. Without `dig` (Windows), use `nslookup api.brinelight.xyz`, or open **dnschecker.org**, type `api.brinelight.xyz`, type `A`: the map should show the server's IPv4 almost everywhere. A new record can take up to an hour to be seen everywhere.

## 5. Prepare the server

### 5.1 Run the setup script, as root

From your computer or phone:

```
ssh -i ~/.ssh/brinelight root@203.0.113.10
```

The first time, it asks whether you trust the server: type `yes`.

**Look at the prompt (the text before your cursor) before each command.** It tells you where the command will run:

| The prompt looks like | You are on |
| --- | --- |
| `you@laptop ~ %`, `PS C:\Users\you>`, or `~ $` in Termux | your computer or phone |
| `root@brinelight:~#` | the server, as root (steps 5.1 only) |
| `brinelight@brinelight:~$` | the server, as `brinelight` (everything after step 5) |

Every command below says where it goes. When a connection closes (a restart, a timeout, `exit`), you are back on your computer or phone: check before going on. Then, on the server, as root:

```
curl -fsSLO https://raw.githubusercontent.com/BacBacta/Brinelight/main/deploy/setup-server.sh
curl -fsSLO https://raw.githubusercontent.com/BacBacta/Brinelight/main/deploy/harden-ssh.sh
bash setup-server.sh
```

The script:

- updates the system;
- creates your user `brinelight`, with your SSH key, and asks you to choose its password. Keep it in your password manager. It is asked only by `sudo`: SSH will never accept a password;
- installs Docker from Docker's own repository;
- turns on the firewall: only SSH (port 22, rate-limited: too many attempts from one address are refused for a while), HTTP (80) and HTTPS (443);
- turns on automatic security updates;
- sets the clock to UTC and keeps it synchronized. Sign-in refuses a message more than 5 minutes off.

At the end you should see `Status: active` with `22/tcp LIMIT IN`, `80/tcp ALLOW IN`, `443/tcp ALLOW IN`, `443/udp ALLOW IN`, and `System clock synchronized: yes`.

**If it also says `*** System restart required ***`** (the system update replaced the kernel), restart the server once the next command (`mv harden-ssh.sh …`) is done, still as root:

```
reboot
```

The connection closes: you are back on your computer or phone. Wait one minute, then connect again with `ssh -i ~/.ssh/brinelight root@203.0.113.10` and go on with step 5.2.

**Never run `do-release-upgrade`**, even when the server says at login that a new Ubuntu release is available. The server stays on Ubuntu 24.04: everything in this guide (Docker's repository, the scripts) is written and tested for it, and a release upgrade on a running server can leave it unable to start. Security updates still come every day by themselves.

Move the second script to your user:

```
mv harden-ssh.sh /home/brinelight/ && chown brinelight: /home/brinelight/harden-ssh.sh
```

### 5.2 Check your key, then close SSH

**Keep the root terminal open.** Open a **second** terminal on your computer (in Termux: swipe from the left edge, **New session**):

```
ssh -i ~/.ssh/brinelight brinelight@203.0.113.10
```

It must log you in without asking the server for a password (only your key's passphrase, if your computer asks for it). Then, in this second terminal:

```
sudo bash ~/harden-ssh.sh
```

It asks for the `brinelight` password, then shows:

```
permitrootlogin no
pubkeyauthentication yes
passwordauthentication no
kbdinteractiveauthentication no
allowusers brinelight
```

Check from a **third** terminal that it still works (`ssh -i ~/.ssh/brinelight brinelight@203.0.113.10`), and that root is refused (`ssh -i ~/.ssh/brinelight root@203.0.113.10` must say `Permission denied`). Only then close the root terminal. From now on, always connect as `brinelight`.

If something goes wrong, the Hetzner console (**Server → Console**) always lets you in, even without SSH.

## 6. Download the game and fill in the settings

As `brinelight` on the server. The repository is public, so it can be cloned without a key:

```
git clone https://github.com/BacBacta/Brinelight.git ~/brinelight
cd ~/brinelight/deploy
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
```

The last command prints a long random password: copy it. Then open the settings:

```
nano .env
```

Fill in:

```
API_DOMAIN=api.brinelight.xyz
ALLOWED_ORIGINS=https://play.brinelight.xyz
ACME_EMAIL=<your e-mail address>
POSTGRES_PASSWORD=<the password printed above>
SIWS_CHAIN_ID=mainnet
```

Save with `Ctrl+O`, Enter, then quit with `Ctrl+X`. This file stays on the server: never copy it anywhere else, never commit it.

## 7. Start, and check

Log out and back in once, so your user can use Docker (`exit`, then `ssh -i ~/.ssh/brinelight brinelight@203.0.113.10`). Then:

```
cd ~/brinelight/deploy
docker compose up -d --build
docker compose ps
```

The first start takes a few minutes. After it, `docker compose ps` shows three lines: `db` (healthy), `server` (healthy) and `caddy` (running, with ports 80 and 443).

Then, from your computer or your phone, open `https://api.brinelight.xyz/health`. Right now, before the first backup (step 8), you should see:

```
{"ok":false,"service":"brinelight","version":"0.1.0","database":"ok","backup":"none","restore":"none"}
```

That is expected: the server and its database work (`"database":"ok"`), and `/health` says no backup exists yet. After step 8 it says `"ok":true`.

The first certificate can take a minute. If it does not come, see "Solving problems" below.

### What `/health` checks

| Field | `ok` when | Not ok |
| --- | --- | --- |
| `database` | The database answers within 2 seconds | `down` |
| `backup` | The last nightly backup succeeded less than 26 hours ago | `late` (a night missed), `none` (never made) |
| `restore` | The last weekly test restore succeeded | `failed`. Before the first one: `none`, which does not count |
| `notary` | The notary on Solana (step 12) sealed every milestone recorded more than 26 hours ago, has 0.005 SOL or more, and its address is in the official list (`docs/proofs.md`) | `late`, `low`, `unlisted`. Without a notary: `off`, which does not count |

`ok` is `true` only when all of them are fine; otherwise the answer comes with the status 503, and the down alert (step 11) warns you. The backup and the test restore each write one line (a time, and "ok" or "failed") in `/var/lib/brinelight/status/`, which the game server reads, read-only: never a dump.

Docker's own check (`server (healthy)` in `docker compose ps`) only says the game server answers: restarting it would not mend a late backup.

## 8. Backups

### Why two kinds of backup

| | Nightly backup (`backup.sh`) | Hetzner Backups |
| --- | --- | --- |
| What | The database only (players, sessions, cities) | The whole server, disk included |
| When | Every night around 03:30 UTC, kept 7 days | Once a day, the last 7 kept |
| Where | On the server, `/var/backups/brinelight/` | At Hetzner, outside the server |
| Restores | The database, in a minute, nothing else touched | The whole server as it was that day |
| Protects against | A mistake or a bug that damaged the data | Losing the server or its disk; a broken system |

They complete each other: the nightly backup is exact and quick to restore, but it lives on the same disk as the database, so it disappears with the server. The Hetzner Backup survives the server, but restores everything at once, and copies a database that is running (PostgreSQL then restarts as after a power cut: it works, but the nightly dump is cleaner). The Hetzner Backup also contains the nightly dumps of the days before.

### Turn on the nightly backup and the weekly test restore

```
cd ~/brinelight/deploy
sudo ./install-backup.sh
```

It installs two timers and shows their next runs: the backup every night around 03:30 UTC, and a test restore of the latest backup every Sunday at 04:30 UTC (the same as the test below, nothing live is changed). Make a backup now, and look at it:

```
sudo systemctl start brinelight-backup.service
sudo ls -lh /var/backups/brinelight/
```

You should see a file like `brinelight-2026-10-20-033012.dump`. `https://api.brinelight.xyz/health` now says `"ok":true` and `"backup":"ok"`.

### Test a restore (do it now; then the timer does it every Sunday)

```
sudo ./restore.sh test
```

It restores the latest backup into a separate, temporary database, compares it with the live one, then deletes it. The live database is never touched. You should see:

```
In the backup:   N players, N cities
Live right now:  N players, N cities
Test restore OK. The temporary database was deleted; the live database was not touched.
```

The numbers can differ a little if players signed up since the backup. `/health` now says `"restore":"ok"`.

To run the weekly test by hand, as the timer does: `sudo systemctl start brinelight-restore-test.service`, then `systemctl status brinelight-restore-test.service` (the last lines show its result). If it fails, `/health` says `"restore":"failed"` and the alert warns you: run `sudo ./restore.sh test` to read the error.

## 9. The game on `play.brinelight.xyz` (Cloudflare Pages, then Vercel)

Do it **in this order**. If the DNS record exists before Cloudflare Pages knows the name, the page answers with an error 522.

1. **Merge the pull request of the week into `main`**: `play.brinelight.xyz` shows `main`.
2. **Cloudflare first**: **Workers & Pages → brinelight → Custom domains → Set up a domain**, type `play.brinelight.xyz`, and go on. Cloudflare shows that the domain is not on Cloudflare and asks for a `CNAME` record: leave the page open, the domain stays "Pending" (Inactive) until step 3 is done.
3. **Vercel next**: **Domains → brinelight.xyz → Add record**:
   - Type: `CNAME`.
   - Name: `play` only.
   - Value: `brinelight.pages.dev`.
4. Back in Cloudflare, wait until the custom domain becomes **Active** (a few minutes; Cloudflare also makes its certificate).
5. **Settings → Variables and Secrets**, for **Production** only: `VITE_API_URL` = `https://api.brinelight.xyz`. Do not set it for Preview: branch previews then say "Accounts are not open yet", and never call the server.
6. **Deployments**: retry the latest production deployment, so the game is built with the server address.

### Check

```
dig +short play.brinelight.xyz
```

It must print `brinelight.pages.dev.` then addresses. Or on **dnschecker.org**: `play.brinelight.xyz`, type `CNAME`: `brinelight.pages.dev` everywhere.

Then open `https://play.brinelight.xyz`, tap the Power card (top left): the Profile offers "Sign in with your wallet".

`brinelight.pages.dev` still shows the game, but signing in from there is refused: only `https://play.brinelight.xyz` is allowed (`ALLOWED_ORIGINS`).

## 10. The test of the week

1. On your phone, open the game **in Phantom's browser** (or open `https://play.brinelight.xyz` in Chrome: the Profile offers "Open in Phantom"). Sign in, upgrade a building.
2. On your computer, with Phantom installed in the browser, open `https://play.brinelight.xyz` and sign in with the same wallet.
3. You see the same city. Upgrade something else, go back to the phone, reload: it is there.

## 11. Be warned if the server goes down

A GitHub Actions workflow of the repository (`.github/workflows/watch.yml`) opens `https://api.brinelight.xyz/health` every 10 minutes. When the server does not answer, or `/health` does not say `"ok":true` (the database down, a backup late, a test restore failed), the run fails and GitHub sends you an e-mail. It is free, and needs no new account. (UptimeRobot's free plan is for non-commercial use only since late 2024, and Brinelight will sell cosmetics.)

1. On github.com, the repository → **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   - Name: `API_URL`
   - Value: `https://api.brinelight.xyz`

   The workflow is off until this variable exists. It must be in the **Variables** tab, not in **Secrets**: the workflow reads a variable, and a secret of the same name leaves it off (every run then says "skipped").
2. Check that GitHub e-mails you on failures: your avatar → **Settings → Notifications → Actions**: "Only notify for failed workflows" ticked, with e-mail.
3. Test it once: the repository → **Actions → watch → Run workflow**, and in "Another address" type `https://brinelight-test.invalid`. The run fails and you get an e-mail. Run it again with the field empty: it checks `API_URL` and passes.

What to know:
- GitHub can start a scheduled run several minutes late when it is busy. For a check every 3 minutes, Better Stack's free plan does the same with a new account.
- **GitHub turns off the scheduled workflows of a public repository after 60 days without activity on it** (no push, no pull request), and tells you by e-mail. To turn it on again: the repository → **Actions → watch → Enable workflow**.
- One e-mail per failed run: a server down for an hour sends about six.

---

## 12. The notary on Solana (devnet)

Every night at 00:15 UTC, the server seals the Lighthouse milestones of the day in one Solana transaction (`docs/proofs.md`). It needs a key of its own, made on the server and never copied anywhere else, and a little SOL to pay one fee a night (about 0.000005 SOL). **Devnet only for now: mainnet waits for the owner's yes (week 9, task 6).** The key is in the protected areas of `CLAUDE.md`.

One step at a time, as `brinelight`, in `~/brinelight/deploy`. Send what each step prints, except where it says not to.

1. **The game with the notary** (week 9's code, merged into `main`): `~/brinelight/deploy/update.sh`. The notary stays off: `/health` says `"notary":"off"`.
2. **The devnet key:**

   ```
   ./notary-key.sh devnet
   ```

   It makes the key in a throwaway container of the server's image (no network, no log), writes it into `deploy/.env` as `NOTARY_KEY_DEVNET` (the file stays readable by you only), and prints only its public address: `Its public address (you can share it): …`. Send that line. Never open `deploy/.env` to look at the key, never paste it anywhere. Run twice, it refuses: a key is never replaced by the script.
3. **Devnet SOL, from the faucet, never from Phantom:** open `https://faucet.solana.com`, choose **devnet**, paste the address, ask for 1 SOL (devnet SOL is free and worth nothing). Check it arrived: `https://explorer.solana.com/address/<the address>?cluster=devnet`.
4. **The address published:** Claude Code adds it to the official list (`shared/src/rules/notary.ts` and `docs/proofs.md`), then: `~/brinelight/deploy/update.sh` again.
5. **Turn the notary on, on devnet:**

   ```
   echo "SOLANA_CLUSTER=devnet" >> .env
   docker compose up -d
   docker compose logs --tail 20 server | grep -i notary
   ```

   The log says `The notary seals every night at 00:15 UTC` with `"cluster":"devnet"` and the address of step 2. Then `curl -s https://api.brinelight.xyz/health` says `"notary":"ok"`.
6. **The first seal:** after 00:15 UTC, if a milestone was recorded the day before. Its transaction appears on the address's page of step 3.

**If the key is lost or leaked:** stop the notary (`SOLANA_CLUSTER=` empty in `.env`, then `docker compose up -d`), take the old `NOTARY_KEY_DEVNET` line out of `.env` (or `NOTARY_KEY_MAINNET`), and tell Claude Code. Its address stays in the official list with its last day (and the day it leaked, if it did): the proofs it already sealed stay checkable. Then steps 2 to 5 again with a new key.

**What to never do:** run `docker compose config` or `docker inspect` where someone can see the screen, or paste what they print (they show every setting of `.env`, the key included); copy `deploy/.env` off the server; set the same key for devnet and mainnet (the server refuses).

## Later: everyday tasks

All as `brinelight`, in `~/brinelight/deploy`.

- **See what runs**: `docker compose ps`
- **Read the logs**: `docker compose logs --tail 100 server` (or `caddy`, `db`). Add `-f` to follow live, `Ctrl+C` to stop.
- **Restart the game server**: `docker compose restart server`
- **Update the game** to the latest `main`:

  ```
  ~/brinelight/deploy/update.sh
  ```

  It makes a backup, fetches `main`, rebuilds, restarts, and checks that `/health` says `"database":"ok"`. Database migrations apply by themselves when the server starts. A city stored in an older shape is brought up to date when it is read, and written in the current shape at its next change (`docs/decisions.md`). After an update that changed `deploy/systemd/`, run `sudo ./install-backup.sh` once more.

- **Go back to the previous version** after an update that went wrong. `update.sh` printed the backup it made first (`Backup written: …`). Then:

  ```
  cd ~/brinelight
  git log --oneline -5
  ```

  The second line is the version before the update. Go back to it, and restart:

  ```
  git checkout <its 7 characters>
  cd deploy && docker compose up -d --build
  ```

  If the new version changed the database (a migration), also put the database back as it was before the update: `sudo ./restore.sh replace` with the backup `update.sh` made (see "Restore for real"). Everything saved since is lost. When `main` is fixed, `git checkout main`, then `update.sh` as usual.

- **Space left on the disk**: `df -h /`

## Later: update the images on purpose

The images have exact versions in the repository, so nothing changes by surprise:

- `postgres:18.6-bookworm` and `caddy:2.11.4-alpine` in `deploy/compose.yaml`;
- `node:22.23.2-bookworm-slim` in `deploy/Dockerfile`.

The system itself (Ubuntu) updates its security fixes by itself. The images do not: check them about once a month.

1. Look for new versions: PostgreSQL 18 minor releases on postgresql.org ("Latest releases"), Caddy on github.com/caddyserver/caddy/releases, Node 22 on nodejs.org.
2. Change the version in the files, in a pull request (ask Claude Code), and let the CI start the whole stack with it.
3. After the merge, on the server: `~/brinelight/deploy/update.sh`. It downloads the new images and restarts with them.

A new **minor** PostgreSQL version (18.6 → 18.7) is safe this way. A new **major** version (18 → 19) is not: it needs a dump and a restore, never just a version change.

## Later: restore for real

### The database only (most cases)

```
cd ~/brinelight/deploy
sudo ls -lt /var/backups/brinelight/
sudo ./restore.sh replace /var/backups/brinelight/brinelight-2026-10-20-033012.dump
```

It asks you to type the file name to confirm, makes a backup of the current database first (in case), stops the game server, replaces the database, and starts the server again. Everything saved after that backup is lost.

### The whole server

In the Hetzner console: **Server → Backups → (a day) → Restore**. The server goes back to that day, as a whole. Then make a `restore.sh test` to check the database.

## Solving problems

- **`/health` answers, but with `"ok":false`** (the alert e-mail)
  - `"database":"down"`: `docker compose ps` and `docker compose logs --tail 50 db`; `docker compose start db` if it stopped.
  - `"backup":"late"` or `"none"`: `systemctl status brinelight-backup.timer` (installed?) and `journalctl -u brinelight-backup.service -n 30` (the error of the last run). Run one by hand: `sudo systemctl start brinelight-backup.service`.
  - `"restore":"failed"`: `sudo ./restore.sh test` shows the error; then `journalctl -u brinelight-restore-test.service -n 30`.
- **`https://api.brinelight.xyz/health` does not answer**
  - `docker compose ps`: is everything up? If not, `docker compose logs --tail 50 <service>`.
  - The certificate: `docker compose logs caddy | tail -30`. Usual causes: the `A` record does not point to the server yet (`dig +short api.brinelight.xyz`, or dnschecker.org); the record was typed as `api.brinelight.xyz` in Vercel's Name field instead of `api`, which gives `api.brinelight.xyz.brinelight.xyz`; `API_DOMAIN` in `.env` is not exactly `api.brinelight.xyz`.
- **`https://play.brinelight.xyz` shows an error 522, or nothing**
  - The custom domain must be **Active** in Cloudflare Pages (step 9). If the `CNAME` was added in Vercel before the custom domain was set up in Cloudflare, remove the custom domain in Cloudflare, add it again, and wait until it is Active.
  - `dig +short play.brinelight.xyz` must show `brinelight.pages.dev.`.
- **The game says the sign-in is refused**
  - "This page is not allowed to sign in": `ALLOWED_ORIGINS` must be exactly `https://play.brinelight.xyz`, with no final `/`. After a change: `docker compose up -d`.
  - "This message was made at the wrong time": check the clock of the phone, and of the server (`timedatectl`).
- **"Too many sign-in attempts"**: wait a minute.
- **SSH refuses you**: use the Hetzner console (**Server → Console**), log in as `brinelight` with its password.
- **You lost your SSH key**: on your new computer, make a new key (step 1); in the Hetzner console, log in and add the new public key line to `~/.ssh/authorized_keys`.
- **The disk is full**: `df -h /`, then `docker system prune` (removes old images, never the data volumes).

## Security notes

- Never share the private SSH key, the `brinelight` password or `deploy/.env`.
- Members of the `docker` group can do anything on the server through Docker: only `brinelight` is in it.
- Ports opened by Docker skip the `ufw` firewall. That is why only Caddy opens ports (80 and 443, already allowed), and the database and the game server have none. Never add a `ports:` line to `db` or `server` in `compose.yaml`.
- The database is on a Docker network with no way out to the Internet.
- The notary's key is in `deploy/.env` (readable by `brinelight` only) and, once the server runs, in the game server's container: `docker inspect` and `docker compose config` show it to anyone who can run Docker on the server. Hetzner Backups copy the whole disk, `deploy/.env` with it; the nightly database dumps never hold it.

## Annex: if the repository becomes private

The server then needs a read-only key to GitHub:

```
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "brinelight-server"
cat ~/.ssh/github_deploy.pub
```

In GitHub: the repository → **Settings → Deploy keys → Add deploy key**, paste the line, leave **Allow write access unticked**. Then on the server:

```
printf 'Host github.com\n  IdentityFile ~/.ssh/github_deploy\n' >> ~/.ssh/config
git -C ~/brinelight remote set-url origin git@github.com:BacBacta/Brinelight.git
```

This key stays on the server and only reads the repository.
